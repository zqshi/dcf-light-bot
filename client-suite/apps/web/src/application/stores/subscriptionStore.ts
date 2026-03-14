import { create } from 'zustand';
import { Subscription } from '../../domain/subscription/Subscription';
import type { SubscriptionType } from '../../domain/subscription/Subscription';
import { MOCK_SUBSCRIPTIONS, MOCK_FEED_ITEMS } from '../../data/mockSubscriptions';
import type { FeedItem } from '../../data/mockSubscriptions';
import { logsApi } from '../../infrastructure/api/dcfApiClient';

export type CategoryFilter = 'all' | SubscriptionType;
export type SidebarTab = 'all' | 'sources' | 'alerts';

interface SubscriptionState {
  subscriptions: Subscription[];
  feedItems: FeedItem[];
  activeCategory: CategoryFilter;
  sidebarTab: SidebarTab;
  showDashboard: boolean;
  feedLoading: boolean;

  reset(): void;
  setActiveCategory(category: CategoryFilter): void;
  setSidebarTab(tab: SidebarTab): void;
  toggleSubscription(id: string): void;
  setShowDashboard(show: boolean): void;
  /** Fetch feed items from backend audit logs; falls back to mock data on failure */
  fetchFromBackend(): Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscriptions: MOCK_SUBSCRIPTIONS.map(Subscription.create),
  feedItems: [...MOCK_FEED_ITEMS],
  activeCategory: 'all',
  sidebarTab: 'all',
  showDashboard: false,
  feedLoading: false,

  reset() {
    set({
      subscriptions: MOCK_SUBSCRIPTIONS.map(Subscription.create),
      feedItems: [...MOCK_FEED_ITEMS],
      activeCategory: 'all',
      sidebarTab: 'all',
      showDashboard: false,
    });
  },

  setActiveCategory(category: CategoryFilter) {
    set({ activeCategory: category });
  },

  setSidebarTab(tab: SidebarTab) {
    set({ sidebarTab: tab });
  },

  toggleSubscription(id: string) {
    set((state) => ({
      subscriptions: state.subscriptions.map((s) =>
        s.id === id ? s.toggleEnabled() : s,
      ),
    }));
  },

  setShowDashboard(show: boolean) {
    set({ showDashboard: show });
  },

  async fetchFromBackend() {
    set({ feedLoading: true });
    try {
      const logs = await logsApi.list();
      if (Array.isArray(logs) && logs.length > 0) {
        const mapped: FeedItem[] = logs.map((entry: any, idx: number) => ({
          id: entry.id ?? `log-${idx}`,
          subscriptionId: 'backend',
          title: entry.type ?? entry.action ?? '系统日志',
          summary: entry.details ?? entry.message ?? '',
          source: entry.source ?? 'Audit',
          timestamp: entry.at ?? entry.createdAt ?? new Date().toISOString(),
          category: entry.category ?? '系统',
          importance: 'medium' as const,
        }));
        set({ feedItems: mapped });
      }
    } catch {
      // Backend unreachable — keep mock data
    } finally {
      set({ feedLoading: false });
    }
  },
}));
