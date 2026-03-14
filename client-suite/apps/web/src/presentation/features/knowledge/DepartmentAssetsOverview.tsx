/**
 * DepartmentAssetsOverview — 部门资产总览 (km_6 对齐)
 * 标题+副标题 + 部门文件夹卡片网格(4列) + 管理权限概览(浅色卡片)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { DepartmentPermissionModal } from './DepartmentPermissionModal';
import { AccessRestrictedModal } from './AccessRestrictedModal';

interface DeptFolder {
  id: string;
  name: string;
  nameEn: string;
  fileCount: number;
  updatedAt: string;
  color: string;
}

const FOLDER_COLORS = ['#007AFF', '#FF9500', '#5856D6', '#34C759', '#FF3B30', '#8E8E93'];

const MOCK_FOLDERS: DeptFolder[] = [
  { id: 'dept-finance', name: '财务部', nameEn: 'Finance', fileCount: 128, updatedAt: '3小时前更新', color: FOLDER_COLORS[0] },
  { id: 'dept-marketing', name: '市场部', nameEn: 'Marketing', fileCount: 215, updatedAt: '5小时前更新', color: FOLDER_COLORS[1] },
  { id: 'dept-rd', name: '研发部', nameEn: 'R&D', fileCount: 1204, updatedAt: '1小时前更新', color: FOLDER_COLORS[2] },
  { id: 'dept-hr', name: '人力资源', nameEn: 'HR', fileCount: 86, updatedAt: '昨天更新', color: FOLDER_COLORS[3] },
  { id: 'dept-product', name: '产品中心', nameEn: 'Product', fileCount: 452, updatedAt: '2天前更新', color: FOLDER_COLORS[4] },
  { id: 'dept-legal', name: '法务合规', nameEn: 'Legal', fileCount: 45, updatedAt: '1周前更新', color: FOLDER_COLORS[5] },
];

const ADMIN_OVERVIEW = [
  { label: '全局合规性审查', desc: '当前所有部门文件夹均符合企业安全等级要求，无违规文件。', icon: 'verified_user', color: '#34C759' },
  { label: '存储容量预警', desc: '组织总存储使用率已达 85%，建议清理归档过期文件或申请扩容。', icon: 'storage', color: '#FF9500' },
  { label: '权限下放状态', desc: '已向 12 名部门负责人授予独立的文件管理与审批权限，符合最小权限原则。', icon: 'admin_panel_settings', color: '#007AFF' },
];

interface DepartmentAssetsOverviewProps {
  onFolderClick?: (folderId: string) => void;
  onClose?: () => void;
}

export function DepartmentAssetsOverview({ onFolderClick, onClose }: DepartmentAssetsOverviewProps) {
  const [showPermModal, setShowPermModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [search, setSearch] = useState('');

  const filteredFolders = MOCK_FOLDERS.filter((f) => !search || f.name.includes(search) || f.nameEn.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
    <DepartmentPermissionModal open={showPermModal} onClose={() => setShowPermModal(false)} />
    <AccessRestrictedModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* Back */}
      {onClose && (
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Header: title + subtitle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-text-primary">部门资产管理</h2>
          <p className="text-sm text-text-muted mt-1">管理各业务部门的私有及共享知识空间</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索部门或文件…"
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button type="button" onClick={() => useToastStore.getState().addToast('新建文件夹功能开发中', 'info')} className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5 font-medium">
            <Icon name="create_new_folder" size={14} /> 新建文件夹
          </button>
        </div>
      </div>

      {/* Folder grid header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">部门资产预览</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => useToastStore.getState().addToast('已切换到网格视图', 'info')} className="p-1.5 rounded-md text-text-secondary hover:bg-bg-hover">
              <Icon name="grid_view" size={18} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('已切换到列表视图', 'info')} className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover">
              <Icon name="view_list" size={18} />
            </button>
          </div>
        </div>

        {/* Folder cards grid — 4 columns per km_6 */}
        <div className="grid grid-cols-4 gap-4">
          {filteredFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onFolderClick?.(folder.id)}
              className="relative bg-bg-white-var rounded-2xl border border-border p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: folder.color + '14' }}
              >
                <Icon name="folder" size={24} style={{ color: folder.color }} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                {folder.name} ({folder.nameEn})
              </h3>
              <p className="text-xs text-text-muted mt-0.5">{folder.fileCount} 个文件 · {folder.updatedAt}</p>
              {/* More menu */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowPermModal(true); }}
                className="absolute top-3 right-3 p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
                title="权限管理"
              >
                <Icon name="more_vert" size={16} />
              </button>
            </button>
          ))}

          {/* Add new folder */}
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('新建文件夹功能开发中', 'info')}
            className="rounded-2xl border-2 border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary hover:text-primary transition-colors min-h-[120px]"
          >
            <Icon name="create_new_folder" size={24} />
            <span className="text-xs font-medium">添加新部门文件夹</span>
          </button>
        </div>
      </div>

      {/* Admin overview — light cards with description text per km_6 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Icon name="admin_panel_settings" size={16} className="text-primary" />
          管理权限概览 (Admin View)
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {ADMIN_OVERVIEW.map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-2xl border"
              style={{ backgroundColor: `${card.color}05`, borderColor: `${card.color}15` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon name={card.icon} size={18} style={{ color: card.color }} />
                <span className="text-xs font-semibold text-text-primary">{card.label}</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
