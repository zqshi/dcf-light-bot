/**
 * StorageManagementPage — 容量管理综合工作台 (km_16 对齐)
 * 存储利用率环形图 + 容量卡片 + 部门占比柱状图 + 增长趋势 + 大文件排行表
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { useToastStore } from '../../../application/stores/toastStore';

interface DeptStorage {
  name: string;
  nameEn: string;
  sizeGB: number;
  percent: number;
  color: string;
}

const DEPT_STORAGE: DeptStorage[] = [
  { name: '研发中心', nameEn: 'Engineering', sizeGB: 850, percent: 42, color: '#007AFF' },
  { name: '市场部', nameEn: 'Marketing', sizeGB: 420, percent: 21, color: '#34C759' },
  { name: '销售部', nameEn: 'Sales', sizeGB: 310, percent: 15, color: '#FF9500' },
  { name: '行政/人力资源', nameEn: 'Admin/HR', sizeGB: 220, percent: 11, color: '#5856D6' },
];

interface LargeFile {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  owner: string;
  ownerDept: string;
  ownerAvatar: string;
  sizeGB: number;
  location: string;
}

const LARGE_FILES: LargeFile[] = [
  { id: 'lf1', name: '2024_周年庆典全景高清录像.mp4', icon: 'movie', iconColor: '#007AFF', owner: '张晓明', ownerDept: '品牌部', ownerAvatar: '张', sizeGB: 12.4, location: '组织资产 / 品牌宣传 / 视频素材' },
  { id: 'lf2', name: 'customer_behavior_logs_2023_backup.sql', icon: 'storage', iconColor: '#FF9500', owner: '系统管理员', ownerDept: '', ownerAvatar: '系', sizeGB: 8.2, location: '系统管理 / 备份归档 / 历史数据' },
  { id: 'lf3', name: '产品设计全量源文件_Sketch_Backup.zip', icon: 'folder_zip', iconColor: '#34C759', owner: '陈思思', ownerDept: '设计部', ownerAvatar: '陈', sizeGB: 5.7, location: '部门资产 / 设计中心 / 归档素材' },
];

interface StorageManagementPageProps {
  onClose?: () => void;
}

export function StorageManagementPage({ onClose }: StorageManagementPageProps) {
  const [fileFilter, setFileFilter] = useState<'all' | 'unused'>('all');
  const [fileSearch, setFileSearch] = useState('');

  const filteredFiles = LARGE_FILES.filter((f) => {
    if (fileSearch && !f.name.includes(fileSearch) && !f.owner.includes(fileSearch) && !f.ownerDept.includes(fileSearch)) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {onClose && (
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 px-6 pt-3">
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-bg-white-var/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">容量管理综合工作台</h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10">
            <Icon name="warning" size={14} className="text-warning" />
            <span className="text-[11px] font-medium text-warning">当前使用率达到 75% 警戒值</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('报告导出功能开发中', 'info')} className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover">
            报告导出
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('扩容申请功能开发中', 'info')} className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5">
            <Icon name="expand_less" size={14} /> 申请扩容
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Top stats row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Usage ring */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5 flex flex-col items-center">
            <p className="text-xs text-text-muted mb-3">当前存储利用率</p>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E5EA"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="3"
                  strokeDasharray="75, 100"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-text-primary">75%</span>
                <span className="text-[10px] text-text-muted">已使用</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-2">
              健康状态：<span className="text-warning">一般</span>
            </p>
          </div>

          {/* Total */}
          <StatCard icon="cloud" iconColor="#007AFF" badge="TOTAL" label="总容量" value="2.00" unit="TB" />
          {/* Used */}
          <StatCard icon="donut_large" iconColor="#FF9500" badge="USED" label="已用空间" value="1.50" unit="TB" sub="+500GB 上月扩容" subColor="#34C759" />
          {/* Free */}
          <StatCard icon="check_circle" iconColor="#34C759" badge="FREE" label="可用空间" value="512" unit="GB" sub="预计还可使用 41 天" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Dept storage breakdown */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="bar_chart" size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">部门存储占比 (Administrative Context)</h3>
              </div>
              <button type="button" onClick={() => useToastStore.getState().addToast('详情展开功能开发中', 'info')} className="p-1 text-text-muted hover:text-primary">
                <Icon name="open_in_new" size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {DEPT_STORAGE.map((dept) => (
                <div key={dept.nameEn}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{dept.name} ({dept.nameEn})</span>
                    <span className="text-xs font-medium text-text-primary">{dept.sizeGB} GB ({dept.percent}%)</span>
                  </div>
                  <div className="h-2 bg-fill-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${dept.percent}%`, backgroundColor: dept.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Growth trend */}
          <div className="bg-bg-white-var rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="trending_up" size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">存储增长趋势 (Growth Trend - 30天)</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] text-text-muted">预测增长</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {[30, 35, 40, 38, 45, 50, 55, 60, 65, 72, 78, 85].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm ${i >= 10 ? 'bg-primary/30 border border-dashed border-primary' : 'bg-primary'}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-text-muted">04-20</span>
              <span className="text-[9px] text-text-muted">05-10</span>
              <span className="text-[9px] text-text-muted">TODAY</span>
              <span className="text-[9px] text-primary font-medium">PREDICTION</span>
            </div>
          </div>
        </div>

        {/* Large files table */}
        <div className="bg-bg-white-var rounded-2xl border border-border">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <Icon name="lens" size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">大文件/大占用排行 (Top Space Consumers)</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="搜索文件名..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var w-40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFileFilter('all')}
                  className={`px-3 py-1.5 text-[11px] font-medium ${fileFilter === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  所有文件
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('unused')}
                  className={`px-3 py-1.5 text-[11px] font-medium ${fileFilter === 'unused' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                >
                  长期未用
                </button>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-fill-tertiary/30 text-left">
                <th className="px-5 py-2.5 text-[11px] font-medium text-text-muted">文件名 (FILE NAME)</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">所有者 (OWNER)</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">占用大小 (SIZE)</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">存储路径 (LOCATION)</th>
                <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr key={file.id} className="border-t border-border/50 hover:bg-bg-hover/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Icon name={file.icon} size={18} style={{ color: file.iconColor }} />
                      <span className="text-xs font-medium text-text-primary">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar letter={file.ownerAvatar} size={24} />
                      <div>
                        <span className="text-xs text-text-primary">{file.owner}</span>
                        {file.ownerDept && <p className="text-[10px] text-text-muted">({file.ownerDept})</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-text-primary">{file.sizeGB} GB</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-primary">{file.location}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => useToastStore.getState().addToast('文件操作菜单开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary">
                      <Icon name="more_horiz" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  badge,
  label,
  value,
  unit,
  sub,
  subColor,
}: {
  icon: string;
  iconColor: string;
  badge: string;
  label: string;
  value: string;
  unit: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-bg-white-var rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconColor + '14' }}>
          <Icon name={icon} size={20} style={{ color: iconColor }} />
        </div>
        <span className="text-[10px] font-bold text-text-muted tracking-wider">{badge}</span>
      </div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        <span className="text-sm text-text-muted">{unit}</span>
      </div>
      {sub && (
        <p className={`text-[10px] mt-1.5 ${subColor ? '' : 'text-text-secondary'}`} style={subColor ? { color: subColor } : undefined}>
          {sub.startsWith('+') && <span>↑ </span>}{sub}
        </p>
      )}
    </div>
  );
}
