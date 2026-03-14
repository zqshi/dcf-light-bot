/**
 * Lightweight typed event bus for cross-store coordination.
 * Stores and components can publish/subscribe events without direct coupling.
 */

export interface AppEvents {
  /** Approval resolved — triggers knowledge permission update */
  'approval:resolved': { documentId: string; documentName: string; approved: boolean; reason?: string };
  /** Navigate to a chat room from another module */
  'navigate:chat': { roomId: string };
  /** Navigate to a knowledge sub-view from another module */
  'navigate:knowledge': { subView: string; documentId?: string };
  /** IM reply sent from OpenClaw */
  'im:reply-sent': { roomId: string; message: string };
}

type EventHandler<T> = (payload: T) => void;
type Unsubscribe = () => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler as EventHandler<unknown>);
    return () => { set.delete(handler as EventHandler<unknown>); };
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((handler) => handler(payload));
    }
  }

  off<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as EventHandler<unknown>);
    }
  }
}

export const appEvents = new EventBus();
