/**
 * AdminAssetTable — 知识库管理员视图 全量资产明细表 (km_10 对齐)
 * 表头：文件名 / 所有部门 / 最后修改 / 全局权限(管理) / 状态 / 操作
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

type Permission = 'public' | 'restricted' | 'all-read';
type DocStatus = 'published' | 'archived';

interface AdminAsset {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  department: string;
  lastModified: string;
  permission: Permission;
  status: DocStatus;
}

const PERMISSION_META: Record<Permission, { label: string; icon: string; color: string }> = {
  public: { label: '公开文档', icon: 'public', color: '#34C759' },
  restricted: { label: '仅限管理', icon: 'lock', color: '#FF3B30' },
  'all-read': { label: '全员可读', icon: 'group', color: '#007AFF' },
};

const STATUS_META: Record<DocStatus, { label: string; color: string }> = {
  published: { label: '已发布', color: '#007AFF' },
  archived: { label: '归档中', color: '#FF9500' },
};

const MOCK_ADMIN_ASSETS: AdminAsset[] = [
  { id: 'aa1', name: '企业差旅报销管理制度_2024版', icon: 'description', iconColor: '#007AFF', department: '财务部', lastModified: '2024-05-20', permission: 'public', status: 'published' },
  { id: 'aa2', name: '2024年客户满意度调研原始数据', icon: 'insert_chart', iconColor: '#FF9500', department: '客服中心', lastModified: '2024-05-15', permission: 'restricted', status: 'archived' },
  { id: 'aa3', name: '办公设备采购合同模板', icon: 'description', iconColor: '#007AFF', department: '行政部', lastModified: '2024-05-10', permission: 'all-read', status: 'published' },
];

export function AdminAssetTable() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="inventory_2" size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-text-primary">全量资产明细</h3>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')} className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover">
            <Icon name="filter_list" size={18} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('导出功能开发中', 'info')} className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover">
            <Icon name="download" size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fill-tertiary/30 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">文件名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">所有部门</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">最后修改</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-primary">全局权限 (管理)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">状态</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_ASSETS.map((asset) => {
              const perm = PERMISSION_META[asset.permission];
              const stat = STATUS_META[asset.status];
              return (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Icon name={asset.icon} size={18} style={{ color: asset.iconColor }} />
                      <span className="text-sm font-medium text-text-primary">{asset.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-text-secondary">{asset.department}</td>
                  <td className="px-4 py-3.5 text-sm text-text-secondary">{asset.lastModified}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Icon name={perm.icon} size={14} style={{ color: perm.color }} />
                      <span className="text-xs text-text-primary">{perm.label}</span>
                      <Icon name="expand_more" size={14} className="text-text-muted" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded"
                      style={{ color: stat.color, backgroundColor: `${stat.color}14` }}
                    >
                      {stat.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => useToastStore.getState().addToast('编辑功能开发中', 'info')} className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/5">
                        <Icon name="edit" size={16} />
                      </button>
                      <button type="button" onClick={() => useToastStore.getState().addToast('操作菜单开发中', 'info')} className="p-1 rounded text-text-muted hover:text-text-secondary">
                        <Icon name="more_horiz" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-text-muted px-1">
        <span>显示 1 - 3 个文档，共 1,245 个</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <Icon name="chevron_left" size={16} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-lg bg-primary text-white text-xs font-medium flex items-center justify-center">
            1
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-lg hover:bg-bg-hover text-text-secondary text-xs flex items-center justify-center">
            2
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="w-7 h-7 rounded-lg hover:bg-bg-hover text-text-secondary text-xs flex items-center justify-center">
            3
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('分页功能开发中', 'info')} className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <Icon name="chevron_right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Stats card shown in the recent section */
export function OrgStatsCard() {
  return (
    <div className="bg-surface-dark rounded-xl p-5 flex flex-col justify-between min-h-[180px] text-white">
      <div>
        <p className="text-xs text-white/60">本月组织新增</p>
        <p className="text-3xl font-bold mt-1">128 件</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60">报表分析</span>
        <button type="button" onClick={() => useToastStore.getState().addToast('数据分析功能开发中', 'info')} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <Icon name="bar_chart" size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
