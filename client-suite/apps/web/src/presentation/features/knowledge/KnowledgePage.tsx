import { useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { KnowledgeTab } from '../../../application/stores/knowledgeStore';
import { DocumentCard } from './DocumentCard';
import { FileManager } from './FileManager';
import { AdminAssetTable, OrgStatsCard } from './AdminAssetTable';
import { DraftsPage } from './DraftsPage';
import { DepartmentAssetsOverview } from './DepartmentAssetsOverview';
import { AuditLogPage } from './AuditLogPage';
import { StorageManagementPage } from './StorageManagementPage';
import { FileListView } from './FileListView';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { DocumentEditorWithSettings } from './DocumentEditorWithSettings';
import { ConflictMergeView } from './ConflictMergeView';
import { HTMLPreviewPanel } from './HTMLPreviewPanel';
import { CollaborativeEditConflict } from './CollaborativeEditConflict';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { DocumentReadView } from './DocumentReadView';
import { KnowledgeAdminPage } from './KnowledgeAdminPage';
import { AIHTMLEditDiff } from './AIHTMLEditDiff';
import { DocumentSecurityPanel } from './DocumentSecurityPanel';
import { DocumentSettingsPanel } from './DocumentSettingsPanel';
import { KnowledgeAIChat } from './KnowledgeAIChat';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

const ENTERPRISE_ITEMS: SidebarItem[] = [
  { id: 'standard', label: '标准流程', icon: 'account_tree' },
  { id: 'department', label: '部门资产', icon: 'grid_view' },
  { id: 'official', label: '官方指南', icon: 'verified' },
];

const PERSONAL_ITEMS: SidebarItem[] = [
  { id: 'drafts', label: '我的草稿', icon: 'edit_note' },
  { id: 'reading-list', label: '阅读清单', icon: 'bookmark' },
  { id: 'favorites', label: '收藏夹', icon: 'star' },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { id: 'dept-assets', label: '部门资产', icon: 'folder_shared' },
  { id: 'admin', label: '管理员视图', icon: 'admin_panel_settings' },
  { id: 'capacity', label: '容量管理', icon: 'storage' },
  { id: 'audit', label: '审核日志', icon: 'rule' },
];

/** Map sidebar item IDs to sub-view names */
const SUBVIEW_MAP: Record<string, string> = {
  drafts: 'knowledge:drafts',
  'reading-list': 'knowledge:reading-list',
  favorites: 'knowledge:favorites',
  'dept-assets': 'knowledge:dept-assets',
  admin: 'knowledge:admin',
  capacity: 'knowledge:storage',
  audit: 'knowledge:audit-log',
};

export function KnowledgeSidebar() {
  const { selectedFolderId, selectFolder } = useKnowledgeStore();
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);

  const handleItemClick = (item: SidebarItem) => {
    const mapped = SUBVIEW_MAP[item.id];
    if (mapped) {
      setSubView(subView === mapped ? null : mapped);
      selectFolder(null);
    } else {
      setSubView(null);
      selectFolder(selectedFolderId === item.id ? null : item.id);
    }
  };

  const isActiveItem = (item: SidebarItem) => {
    const mapped = SUBVIEW_MAP[item.id];
    if (mapped) return subView === mapped;
    return selectedFolderId === item.id && !subView;
  };

  const renderItem = (item: SidebarItem) => {
    const isActive = isActiveItem(item);
    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
          isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary font-medium'
        }`}
      >
        <Icon name={item.icon} size={16} className={isActive ? 'text-primary' : 'text-text-secondary'} />
        <span>{item.label}</span>
      </button>
    );
  };

  const isAdmin = useKnowledgeStore((s) => s.isAdminView);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">知识库</h3>

      <div className="space-y-0.5">
        <SectionLabel>企业知识库</SectionLabel>
        {ENTERPRISE_ITEMS.map(renderItem)}
      </div>

      <div className="space-y-0.5">
        <SectionLabel>个人空间</SectionLabel>
        {PERSONAL_ITEMS.map(renderItem)}
      </div>

      {isAdmin && (
        <div className="space-y-0.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary px-2 mb-1.5 flex items-center gap-1">
            <Icon name="admin_panel_settings" size={14} />
            系统管理
          </h3>
          {ADMIN_ITEMS.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function RecentFilesGrid({ showStats = false }: { showStats?: boolean }) {
  const documents = useKnowledgeStore((s) => s.documents);
  const recentCount = showStats ? 3 : 4;
  const recent = documents.slice(0, recentCount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-text-primary">
            {showStats ? '最近更新' : '最近文件'}
          </h3>
        </div>
        <button type="button" onClick={() => useUIStore.getState().setSubView('knowledge:file-list')} className="text-xs text-primary hover:text-primary/80 font-medium">
          查看全部
        </button>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${showStats ? 4 : 4} gap-3`}>
        {recent.map((doc) => (
          <DocumentCard key={doc.id} document={doc} badge={showStats ? '组织' : undefined} />
        ))}
        {showStats && <OrgStatsCard />}
      </div>
    </div>
  );
}

const TAB_ITEMS: { key: KnowledgeTab; label: string; dot?: boolean }[] = [
  { key: 'enterprise', label: '企业知识' },
  { key: 'personal', label: '个人主页' },
  { key: 'org-assets', label: '组织资产', dot: true },
];

export function KnowledgePage() {
  const {
    documents, searchQuery, setSearchQuery, viewMode, setViewMode,
    selectedFolderId, selectFolder, isAdminView, setAdminView, activeTab, setActiveTab,
    fetchDocuments, uploadFile, loading, error,
  } = useKnowledgeStore();
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Sub-view routing: render full-page sub-views when active
  if (subView === 'knowledge:drafts') return <DraftsPage mode="drafts" onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:reading-list') return <DraftsPage mode="reading-list" onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:favorites') return <DraftsPage mode="favorites" onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:storage') return <StorageManagementPage onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:audit-log') return <AuditLogPage onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:dept-assets') return <DepartmentAssetsOverview onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:file-list') return <FileListView onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:spreadsheet') return <SpreadsheetEditor onExit={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-editor') return <DocumentEditorWithSettings onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:conflict-merge') return <ConflictMergeView onCancel={() => setSubView(null)} />;
  if (subView === 'knowledge:html-preview') return <HTMLPreviewPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:collab-conflict') return <CollaborativeEditConflict onDismiss={() => setSubView(null)} />;
  if (subView === 'knowledge:version-history') return <VersionHistoryPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-read') return <DocumentReadView onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:admin') return <KnowledgeAdminPage onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:ai-diff') return <AIHTMLEditDiff onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-security') return <DocumentSecurityPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-settings') return <DocumentSettingsPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:ai-chat') return <KnowledgeAIChat onClose={() => setSubView(null)} />;

  // Department folder navigation → show department file list
  if (selectedFolderId === 'department') return <FileListView />;

  const filtered = documents.filter((d) => {
    if (selectedFolderId && d.folderId !== selectedFolderId) return false;
    return d.matchesSearch(searchQuery);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb (when folder selected) */}
        {selectedFolderId && (
          <div className="flex items-center gap-1.5 text-sm">
            <button type="button" onClick={() => selectFolder(null)} className="text-primary hover:underline">
              {selectedFolderId === 'department' ? '部门资产' : '标准流程'}
            </button>
            <Icon name="chevron_right" size={16} className="text-text-muted" />
            <span className="text-text-primary font-medium">
              {selectedFolderId === 'department' ? '财务部 (Finance)' : '操作流程'}
            </span>
          </div>
        )}

        {/* Header: tabs + admin badge + search + action buttons */}
        <div className="flex items-center justify-between">
          {!selectedFolderId ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 bg-fill-tertiary rounded-lg p-0.5">
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-bg-white-var text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                    {tab.dot && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAdminView(!isAdminView)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isAdminView
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                <Icon name="shield" size={14} />
                ADMIN VIEW
              </button>
            </div>
          ) : (
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={`在${selectedFolderId === 'department' ? '财务部' : ''}文件夹内搜索...`}
              className="w-72"
            />
          )}
          <div className="flex items-center gap-2">
            {!selectedFolderId && (
              <>
                <button
                  type="button"
                  onClick={() => setSubView('knowledge:ai-chat')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-fill-tertiary text-text-secondary rounded-lg text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Icon name="smart_toy" size={16} />
                  <span>AI 问答</span>
                </button>
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="搜索文档、流程或资产..."
                  className="w-64"
                />
              </>
            )}
            {selectedFolderId ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ok = await uploadFile(file);
                    if (ok) {
                      useToastStore.getState().addToast(`「${file.name}」上传成功`, 'success');
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Icon name="upload" size={18} />
                  <span>上传文件</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('knowledge:doc-editor')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-bg-white-var border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-bg-hover transition-colors"
                >
                  <Icon name="note_add" size={18} />
                  <span>新建文档</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSubView('knowledge:doc-editor')}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Icon name="add" size={18} />
                <span>新建</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && documents.length === 0 && (
          <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
            <Icon name="hourglass_empty" size={20} className="animate-spin" />
            <span className="text-sm">加载文档中...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <Icon name="error_outline" size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => fetchDocuments()} className="ml-auto text-xs text-primary hover:underline">重试</button>
          </div>
        )}

        {/* Recent files grid (with OrgStatsCard in admin view) */}
        {!searchQuery && (
          <RecentFilesGrid showStats={isAdminView || activeTab === 'org-assets'} />
        )}

        {/* Admin asset table when org-assets tab selected */}
        {activeTab === 'org-assets' && !selectedFolderId && <AdminAssetTable />}

        {/* All documents table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="description" size={18} className="text-primary" />
              <h3 className="text-base font-semibold text-text-primary">所有文档</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="grid_view" size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="view_list" size={18} />
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-text-muted text-center py-12">没有找到匹配的文档</p>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <FileManager documents={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}
