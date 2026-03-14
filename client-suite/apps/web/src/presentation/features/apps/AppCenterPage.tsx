/**
 * AppCenterPage — 轻应用中心 (stitch_19 管理员 + stitch_20 员工 对齐)
 * 左侧: 分类导航 (合集/分类)
 * 右侧: 我的创作(管理员) + 最近使用 + 分类网格 + IT服务大卡片
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';

interface AppItem {
  icon: string;
  iconColor: string;
  name: string;
  desc?: string;
}

interface AppSection {
  title: string;
  apps: AppItem[];
}

const CATEGORIES = [
  { key: 'all', label: '全部应用', icon: 'apps' },
  { key: 'recent', label: '最近使用', icon: 'history' },
  { key: 'favorites', label: '收藏夹', icon: 'star' },
];

const CATEGORY_GROUPS = [
  { key: 'office', label: '办公工具', icon: 'business_center' },
  { key: 'hr', label: '人事服务', icon: 'people' },
  { key: 'finance', label: '财务法务', icon: 'account_balance' },
  { key: 'it', label: 'IT 服务', icon: 'devices' },
  { key: 'data', label: '数据洞察', icon: 'analytics' },
];

const MY_CREATIONS: AppItem[] = [
  { icon: 'edit_note', iconColor: '#007AFF', name: '周报自动生成', desc: '自定义应用 · 2小时前更新' },
  { icon: 'inventory_2', iconColor: '#34C759', name: '库存快速查询', desc: '自定义应用 · 昨天' },
];

const RECENT_APPS: AppItem[] = [
  { icon: 'event_busy', iconColor: '#AF52DE', name: '请假申请', desc: '人事服务 · v2.4' },
  { icon: 'receipt_long', iconColor: '#34C759', name: '报销审批', desc: '财务 · v1.8' },
  { icon: 'fact_check', iconColor: '#007AFF', name: '审批中心', desc: '管理 · v3.1' },
];

const SECTIONS: AppSection[] = [
  {
    title: '办公工具',
    apps: [
      { icon: 'meeting_room', iconColor: '#007AFF', name: '会议室预订' },
      { icon: 'print', iconColor: '#5856D6', name: '云打印' },
      { icon: 'flight', iconColor: '#FF9500', name: '差旅管理' },
      { icon: 'badge', iconColor: '#34C759', name: '访客登记' },
      { icon: 'menu_book', iconColor: '#007AFF', name: '知识库' },
      { icon: 'quiz', iconColor: '#FF2D55', name: '问卷调查' },
    ],
  },
  {
    title: '人事服务',
    apps: [
      { icon: 'payments', iconColor: '#FF9500', name: '工资条' },
      { icon: 'card_giftcard', iconColor: '#FF2D55', name: '员工福利' },
      { icon: 'school', iconColor: '#5856D6', name: '学习中心' },
      { icon: 'fingerprint', iconColor: '#007AFF', name: '考勤打卡' },
      { icon: 'health_and_safety', iconColor: '#34C759', name: '健康保障' },
      { icon: 'group_add', iconColor: '#FF9500', name: '内部推荐' },
    ],
  },
];

const IT_SERVICES = [
  { icon: 'help_center', iconColor: '#fff', name: 'IT 服务台', desc: '创建工单或咨询在线支持', dark: true },
  { icon: 'lock_reset', iconColor: '#FF3B30', name: '密码重置', desc: '自助凭据管理服务', dark: false },
  { icon: 'devices_other', iconColor: '#34C759', name: '硬件申领', desc: '申请办公设备或故障维修', dark: false },
];

interface AppCenterPageProps {
  isAdmin?: boolean;
}

export function AppCenterPage({ isAdmin = true }: AppCenterPageProps) {
  const [activeKey, setActiveKey] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const toast = (msg: string) => useToastStore.getState().addToast(msg, 'info');

  const allCategories = [...CATEGORIES, ...CATEGORY_GROUPS];
  const activeLabel = allCategories.find((c) => c.key === activeKey)?.label ?? '全部应用';

  // Filter sections by active category
  const visibleSections = activeKey === 'all' || activeKey === 'recent' || activeKey === 'favorites'
    ? SECTIONS
    : SECTIONS.filter((s) => s.title === allCategories.find((c) => c.key === activeKey)?.label);

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar */}
      <div className="w-56 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">轻应用</h3>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索应用…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          <div className="px-3 pt-2 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">合集</span>
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveKey(cat.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeKey === cat.key ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          ))}

          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">分类</span>
          </div>
          {CATEGORY_GROUPS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveKey(cat.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeKey === cat.key ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb + action */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>轻应用</span>
            <Icon name="chevron_right" size={14} />
            <span className="text-text-primary font-medium">{activeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSubView('apps:create')}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Icon name="add" size={14} />
            {isAdmin ? '创建我的应用' : '申请新应用'}
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* My Creations (admin only) */}
          {isAdmin && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-text-primary">我的创作</h3>
                <span className="px-2 py-0.5 text-[9px] font-medium text-primary bg-primary/10 rounded-full">AI 辅助</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MY_CREATIONS.map((app) => (
                  <div key={app.name} onClick={() => toast(`已打开「${app.name}」编辑器`)} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${app.iconColor}15` }}>
                      <Icon name={app.icon} size={20} style={{ color: app.iconColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{app.name}</p>
                      <p className="text-[10px] text-text-muted">{app.desc}</p>
                    </div>
                    <span className="px-1.5 py-0.5 text-[8px] font-medium text-success bg-success/10 rounded">Edit with AI</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary">最近使用</h3>
              <button type="button" onClick={() => setActiveKey('recent')} className="text-xs text-primary hover:underline">查看全部</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {RECENT_APPS.map((app) => (
                <div key={app.name} onClick={() => toast(`正在打开「${app.name}」(${app.desc})`)} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${app.iconColor}15` }}>
                    <Icon name={app.icon} size={20} style={{ color: app.iconColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.name}</p>
                    <p className="text-[10px] text-text-muted">{app.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Category grids */}
          {visibleSections.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-bold text-text-primary mb-3">{section.title}</h3>
              <div className="grid grid-cols-6 gap-3">
                {section.apps.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => toast(`「${app.name}」已启动，请稍候...`)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-bg-hover/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${app.iconColor}12` }}>
                      <Icon name={app.icon} size={24} style={{ color: app.iconColor }} />
                    </div>
                    <span className="text-xs text-text-primary">{app.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {/* IT Services */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">IT 服务</h3>
            <div className="grid grid-cols-3 gap-3">
              {IT_SERVICES.map((svc) => (
                <div
                  key={svc.name}
                  onClick={() => toast(`正在跳转「${svc.name}」— ${svc.desc}`)}
                  className={`p-4 rounded-xl cursor-pointer transition-shadow hover:shadow-md ${
                    svc.dark ? 'bg-surface-dark text-white' : 'bg-fill-tertiary/20 border border-border'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${svc.dark ? 'bg-white/10' : ''}`}
                    style={!svc.dark ? { backgroundColor: `${svc.iconColor}15` } : undefined}
                  >
                    <Icon name={svc.icon} size={22} style={{ color: svc.iconColor }} />
                  </div>
                  <p className={`text-sm font-semibold ${svc.dark ? '' : 'text-text-primary'}`}>{svc.name}</p>
                  <p className={`text-[11px] mt-1 ${svc.dark ? 'text-white/60' : 'text-text-muted'}`}>{svc.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
