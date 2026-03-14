/**
 * AppsGrid — 轻应用页面（stitch_19/20 对齐）
 * 面包屑 + 创建按钮 + 我的创作(AI辅助) + 最近使用 + 分类grid
 */
import { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AppSection } from './AppSection';
import { AppCategorySidebar } from './AppCategorySidebar';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { AppCenterPage } from './AppCenterPage';
import { AICreationPanel } from './AICreationPanel';
import {
  MOCK_APPS,
  APP_CATEGORIES,
  MY_CREATIONS,
  RECENT_APPS,
  type AppCategory,
} from '../../../data/mockApps';

type SidebarView = AppCategory | 'all' | 'recent' | 'favorites';

// Shared state for sidebar ↔ main page coordination
let _sidebarView: SidebarView = 'all';
let _sidebarSearch = '';
let _sidebarListeners: (() => void)[] = [];

function setSidebarState(view?: SidebarView, search?: string) {
  if (view !== undefined) _sidebarView = view;
  if (search !== undefined) _sidebarSearch = search;
  _sidebarListeners.forEach((cb) => cb());
}

function useSidebarState() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _sidebarListeners.push(cb);
    return () => { _sidebarListeners = _sidebarListeners.filter((c) => c !== cb); };
  }, []);
  return { view: _sidebarView, search: _sidebarSearch };
}

export function AppsSidebar() {
  const { view, search } = useSidebarState();
  return (
    <AppCategorySidebar
      activeView={view}
      onSelect={(key) => setSidebarState(key as SidebarView)}
      search={search}
      onSearchChange={(s) => setSidebarState(undefined, s)}
    />
  );
}

function MyCreationsSection({ onView, onEdit }: { onView: (appName: string) => void; onEdit: (appName: string) => void }) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">我的创作</h3>
        <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
          AI 辅助
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MY_CREATIONS.map((app) => (
          <div
            key={app.id}
            onClick={() => onView(app.name)}
            className="relative flex items-center gap-3 p-4 bg-bg-white-var rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${app.color}12` }}
            >
              <Icon name={app.icon} size={24} style={{ color: app.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{app.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {app.subLabel} · {app.updatedAt}
              </p>
            </div>
            <span className="absolute top-2 right-2 text-[9px] font-medium text-primary bg-primary/8 px-1.5 py-0.5 rounded">
              Edit with AI
            </span>
            {/* More button + dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === app.id ? null : app.id); }}
                className="p-1 text-text-muted hover:text-text-secondary"
              >
                <Icon name="more_vert" size={16} />
              </button>
              {menuOpen === app.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                  <div className="absolute right-0 top-8 z-20 w-32 bg-white rounded-xl shadow-lg border border-border py-1 text-sm">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-text-primary hover:bg-gray-50 flex items-center gap-2"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onEdit(app.name); }}
                    >
                      <Icon name="edit" size={14} className="text-text-muted" />
                      编辑
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-[#FF3B30] hover:bg-red-50 flex items-center gap-2"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(null); useToastStore.getState().addToast(`「${app.name}」已删除`, 'info'); }}
                    >
                      <Icon name="delete" size={14} />
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentAppsSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">最近使用</h3>
        <button type="button" onClick={() => setSidebarState('recent')} className="text-xs text-primary hover:text-primary/80 font-medium">
          查看全部
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {RECENT_APPS.map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-3 p-3.5 bg-bg-white-var rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => useToastStore.getState().addToast(`打开应用: ${app.name}`, 'info')}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${app.color}12` }}
            >
              <Icon name={app.icon} size={22} style={{ color: app.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{app.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {app.subLabel} · {app.version}
              </p>
            </div>
            <Icon name="chevron_right" size={18} className="text-text-muted shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppsGrid() {
  const { view: sidebarView, search: sidebarSearch } = useSidebarState();
  const view = sidebarView;
  const search = sidebarSearch;
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);
  const [viewingApp, setViewingApp] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = MOCK_APPS;
    if (view !== 'all' && view !== 'recent' && view !== 'favorites') {
      list = list.filter((a) => a.category === view);
    }
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(t) || a.description.toLowerCase().includes(t),
      );
    }
    return list;
  }, [view, search]);

  const grouped = useMemo(() => {
    if (view !== 'all' && view !== 'recent' && view !== 'favorites') {
      return [{ label: APP_CATEGORIES.find((c) => c.key === view)?.label ?? '', apps: filtered }];
    }
    return APP_CATEGORIES.map((cat) => ({
      label: cat.label,
      apps: filtered.filter((a) => a.category === cat.key),
    })).filter((g) => g.apps.length > 0);
  }, [filtered, view]);

  const showCreations = view === 'all' && !search.trim();
  const showRecent = (view === 'all' || view === 'recent') && !search.trim();

  // Must be after all hooks to respect Rules of Hooks
  if (subView === 'apps:admin') {
    return <AppCenterPage isAdmin />;
  }
  if (subView === 'apps:create') {
    return (
      <AICreationPanel
        mode="create"
        onClose={() => { setSubView(null); setViewingApp(null); }}
      />
    );
  }
  if (subView === 'apps:view' && viewingApp) {
    return (
      <AICreationPanel
        mode="view"
        onClose={() => { setSubView(null); setViewingApp(null); }}
        initialAppName={viewingApp}
        onSwitchToEdit={() => setSubView('apps:edit')}
      />
    );
  }
  if (subView === 'apps:edit' && viewingApp) {
    return (
      <AICreationPanel
        mode="edit"
        onClose={() => { setSubView(null); setViewingApp(null); }}
        initialAppName={viewingApp}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 dcf-scrollbar">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header: breadcrumb + create button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <span>轻应用</span>
            <Icon name="chevron_right" size={16} />
            <span className="text-text-primary font-medium">全部应用</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubView('apps:create')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="add" size={18} />
              <span>创建我的应用</span>
            </button>
          </div>
        </div>

        {/* My creations */}
        {showCreations && (
          <MyCreationsSection
            onView={(name) => { setViewingApp(name); setSubView('apps:view'); }}
            onEdit={(name) => { setViewingApp(name); setSubView('apps:edit'); }}
          />
        )}

        {/* Recent apps */}
        {showRecent && <RecentAppsSection />}

        {/* Category sections */}
        {grouped.map((group) => (
          <AppSection key={group.label} title={group.label} apps={group.apps} />
        ))}

        {/* IT Services section (stitch_20) */}
        {(view === 'all' || view === 'it') && !search.trim() && <ITServicesSection />}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-text-muted">没有匹配的应用</div>
        )}
      </div>
    </div>
  );
}

const IT_SERVICES = [
  { id: 'it-desk', name: 'IT 服务台', icon: 'help_center', description: '创建工单或咨询在线支持', dark: true },
  { id: 'password', name: '密码重置', icon: 'lock_reset', description: '自助凭据管理服务', dark: false },
  { id: 'hardware', name: '硬件申领', icon: 'devices', description: '申请办公设备或故障维修', dark: false },
];

function ITServicesSection() {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text-primary">IT 服务</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {IT_SERVICES.map((svc) => (
          <button
            key={svc.id}
            type="button"
            onClick={() => useToastStore.getState().addToast(`正在打开「${svc.name}」…`, 'info')}
            className={`flex flex-col items-start gap-3 p-5 rounded-xl border transition-shadow hover:shadow-md cursor-pointer ${
              svc.dark
                ? 'bg-surface-dark border-transparent text-white'
                : 'bg-bg-white-var border-border text-text-primary'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                svc.dark ? 'bg-white/15' : 'bg-primary/10'
              }`}
            >
              <Icon name={svc.icon} size={24} className={svc.dark ? 'text-white' : 'text-primary'} />
            </div>
            <div>
              <p className="text-sm font-semibold">{svc.name}</p>
              <p className={`text-xs mt-0.5 ${svc.dark ? 'text-white/60' : 'text-text-muted'}`}>
                {svc.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
