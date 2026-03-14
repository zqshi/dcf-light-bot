/**
 * EventBus — 全局事件总线，模块间解耦通信
 */
class EventBus {
  constructor() { this._handlers = new Map(); }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }

  emit(event, data) {
    this._handlers.get(event)?.forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
    });
  }

  once(event, handler) {
    const wrapper = (data) => { handler(data); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }
}

export const bus = new EventBus();

// 常量事件名
export const Events = {
  // Auth
  LOGIN_SUCCESS: 'auth:login_success',
  LOGOUT: 'auth:logout',
  // Matrix
  MATRIX_READY: 'matrix:ready',
  MATRIX_SYNC: 'matrix:sync',
  ROOM_SELECTED: 'matrix:room_selected',
  ROOM_TIMELINE: 'matrix:room_timeline',
  ROOM_LIST_UPDATED: 'matrix:room_list_updated',
  TYPING: 'matrix:typing',
  // UI
  DOCK_SWITCH: 'ui:dock_switch',
  DRAWER_TOGGLE: 'ui:drawer_toggle',
  DRAWER_CONTENT: 'ui:drawer_content',
  TOAST: 'ui:toast',
  // Factory
  AGENT_CREATED: 'factory:agent_created',
  AGENT_CARD_CLICK: 'factory:agent_card_click',
  // Agents
  SHARED_AGENT_INVOKE: 'agents:invoke',
};
