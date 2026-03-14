/**
 * KnowledgeAdminPage — 知识库管理员视图 (km_10 对齐)
 * 顶部tab + ADMIN VIEW badge + 最近更新卡片区 + 全量资产明细表 + 分页器
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';

interface AssetRow {
  name: string;
  owner: string;
  modified: string;
  permission: string;
  permissionIcon: string;
  permissionColor: string;
  status: string;
  statusColor: string;
}

const NAV_ITEMS = [
  { key: 'standard', label: '标准流程', icon: 'account_tree', subView: null },
  { key: 'dept', label: '部门资产', icon: 'folder_shared', subView: 'knowledge:dept-assets' },
  { key: 'official', label: '官方指南', icon: 'verified', subView: null },
];

const ADMIN_NAV = [
  { key: 'storage', label: '容量管理', icon: 'storage', subView: 'knowledge:storage' },
  { key: 'audit', label: '审核日志', icon: 'rule', subView: 'knowledge:audit-log' },
];

const RECENT_UPDATES = [
  { name: '企业差旅报销管理制度', icon: 'description', color: '#007AFF', tag: '财务', updatedBy: '张经理', time: '2小时前' },
  { name: '客户满意度调研数据', icon: 'table_chart', color: '#34C759', tag: '客服', updatedBy: '王琳', time: '5小时前' },
  { name: '前端代码审查 Checklist', icon: 'code', color: '#5856D6', tag: '技术', updatedBy: '林静', time: '昨天' },
];

const ASSET_ROWS: AssetRow[] = [
  { name: '企业差旅报销管理制度_2024版', owner: '财务部', modified: '2024-05-20', permission: '全员可见', permissionIcon: 'public', permissionColor: '#8E8E93', status: '已发布', statusColor: '#34C759' },
  { name: '2024年客户满意度调研原始数据', owner: '客服中心', modified: '2024-05-15', permission: '限制访问', permissionIcon: 'lock', permissionColor: '#FF9500', status: '审核中', statusColor: '#FF9500' },
  { name: '采购合同模板(通用版)', owner: '法务部', modified: '2024-05-10', permission: '部门内部', permissionIcon: 'groups', permissionColor: '#007AFF', status: '已发布', statusColor: '#34C759' },
];

type TopTab = 'enterprise' | 'personal' | 'org';

export function KnowledgeAdminPage({ onClose }: { onClose?: () => void }) {
  const [topTab, setTopTab] = useState<TopTab>('org');
  const [search, setSearch] = useState('');

  const filteredAssets = ASSET_ROWS.filter((r) => !search || r.name.includes(search) || r.owner.includes(search));

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar */}
      <div className="w-56 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          {onClose && (
            <button type="button" onClick={onClose} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary mb-2">
              <Icon name="arrow_back" size={16} /> 返回
            </button>
          )}
          <h3 className="text-sm font-semibold text-text-primary">知识库管理</h3>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5">
          <div className="px-3 pt-1 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">企业知识库</span>
          </div>
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={() => item.subView ? useUIStore.getState().setSubView(item.subView as any) : useToastStore.getState().addToast(`${item.label}页面开发中`, 'info')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                i === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}

          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">系统管理</span>
          </div>
          {ADMIN_NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => useUIStore.getState().setSubView(item.subView as any)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-bg-hover"
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-border">
          <div className="flex items-center gap-1">
            {([
              { key: 'enterprise', label: '企业知识' },
              { key: 'personal', label: '个人主页' },
              { key: 'org', label: '组织资产' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTopTab(tab.key)}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  topTab === tab.key
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[9px] font-bold text-white bg-primary rounded-full tracking-wider">
              ADMIN VIEW
            </span>
            <button type="button" onClick={() => useToastStore.getState().addToast('新建内容功能开发中', 'info')} className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5 font-medium">
              <Icon name="add" size={14} /> 新建内容
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <h2 className="text-base font-bold text-text-primary">组织资产</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索资产…"
                className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button type="button" onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')} className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5">
              <Icon name="filter_list" size={14} /> 筛选
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('报表分析功能开发中', 'info')} className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5">
              <Icon name="analytics" size={14} /> 报表分析
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Recent updates card area */}
          <div className="grid grid-cols-4 gap-4">
            {RECENT_UPDATES.map((item) => (
              <div key={item.name} className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer" onClick={() => useUIStore.getState().setSubView('knowledge:doc-read')}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${item.color}12` }}>
                  <Icon name={item.icon} size={20} style={{ color: item.color }} />
                </div>
                <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                <p className="text-[11px] text-text-muted mt-1">{item.tag} · {item.updatedBy} · {item.time}</p>
              </div>
            ))}
            {/* Dark stat card */}
            <div className="p-4 rounded-xl bg-surface-dark text-white flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-white/60 mb-1">本月组织新增</p>
                <p className="text-3xl font-bold">128</p>
                <p className="text-[10px] text-white/50 mt-1">件知识资产</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-success">
                <Icon name="trending_up" size={12} /> +12.4%
              </div>
            </div>
          </div>

          {/* Asset table */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">全量资产明细</h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-fill-tertiary/20">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">文件名</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">所有部门</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">最后修改</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted bg-primary/5">全局权限(管理)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">状态</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((row) => (
                    <tr key={row.name} className="border-b border-border/30 hover:bg-bg-hover/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon name="description" size={16} className="text-primary" />
                          <span className="text-sm text-text-primary">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{row.owner}</td>
                      <td className="px-3 py-2.5 text-xs text-text-muted">{row.modified}</td>
                      <td className="px-3 py-2.5 bg-primary/5">
                        <button type="button" onClick={() => useToastStore.getState().addToast('权限设置功能开发中', 'info')} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border hover:bg-bg-hover text-xs text-text-secondary">
                          <Icon name={row.permissionIcon} size={14} style={{ color: row.permissionColor }} />
                          {row.permission}
                          <Icon name="expand_more" size={14} className="text-text-muted" />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md" style={{ color: row.statusColor, backgroundColor: `${row.statusColor}15` }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => useToastStore.getState().addToast('文档详情功能开发中', 'info')} className="px-2.5 py-1 text-[11px] text-primary border border-primary/20 rounded-lg hover:bg-primary/5 font-medium">
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">显示 1-3 个文档，共 1,245 个</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-md border border-border text-text-muted hover:bg-bg-hover flex items-center justify-center">
                <Icon name="chevron_left" size={14} />
              </button>
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')}
                  className={`w-7 h-7 rounded-md text-xs font-medium flex items-center justify-center ${
                    p === 1 ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="text-xs text-text-muted px-1">...</span>
              <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-md border border-border text-xs text-text-secondary hover:bg-bg-hover flex items-center justify-center">
                128
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-md border border-border text-text-muted hover:bg-bg-hover flex items-center justify-center">
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
