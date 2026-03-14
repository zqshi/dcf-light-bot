/**
 * Store — 简易响应式状态管理
 */
import { bus, Events } from './events.js';

const state = {
  // Auth
  user: null,         // { userId, displayName, avatarUrl, org, department, role }
  accessToken: null,
  homeserverUrl: '',
  // Matrix
  matrixReady: false,
  rooms: [],          // [{ roomId, name, avatar, lastMessage, lastTs, unread, type:'dm'|'bot'|'group' }]
  currentRoomId: null,
  messages: [],       // current room messages
  // UI
  currentDock: 'messages',  // messages | agents | apps | factory | settings
  drawerOpen: false,
  drawerContent: null,      // { type: 'doc'|'code'|'preview', data }
  // Factory
  createdAgents: [],
  // Shared agents
  sharedAgents: [],
};

const listeners = new Set();

export function getState() { return state; }

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => { try { fn(state); } catch(e) { console.error('[Store]', e); } });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Persistence
export function persistAuth() {
  if (state.user && state.accessToken) {
    localStorage.setItem('dcf_auth', JSON.stringify({
      user: state.user,
      accessToken: state.accessToken,
      homeserverUrl: state.homeserverUrl,
    }));
  }
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem('dcf_auth');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem('dcf_auth');
  setState({ user: null, accessToken: null, matrixReady: false, rooms: [], currentRoomId: null, messages: [] });
}
