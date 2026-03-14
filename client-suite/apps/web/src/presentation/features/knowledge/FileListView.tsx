/**
 * FileListView — 部门文件列表 + 批量操作栏 (km_20 对齐)
 * Finder风格文件表格 + 多选checkbox + 底部批量操作浮层
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { MoveFilesModal } from './MoveFilesModal';

type FileType = 'pdf' | 'xlsx' | 'docx' | 'sheets';

interface FileEntry {
  id: string;
  name: string;
  type: FileType;
  modifier: string;
  modifierDept: string;
  modifiedAt: string;
  size: string;
}

const FILE_ICON: Record<FileType, { icon: string; color: string }> = {
  pdf: { icon: 'picture_as_pdf', color: '#FF3B30' },
  xlsx: { icon: 'table_chart', color: '#34C759' },
  docx: { icon: 'description', color: '#007AFF' },
  sheets: { icon: 'grid_on', color: '#34C759' },
};

const MOCK_FILES: FileEntry[] = [
  { id: 'f1', name: '2024Q1_财务报表汇总.pdf', type: 'pdf', modifier: '李明', modifierDept: 'Financial', modifiedAt: '2024-03-20 14:30', size: '4.2 MB' },
  { id: 'f2', name: '年度预算执行表_2024.xlsx', type: 'xlsx', modifier: '王志强', modifierDept: '', modifiedAt: '2小时前', size: '856 KB' },
  { id: 'f3', name: '部门报销流程指南_V2.docx', type: 'docx', modifier: '李明', modifierDept: 'Financial', modifiedAt: '昨天 09:15', size: '1.5 MB' },
  { id: 'f4', name: '差旅费用明细清单.sheets', type: 'sheets', modifier: '陈美琳', modifierDept: '', modifiedAt: '2024-03-15', size: '2.1 MB' },
  { id: 'f5', name: '2023年度审计报告最终版.pdf', type: 'pdf', modifier: '赵立新', modifierDept: '', modifiedAt: '2024-02-28', size: '12.4 MB' },
];

interface FileListViewProps {
  departmentName?: string;
  onMoveFiles?: (ids: string[]) => void;
  onBack?: () => void;
}

export function FileListView({ departmentName = '财务部', onMoveFiles, onBack }: FileListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [search, setSearch] = useState('');
  const setSubView = useUIStore((s) => s.setSubView);

  const filteredFiles = MOCK_FILES.filter((f) => !search || f.name.includes(search) || f.modifier.includes(search));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === MOCK_FILES.length) setSelected(new Set());
    else setSelected(new Set(MOCK_FILES.map((f) => f.id)));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var relative">
      {/* Back + Header */}
      {onBack && (
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-0 px-6 pt-3">
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-text-muted">部门资产</span>
          <Icon name="chevron_right" size={16} className="text-text-muted" />
          <span className="font-semibold text-text-primary">{departmentName} (Finance)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`在${departmentName}文件夹内搜索...`}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button type="button" onClick={() => useToastStore.getState().addToast('文件上传功能开发中', 'info')} className="px-3 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5">
            <Icon name="upload" size={14} /> 上传文件
          </button>
          <button type="button" onClick={() => setSubView('knowledge:doc-editor')} className="px-3 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5">
            <Icon name="note_add" size={14} /> 新建文档
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="px-6 py-2.5 w-10">
                <input type="checkbox" checked={selected.size === MOCK_FILES.length} onChange={toggleAll} className="rounded" />
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">文件名</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">修改人</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">修改时间</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">大小</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => {
              const fi = FILE_ICON[file.type];
              const isSelected = selected.has(file.id);
              return (
                <tr
                  key={file.id}
                  className={`border-b border-border/30 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-bg-hover/30'}`}
                >
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setSubView('knowledge:doc-read')}
                      className="flex items-center gap-2.5 hover:text-primary transition-colors"
                    >
                      <Icon name={fi.icon} size={20} style={{ color: fi.color }} />
                      <span className="text-sm text-text-primary font-medium hover:text-primary">{file.name}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-secondary">
                      {file.modifier}
                      {file.modifierDept && <span className="text-text-muted"> ({file.modifierDept})</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-muted">{file.modifiedAt}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-muted">{file.size}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={(e) => { e.stopPropagation(); useToastStore.getState().addToast('文件操作菜单开发中', 'info'); }} className="p-1 text-text-muted hover:text-text-secondary">
                      <Icon name="more_horiz" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch action floating bar */}
      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bg-white-var rounded-2xl shadow-lg border border-border px-6 py-3 flex items-center gap-6 dcf-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              {selected.size}
            </span>
            <span className="text-sm text-text-secondary">
              已选择 {selected.size} 项
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <button
            type="button"
            onClick={() => { onMoveFiles ? onMoveFiles(Array.from(selected)) : setShowMoveModal(true); }}
            className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-primary transition-colors"
          >
            <Icon name="drive_file_move" size={18} />
            <span className="text-[10px]">移动</span>
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast(`已下载 ${selected.size} 个文件`, 'success')} className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-primary transition-colors">
            <Icon name="download" size={18} />
            <span className="text-[10px]">下载</span>
          </button>
          <button type="button" onClick={() => { useToastStore.getState().addToast(`已删除 ${selected.size} 个文件`, 'success'); setSelected(new Set()); }} className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-error transition-colors">
            <Icon name="delete" size={18} />
            <span className="text-[10px] text-error">删除</span>
          </button>
          <div className="w-px h-8 bg-border" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            取消选择
          </button>
        </div>
      )}
      <MoveFilesModal open={showMoveModal} onClose={() => setShowMoveModal(false)} fileCount={selected.size} onConfirm={() => { setShowMoveModal(false); setSelected(new Set()); }} />
    </div>
  );
}
