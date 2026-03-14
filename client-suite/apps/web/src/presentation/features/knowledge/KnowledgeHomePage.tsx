/**
 * KnowledgeHomePage — 知识库入口主页 (km_5 对齐)
 * 左侧: 分类导航 (企业知识库/个人空间) w-64
 * 右侧: 企业知识/个人主页 segment control + 最近文件卡片 + 所有文档表格
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';

interface RecentFile {
  name: string;
  time: string;
  tag: string;
  tagIcon: string;
  tagColor: string;
  iconColor: string;
}

interface DocRow {
  name: string;
  owner: string;
  modified: string;
  permission: string;
  permissionColor: string;
}

const NAV_ENTERPRISE = [
  { key: 'standard', label: '标准流程', icon: 'account_tree' },
  { key: 'dept', label: '部门资产', icon: 'folder_shared' },
  { key: 'official', label: '官方指南', icon: 'verified' },
];

const NAV_PERSONAL = [
  { key: 'drafts', label: '我的草稿', icon: 'edit_note', badge: 12 },
  { key: 'reading', label: '阅读清单', icon: 'bookmarks' },
];

const RECENT_FILES: RecentFile[] = [
  { name: '2024 Q3 产品设计规范', time: '10分钟前 · 陈一鸣', tag: '团队', tagIcon: 'groups', tagColor: '#007AFF', iconColor: '#007AFF' },
  { name: '技术部内部培训文档', time: '2小时前 · 我', tag: '个人', tagIcon: 'person', tagColor: '#34C759', iconColor: '#34C759' },
  { name: '员工入职标准操作流程 (SOP)', time: '昨天 15:42 · 人力资源部', tag: '团队', tagIcon: 'groups', tagColor: '#007AFF', iconColor: '#FF9500' },
  { name: '品牌视觉更新提案.pptx', time: '3天前 · 市场部', tag: '团队', tagIcon: 'groups', tagColor: '#007AFF', iconColor: '#FF3B30' },
];

const DOC_ROWS: DocRow[] = [
  { name: '企业差旅报销管理制度_2024版', owner: '财务部', modified: '2024-05-20', permission: '所有人可见', permissionColor: '#8E8E93' },
  { name: '前端代码审查 Checklist', owner: '林静', modified: '2024-05-18', permission: '部门内部', permissionColor: '#007AFF' },
  { name: '2024年客户满意度调研原始数据', owner: '客服中心', modified: '2024-05-15', permission: '限制访问', permissionColor: '#FF9500' },
  { name: '办公设备采购合同模板', owner: '行政部', modified: '2024-05-10', permission: '所有人可见', permissionColor: '#8E8E93' },
];

export function KnowledgeHomePage() {
  const [activeNav, setActiveNav] = useState('standard');
  const [activeTab, setActiveTab] = useState<'enterprise' | 'personal'>('enterprise');
  const [search, setSearch] = useState('');
  const setSubView = useUIStore((s) => s.setSubView);

  const filteredRecentFiles = RECENT_FILES.filter((f) => !search || f.name.includes(search));
  const filteredDocRows = DOC_ROWS.filter((d) => !search || d.name.includes(search) || d.owner.includes(search));

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar — w-64 per km_5 */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xl font-bold text-text-primary">知识库</h3>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {/* Segment control */}
          <div className="mx-2 mb-3 p-0.5 bg-fill-tertiary/40 rounded-lg flex">
            <button
              type="button"
              onClick={() => setActiveTab('enterprise')}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                activeTab === 'enterprise' ? 'bg-bg-white-var shadow-sm text-text-primary' : 'text-text-muted'
              }`}
            >
              企业知识
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                activeTab === 'personal' ? 'bg-bg-white-var shadow-sm text-text-primary' : 'text-text-muted'
              }`}
            >
              个人主页
            </button>
          </div>

          <div className="px-3 pt-1 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">企业知识库</span>
          </div>
          {NAV_ENTERPRISE.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveNav(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeNav === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}

          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">个人空间</span>
          </div>
          {NAV_PERSONAL.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveNav(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeNav === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={item.icon} size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[9px] bg-fill-tertiary/50 text-text-muted rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <h2 className="text-base font-bold text-text-primary">
            {activeTab === 'enterprise' ? '企业知识' : '个人主页'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索文档、流程或资产…"
                className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button type="button" onClick={() => setSubView('knowledge:doc-editor')} className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5">
              <Icon name="add" size={14} /> 新建
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Recent files */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary">最近文件</h3>
              <button type="button" onClick={() => setSubView('knowledge:file-list')} className="text-xs text-primary hover:underline">查看全部</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {filteredRecentFiles.map((file) => (
                <div key={file.name} onClick={() => setSubView('knowledge:doc-read')} className="p-3 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer">
                  <div
                    className="w-full h-24 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `linear-gradient(135deg, ${file.iconColor}08, ${file.iconColor}15)` }}
                  >
                    <Icon name="description" size={32} style={{ color: file.iconColor }} />
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">{file.name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-text-muted truncate">{file.time}</span>
                    <span
                      className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-medium rounded"
                      style={{ color: file.tagColor, backgroundColor: `${file.tagColor}15` }}
                    >
                      <Icon name={file.tagIcon} size={10} />
                      {file.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* All documents table */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="list_alt" size={16} className="text-text-muted" />
              <h3 className="text-sm font-bold text-text-primary">所有文档</h3>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-fill-tertiary/20">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">文件名</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">所有者</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">最后修改日期</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">权限</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocRows.map((doc) => (
                    <tr key={doc.name} className="border-b border-border/30 hover:bg-bg-hover/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon name="description" size={16} className="text-primary" />
                          <span className="text-sm text-text-primary">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{doc.owner}</td>
                      <td className="px-3 py-2.5 text-xs text-text-muted">{doc.modified}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{ color: doc.permissionColor, backgroundColor: `${doc.permissionColor}15` }}
                        >
                          {doc.permission}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => useToastStore.getState().addToast('文件操作菜单开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary">
                          <Icon name="more_horiz" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
