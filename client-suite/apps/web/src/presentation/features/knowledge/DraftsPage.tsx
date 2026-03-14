/**
 * DraftsPage — 我的草稿/阅读清单/收藏夹列表 (km_3 对齐)
 * 搜索框 + 批量操作栏 + 表格 + 分页器
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';

interface Draft {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  lastSaved: string;
}

const MOCK_DRAFTS: Draft[] = [
  { id: 'd1', title: '2024 Q3 项目执行方案', subtitle: '包含预算分配和时间节点规划', category: '企业知识库', lastSaved: '10分钟前' },
  { id: 'd2', title: '新员工入职培训手册 v3', subtitle: 'HR部门培训流程标准化文档', category: '部门资产', lastSaved: '2小时前' },
  { id: 'd3', title: '产品路线图 2025', subtitle: '下一财年的产品规划和里程碑', category: '个人空间', lastSaved: '昨天 16:30' },
  { id: 'd4', title: 'API 接口文档 - 用户模块', subtitle: 'RESTful API 设计规范与示例', category: '企业知识库', lastSaved: '3天前' },
];

const MOCK_READING_LIST: Draft[] = [
  { id: 'r1', title: '微服务架构设计模式', subtitle: '分布式系统的核心设计原则', category: '技术资料', lastSaved: '加入于 2天前' },
  { id: 'r2', title: '2025 行业趋势报告', subtitle: '数字化转型趋势分析', category: '行业资讯', lastSaved: '加入于 5天前' },
  { id: 'r3', title: 'Kubernetes 最佳实践', subtitle: '容器编排与集群管理指南', category: '技术资料', lastSaved: '加入于 1周前' },
];

const MOCK_FAVORITES: Draft[] = [
  { id: 'f1', title: '公司技术栈规范 v2', subtitle: '统一技术选型标准文档', category: '企业知识库', lastSaved: '收藏于 1天前' },
  { id: 'f2', title: '新人入职指南', subtitle: '快速了解公司文化和工作流程', category: '部门资产', lastSaved: '收藏于 3天前' },
  { id: 'f3', title: '产品设计规范', subtitle: 'UI/UX 设计系统和组件库文档', category: '企业知识库', lastSaved: '收藏于 1周前' },
  { id: 'f4', title: '季度 OKR 模板', subtitle: '目标与关键成果制定模板', category: '个人空间', lastSaved: '收藏于 2周前' },
];

type DraftsMode = 'drafts' | 'reading-list' | 'favorites';

const MODE_CONFIG: Record<DraftsMode, { title: string; countLabel: string; actionLabel: string; timeLabel: string; data: Draft[] }> = {
  drafts: { title: '我的草稿', countLabel: '份草稿', actionLabel: '新建草稿', timeLabel: '最后保存', data: MOCK_DRAFTS },
  'reading-list': { title: '阅读清单', countLabel: '篇文章', actionLabel: '添加文章', timeLabel: '加入时间', data: MOCK_READING_LIST },
  favorites: { title: '收藏夹', countLabel: '个收藏', actionLabel: '浏览知识库', timeLabel: '收藏时间', data: MOCK_FAVORITES },
};

interface DraftsPageProps {
  mode?: DraftsMode;
  onBack?: () => void;
}

export function DraftsPage({ mode = 'drafts', onBack }: DraftsPageProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const config = MODE_CONFIG[mode];
  const items = config.data;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((d) => d.id)));
  };

  const filtered = items.filter(
    (d) => d.title.toLowerCase().includes(search.toLowerCase()) || d.subtitle.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {onBack && (
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 px-6 pt-3">
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{config.title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{items.length} {config.countLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`搜索${config.title}...`}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSubView('knowledge:doc-editor')}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Icon name="add" size={16} />
            {config.actionLabel}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-primary/5 border-b border-border">
          <span className="text-xs font-medium text-primary">已选择 {selected.size} 项</span>
          <button type="button" onClick={() => useToastStore.getState().addToast(`已删除 ${selected.size} 项`, 'info')} className="text-xs text-text-secondary hover:text-primary font-medium">批量删除</button>
          {mode === 'drafts' && (
            <button type="button" onClick={() => useToastStore.getState().addToast(`已发布 ${selected.size} 项`, 'success')} className="text-xs text-text-secondary hover:text-primary font-medium">直接发布</button>
          )}
          {mode === 'reading-list' && (
            <button type="button" onClick={() => useToastStore.getState().addToast(`已标记 ${selected.size} 项为已读`, 'info')} className="text-xs text-text-secondary hover:text-primary font-medium">标记已读</button>
          )}
          {mode === 'favorites' && (
            <button type="button" onClick={() => useToastStore.getState().addToast(`已取消 ${selected.size} 项收藏`, 'info')} className="text-xs text-text-secondary hover:text-primary font-medium">取消收藏</button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-text-muted hover:text-text-primary ml-auto">
            取消选择
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-fill-tertiary/30 text-left">
              <th className="px-6 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">文档标题</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">所属分类</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">{config.timeLabel}</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((draft) => (
              <tr key={draft.id} className="border-b border-border/50 hover:bg-bg-hover/30 transition-colors">
                <td className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(draft.id)}
                    onChange={() => toggleSelect(draft.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-medium text-text-primary">{draft.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{draft.subtitle}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-text-secondary">{draft.category}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-text-muted">{draft.lastSaved}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {mode === 'drafts' && (
                      <>
                        <button type="button" onClick={() => useUIStore.getState().setSubView('knowledge:doc-editor')} className="text-xs text-primary font-medium hover:text-primary/80">继续编辑</button>
                        <button type="button" onClick={() => useToastStore.getState().addToast(`已删除「${draft.title}」`, 'info')} className="text-xs text-text-muted hover:text-error font-medium">删除</button>
                      </>
                    )}
                    {mode === 'reading-list' && (
                      <>
                        <button type="button" onClick={() => useUIStore.getState().setSubView('knowledge:doc-read')} className="text-xs text-primary font-medium hover:text-primary/80">阅读</button>
                        <button type="button" onClick={() => useToastStore.getState().addToast(`已从阅读清单移除「${draft.title}」`, 'info')} className="text-xs text-text-muted hover:text-error font-medium">移除</button>
                      </>
                    )}
                    {mode === 'favorites' && (
                      <>
                        <button type="button" onClick={() => useUIStore.getState().setSubView('knowledge:doc-read')} className="text-xs text-primary font-medium hover:text-primary/80">查看</button>
                        <button type="button" onClick={() => useToastStore.getState().addToast(`已取消收藏「${draft.title}」`, 'info')} className="text-xs text-text-muted hover:text-error font-medium">取消收藏</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border">
        <span className="text-xs text-text-muted">显示 1-{filtered.length} 个文档，共 {items.length} 个</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:bg-bg-hover">
            <Icon name="chevron_left" size={14} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="px-2.5 py-1 text-xs rounded bg-primary text-white font-medium">1</button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:bg-bg-hover">
            <Icon name="chevron_right" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
