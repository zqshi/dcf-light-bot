import { create } from 'zustand';
import { Notification } from '../../domain/notification/Notification';
import { Approval } from '../../domain/notification/Approval';
import { MOCK_NOTIFICATIONS, MOCK_APPROVALS } from '../../data/mockNotifications';
import { notificationApi } from '../../infrastructure/api/dcfApiClient';

type ActiveTab = 'all' | 'unread' | 'approvals';

interface NotificationState {
  notifications: Notification[];
  approvals: Approval[];
  activeTab: ActiveTab;

  markAsRead(id: string): void;
  approveRequest(id: string): void;
  rejectRequest(id: string, reason: string): void;
  setActiveTab(tab: ActiveTab): void;
  markAllAsRead(): void;
  reset(): void;
  /** Fetch notifications from DCF backend; falls back to mock data on failure */
  fetchFromBackend(): Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: MOCK_NOTIFICATIONS.map(Notification.create),
  approvals: MOCK_APPROVALS.map(Approval.create),
  activeTab: 'all',

  markAsRead(id) {
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? n.markAsRead() : n,
      ),
    });
  },

  approveRequest(id) {
    // NOTE: Backend has no dedicated approval endpoint. Approve/reject are
    // display-only actions derived from the notification feed. The operation
    // is persisted locally only; once a real approval workflow API exists on
    // the backend, add a POST here (e.g. POST /api/admin/approvals/:id/approve).
    set({
      approvals: get().approvals.map((a) =>
        a.id === id ? a.approve() : a,
      ),
    });
  },

  rejectRequest(id, reason) {
    // NOTE: Same as approveRequest — no backend approval API yet.
    set({
      approvals: get().approvals.map((a) =>
        a.id === id ? a.reject(reason) : a,
      ),
    });
  },

  setActiveTab(tab) {
    set({ activeTab: tab });
  },

  markAllAsRead() {
    set({
      notifications: get().notifications.map((n) => n.isUnread ? n.markAsRead() : n),
    });
  },

  reset() {
    set({
      notifications: MOCK_NOTIFICATIONS.map(Notification.create),
      approvals: MOCK_APPROVALS.map(Approval.create),
      activeTab: 'all',
    });
  },

  async fetchFromBackend() {
    try {
      const res = await notificationApi.list();
      if (res.items && res.items.length > 0) {
        set({
          notifications: res.items.map((n) =>
            Notification.create({
              id: n.id,
              title: n.title,
              body: n.body ?? n.detail ?? '',
              type: (n.source === 'instance' ? 'system' : n.severity === 'high' ? 'approval' : 'update') as 'system' | 'mention' | 'approval' | 'update',
              read: false,
              timestamp: n.at ?? new Date().toISOString(),
              sender: { name: n.source ?? 'System', avatar: '' },
            }),
          ),
        });
      }
    } catch {
      // Backend unreachable — keep mock data, silent (toast too noisy on every page load)
    }
  },
}));

export const selectUnreadCount = (state: NotificationState): number =>
  state.notifications.filter((n) => n.isUnread).length;
