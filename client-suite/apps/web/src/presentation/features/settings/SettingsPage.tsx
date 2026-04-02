import { useState, useRef } from 'react';
import { useAuthStore } from '../../../application/stores/authStore';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';

type SettingsSection = 'profile' | 'server' | 'notifications' | 'about';

const SECTIONS: { key: SettingsSection; label: string; icon: string }[] = [
  { key: 'profile', label: '个人信息', icon: 'person' },
  { key: 'server', label: '服务器', icon: 'dns' },
  { key: 'notifications', label: '通知偏好', icon: 'notifications' },
  { key: 'about', label: '关于', icon: 'info' },
];

export function SettingsSidebar() {
  const rawSubView = useUIStore((s) => s.subView);
  const settingsSection = rawSubView?.startsWith('settings:') ? rawSubView.slice(9) as SettingsSection : rawSubView as SettingsSection | null;
  const active = settingsSection && SECTIONS.some((s) => s.key === settingsSection) ? settingsSection : 'profile';

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">设置</h3>
      <div className="space-y-0.5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => useUIStore.getState().setSubView(`settings:${s.key}`)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              active === s.key ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary font-medium'
            }`}
          >
            <Icon name={s.icon} size={16} className={active === s.key ? 'text-primary' : 'text-text-secondary'} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const homeserverUrl = useAuthStore((s) => s.homeserverUrl);
  const { logout } = useMatrixClient();
  const [notifSound, setNotifSound] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const subView = useUIStore((s) => s.subView);

  // Scroll to section when sidebar selection changes
  const sectionKey = subView?.startsWith('settings:') ? subView.slice(9) : subView;
  const activeSection = sectionKey && SECTIONS.some((s) => s.key === sectionKey) ? sectionKey : null;
  if (activeSection && sectionRefs.current[activeSection]) {
    sectionRefs.current[activeSection]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-8">
        <h2 className="text-lg font-semibold text-text-primary">设置</h2>
        {/* Profile */}
        <section ref={(el) => { sectionRefs.current['profile'] = el; }} className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary">个人信息</h2>
          <div className="flex items-center gap-4 p-4 bg-bg-white-var rounded-xl border border-border">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xl font-bold shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-text-primary truncate">{user?.displayName ?? '—'}</p>
              <p className="text-xs text-text-muted truncate">{user?.userId ?? '—'}</p>
              {(user?.org || user?.department) && (
                <p className="text-xs text-text-secondary truncate">
                  {[user.org, user.department].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Server */}
        <section ref={(el) => { sectionRefs.current['server'] = el; }} className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary">服务器信息</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Homeserver</span>
              <span className="text-xs text-text-primary font-mono">{homeserverUrl ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">连接状态</span>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                已连接
              </span>
            </div>
          </div>
        </section>

        {/* Notification Preferences */}
        <section ref={(el) => { sectionRefs.current['notifications'] = el; }} className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary">通知偏好</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-4">
            <ToggleRow label="消息提示音" checked={notifSound} onChange={setNotifSound} />
            <ToggleRow label="消息预览" checked={notifPreview} onChange={setNotifPreview} />
            <ToggleRow label="桌面通知" checked={notifDesktop} onChange={setNotifDesktop} />
          </div>
        </section>

        {/* About */}
        <section ref={(el) => { sectionRefs.current['about'] = el; }} className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary">关于</h2>
          <div className="p-4 bg-bg-white-var rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">版本</span>
              <span className="text-xs text-text-primary">0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">内核</span>
              <span className="text-xs text-text-primary">Matrix Synapse</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">前端框架</span>
              <span className="text-xs text-text-primary">React 18 + Vite 5</span>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
          >
            退出登录
          </button>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-primary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg-white-var transition-transform shadow-sm ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
