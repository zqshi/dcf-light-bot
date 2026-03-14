/**
 * VersionHistoryPanel — 版本历史面板 (document_version_history 对齐)
 * 版本列表 + 当前预览版本提示 + 恢复按钮 + diff统计 + 显示对比修改开关
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useToastStore } from '../../../application/stores/toastStore';

interface VersionEntry {
  id: string;
  label: string;
  author: string;
  avatar: string;
  time: string;
  description: string;
  isCurrent?: boolean;
  additions?: number;
  deletions?: number;
}

const MOCK_VERSIONS: VersionEntry[] = [
  {
    id: 'v-current',
    label: '李伟 (当前版本)',
    author: '李伟',
    avatar: '李',
    time: '刚才',
    description: '修正了末尾页面的错别字和排版间距。',
    isCurrent: true,
  },
  {
    id: 'v3',
    label: '版本 3',
    author: '张三',
    avatar: '张',
    time: '2小时前',
    description: '更新了市场预算分配，增加了50万推广费。',
    additions: 12,
    deletions: 4,
  },
  {
    id: 'v2',
    label: '版本 2',
    author: '王五',
    avatar: '王',
    time: '昨天 16:45',
    description: '添加了东南亚市场的时间节点规划。',
  },
  {
    id: 'v1',
    label: '版本 1',
    author: '产品研发部',
    avatar: '产',
    time: '2024-08-15',
    description: '初始版本提交：包含基础架构和核心业务描述。',
  },
];

interface VersionHistoryPanelProps {
  onClose?: () => void;
}

export function VersionHistoryPanel({ onClose }: VersionHistoryPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState('v3');
  const [showDiff, setShowDiff] = useState(true);

  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">版本历史</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover text-text-secondary">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current preview hint */}
        <div className="px-4 py-3 text-xs text-text-muted">
          当前预览版本：<span className="font-medium text-primary">版本 3</span>
        </div>

        {/* Restore button */}
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('已恢复至所选版本', 'success')}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="history" size={16} />
            恢复此版本
          </button>
        </div>

        {/* Version timeline */}
        <div className="px-4 space-y-1">
          {MOCK_VERSIONS.map((v) => {
            const isSelected = selectedVersion === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVersion(v.id)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-bg-hover border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar letter={v.avatar} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {v.label}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">{v.time}</span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{v.description}</p>
                    {(v.additions || v.deletions) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {v.additions && (
                          <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                            +{v.additions} 处修改
                          </span>
                        )}
                        {v.deletions && (
                          <span className="text-[10px] font-medium text-error bg-error/10 px-1.5 py-0.5 rounded">
                            -{v.deletions} 处删除
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom toggle */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="visibility" size={14} className="text-text-muted" />
          <span className="text-[11px] text-text-secondary">显示对比修改</span>
        </div>
        <ToggleSwitch checked={showDiff} onChange={setShowDiff} />
      </div>
    </div>
  );
}
