import { create } from 'zustand';
import type { UserProfile } from '../../infrastructure/matrix/MatrixClientAdapter';
import type { AuthUser } from '../../infrastructure/api/dcfApiClient';
import { LocalStorageAdapter } from '../../infrastructure/storage/LocalStorageAdapter';

const AUTH_KEY = 'dcf_auth';

interface PersistedAuth {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
}

interface AuthState {
  user: UserProfile | null;
  dcfUser: AuthUser | null;
  accessToken: string | null;
  homeserverUrl: string | null;
  isLoggedIn: boolean;
  isDemo: boolean;
  /** True when authenticated against DCF backend (cookie session active) */
  isBackendConnected: boolean;

  setAuth(user: UserProfile, token: string, homeserver: string, demo: boolean): void;
  setDcfUser(dcfUser: AuthUser): void;
  clearAuth(): void;
  persistAuth(): void;
  loadPersistedAuth(): PersistedAuth | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  dcfUser: null,
  accessToken: null,
  homeserverUrl: null,
  isLoggedIn: false,
  isDemo: false,
  isBackendConnected: false,

  setAuth(user, token, homeserver, demo) {
    set({ user, accessToken: token, homeserverUrl: homeserver, isLoggedIn: true, isDemo: demo });
  },

  setDcfUser(dcfUser) {
    set({ dcfUser, isBackendConnected: true });
  },

  clearAuth() {
    set({
      user: null,
      dcfUser: null,
      accessToken: null,
      homeserverUrl: null,
      isLoggedIn: false,
      isDemo: false,
      isBackendConnected: false,
    });
    LocalStorageAdapter.remove(AUTH_KEY);
  },

  persistAuth() {
    const { user, accessToken, homeserverUrl } = get();
    if (user && accessToken && homeserverUrl) {
      LocalStorageAdapter.set(AUTH_KEY, {
        homeserverUrl,
        accessToken,
        userId: user.userId,
      });
    }
  },

  loadPersistedAuth() {
    return LocalStorageAdapter.get<PersistedAuth | null>(AUTH_KEY, null);
  },
}));
