/**
 * useMatrixClient — 管理 IMatrixClient 实例的单例 hook
 *
 * Login flow:
 * 1. Try DCF backend auth (/api/auth/login) → sets cookie session
 * 2. If backend available, try RealMatrixClient with Matrix homeserver
 * 3. If Matrix unavailable, fall back to MockMatrixClient (demo-like)
 * 4. If backend unreachable, fall through to direct Matrix login
 */
import { useRef, useCallback } from 'react';
import type { IMatrixClient } from '../../infrastructure/matrix/MatrixClientAdapter';
import { MockMatrixClient } from '../../infrastructure/matrix/MockMatrixClient';
import { RealMatrixClient } from '../../infrastructure/matrix/RealMatrixClient';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { useTodoStore } from '../stores/todoStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { authApi } from '../../infrastructure/api/dcfApiClient';

let clientInstance: IMatrixClient | null = null;
let loginInProgress = false;
let selectRoomSeq = 0;

/** Stored callback references for cleanup on logout/re-login */
let registeredSyncCb: (() => void) | null = null;
let registeredTimelineCb: ((roomId: string) => void) | null = null;
let registeredTypingCb: ((roomId: string, userId: string, typing: boolean) => void) | null = null;

function cleanupCallbacks(client: IMatrixClient | null) {
  if (!client) return;
  if (registeredSyncCb) client.offSync(registeredSyncCb);
  if (registeredTimelineCb) client.offTimeline(registeredTimelineCb);
  if (registeredTypingCb) client.offTyping(registeredTypingCb);
  registeredSyncCb = null;
  registeredTimelineCb = null;
  registeredTypingCb = null;
}

export function getMatrixClient(): IMatrixClient | null {
  return clientInstance;
}

/**
 * Module-level selectRoom — full flow: set current room + load messages + clear unread + refresh rooms.
 * Use this from event handlers outside of React component context.
 */
export async function globalSelectRoom(roomId: string): Promise<void> {
  const client = clientInstance;
  if (!client) return;
  const seq = ++selectRoomSeq;
  const { setCurrentRoom, setMessages, clearUnread, setRooms } = useChatStore.getState();
  setCurrentRoom(roomId);
  try {
    await client.selectRoom(roomId);
    // Abort if another selectRoom was called while we awaited
    if (seq !== selectRoomSeq) return;
    setMessages(client.getMessages(roomId));
    clearUnread(roomId);
    setRooms(client.getRooms());
  } catch {
    // Client may have been logged out during await
  }
}

export function useMatrixClient() {
  const clientRef = useRef<IMatrixClient | null>(clientInstance);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const persistAuth = useAuthStore((s) => s.persistAuth);
  const loadPersistedAuth = useAuthStore((s) => s.loadPersistedAuth);
  const { setRooms, setMessages, setCurrentRoom, setTyping, clearUnread } = useChatStore();

  const wireUpCallbacks = useCallback(
    (client: IMatrixClient) => {
      // Clean up any previous callbacks before registering new ones
      cleanupCallbacks(client);

      const syncCb = () => {
        setRooms(client.getRooms());
      };
      const timelineCb = (roomId: string) => {
        setRooms(client.getRooms());
        const currentRoomId = useChatStore.getState().currentRoomId;
        if (roomId === currentRoomId) {
          setMessages(client.getMessages(roomId));
        }
      };
      const typingCb = (roomId: string, userId: string, typing: boolean) => {
        setTyping(roomId, userId, typing);
      };

      client.onSync(syncCb);
      client.onTimeline(timelineCb);
      client.onTyping(typingCb);

      // Store references for cleanup
      registeredSyncCb = syncCb;
      registeredTimelineCb = timelineCb;
      registeredTypingCb = typingCb;
    },
    [setRooms, setMessages, setTyping],
  );

  const loginDemo = useCallback(async () => {
    const client = new MockMatrixClient();
    clientInstance = client;
    clientRef.current = client;

    wireUpCallbacks(client);
    const result = await client.login('', '', '');

    const profile = client.getUserProfile()!;
    setAuth(profile, result.accessToken, 'https://demo.dcf.local', true);
    persistAuth();
  }, [wireUpCallbacks, setAuth, persistAuth]);

  const login = useCallback(
    async (homeserver: string, username: string, password: string) => {
      if (loginInProgress) return;
      loginInProgress = true;
      try {
        const setDcfUser = useAuthStore.getState().setDcfUser;

        // Step 1: Try DCF backend auth (cookie session)
        let backendOk = false;
        try {
          const res = await authApi.login(username, password);
          if (res.authenticated && res.user) {
            setDcfUser(res.user);
            backendOk = true;
          }
        } catch {
          // Backend unreachable — proceed with direct Matrix login
        }

        // Step 2: Try RealMatrixClient
        let client: IMatrixClient;
        try {
          const real = new RealMatrixClient();
          const result = await real.login(homeserver, username, password);
          client = real;
          clientInstance = client;
          clientRef.current = client;
          wireUpCallbacks(real);
          const profile = real.getUserProfile()!;
          setAuth(profile, result.accessToken, homeserver, false);
          persistAuth();
        } catch (matrixErr) {
          if (!backendOk) throw matrixErr;
          // Backend auth succeeded but Matrix unavailable → use MockMatrixClient
          const mock = new MockMatrixClient();
          clientInstance = mock;
          clientRef.current = mock;
          wireUpCallbacks(mock);
          await mock.login('', username, '');
          client = mock;
          const profile = mock.getUserProfile()!;
          setAuth(profile, 'backend-session', homeserver, false);
          persistAuth();
          useToastStore.getState().addToast('Matrix 服务不可用，已进入离线 IM 模式', 'info');
        }
      } finally {
        loginInProgress = false;
      }
    },
    [wireUpCallbacks, setAuth, persistAuth],
  );

  const selectRoom = useCallback(
    async (roomId: string) => {
      const client = clientRef.current;
      if (!client) return;
      setCurrentRoom(roomId);
      await client.selectRoom(roomId);
      setMessages(client.getMessages(roomId));
      clearUnread(roomId);
      setRooms(client.getRooms());
    },
    [setCurrentRoom, setMessages, clearUnread, setRooms],
  );

  const sendMessage = useCallback(async (roomId: string, body: string) => {
    const client = clientRef.current;
    if (!client) return;
    await client.sendMessage(roomId, body);
  }, []);

  const sendFile = useCallback(async (roomId: string, file: File) => {
    const client = clientRef.current;
    if (!client) return;
    await client.sendFile(roomId, file);
  }, []);

  const sendTyping = useCallback((roomId: string, typing: boolean) => {
    const client = clientRef.current;
    if (!client) return;
    client.sendTyping(roomId, typing);
  }, []);

  const logout = useCallback(async () => {
    // Logout from DCF backend (clear cookie session)
    try {
      await authApi.logout();
    } catch {
      // Backend may be unreachable, proceed anyway
    }

    const client = clientRef.current;
    if (client) {
      cleanupCallbacks(client);
      try { await client.logout(); } catch { /* network may be down */ }
      clientInstance = null;
      clientRef.current = null;
    }
    clearAuth();
    // Reset all application stores
    useChatStore.getState().reset();
    useUIStore.getState().reset();
    useAgentStore.getState().reset();
    useNotificationStore.getState().reset();
    useKnowledgeStore.getState().reset();
    useTodoStore.getState().reset();
    useSubscriptionStore.getState().reset();
  }, [clearAuth]);

  const restoreSession = useCallback(async () => {
    const setDcfUser = useAuthStore.getState().setDcfUser;

    // Step 1: Check DCF backend session (cookie may still be valid)
    try {
      const meRes = await authApi.me();
      if (meRes.authenticated && meRes.user) {
        setDcfUser(meRes.user);
      }
    } catch {
      // Backend unreachable — that's ok, continue with Matrix session
    }

    // Step 2: Restore Matrix session from localStorage
    const persisted = loadPersistedAuth();
    if (!persisted) {
      // If DCF backend session is active but no Matrix persisted, use mock
      if (useAuthStore.getState().isBackendConnected) {
        const mock = new MockMatrixClient();
        wireUpCallbacks(mock);
        await mock.login('', useAuthStore.getState().dcfUser?.username ?? 'admin', '');
        clientInstance = mock;
        clientRef.current = mock;
        const profile = mock.getUserProfile()!;
        setAuth(profile, 'backend-session', '', false);
      }
      return;
    }

    try {
      const { homeserverUrl, accessToken, userId } = persisted;

      if (accessToken === 'demo-token') {
        await loginDemo();
        return;
      }

      if (accessToken === 'backend-session') {
        // Was using mock because Matrix was unavailable last time
        const mock = new MockMatrixClient();
        wireUpCallbacks(mock);
        await mock.login('', userId, '');
        clientInstance = mock;
        clientRef.current = mock;
        const profile = mock.getUserProfile()!;
        setAuth(profile, 'backend-session', homeserverUrl, false);
        return;
      }

      const client = new RealMatrixClient();
      clientInstance = client;
      clientRef.current = client;

      wireUpCallbacks(client);
      await client.initFromSession(homeserverUrl, accessToken, userId);

      const profile = client.getUserProfile()!;
      setAuth(profile, accessToken, homeserverUrl, false);
    } catch {
      useToastStore.getState().addToast('会话恢复失败，请重新登录', 'error');
      clearAuth();
    }
  }, [loadPersistedAuth, loginDemo, wireUpCallbacks, setAuth, clearAuth]);

  const ssoRedirect = useCallback((homeserver: string) => {
    const redirectUrl = window.location.origin + window.location.pathname;
    window.location.href = `${homeserver}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  }, []);

  const loginWithToken = useCallback(
    async (homeserver: string, loginToken: string) => {
      const client = new RealMatrixClient();
      clientInstance = client;
      clientRef.current = client;
      wireUpCallbacks(client);
      const result = await client.loginWithToken(homeserver, loginToken);
      const profile = client.getUserProfile()!;
      setAuth(profile, result.accessToken, homeserver, false);
      persistAuth();
    },
    [wireUpCallbacks, setAuth, persistAuth],
  );

  const createDmRoom = useCallback(async (userId: string): Promise<string | null> => {
    const client = clientRef.current;
    if (!client) return null;
    return client.createDmRoom(userId);
  }, []);

  const searchUsers = useCallback(async (term: string) => {
    const client = clientRef.current;
    if (!client) return [];
    return client.searchUsers(term);
  }, []);

  return {
    client: clientRef.current,
    login,
    loginDemo,
    restoreSession,
    selectRoom,
    sendMessage,
    sendFile,
    sendTyping,
    logout,
    ssoRedirect,
    loginWithToken,
    createDmRoom,
    searchUsers,
  };
}
