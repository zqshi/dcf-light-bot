import { create } from 'zustand';
import type { Folder } from '../../domain/knowledge/Folder';
import { Folder as FolderClass } from '../../domain/knowledge/Folder';
import type { Document } from '../../domain/knowledge/Document';
import type { DocumentStatus } from '../../domain/knowledge/Document';
import type { Version } from '../../domain/knowledge/Version';
import type { AuditEntry, AuditOperationType } from '../../domain/knowledge/AuditEntry';
import type { DocumentPermission } from '../../domain/knowledge/Permission';
import type { StorageStats, DeptStorage, LargeFile } from '../../data/mockKnowledge';
import {
  MOCK_FOLDERS, MOCK_DOCUMENTS, MOCK_VERSIONS,
  MOCK_AUDIT_ENTRIES, MOCK_STORAGE_STATS, MOCK_DEPT_STORAGE, MOCK_LARGE_FILES,
} from '../../data/mockKnowledge';
import { documentApi, categoryApi, knowledgeAuditApi, storageApi, uploadApi } from '../../infrastructure/api/dcfApiClient';
import { fromDTO, toCreateDTO, toUpdateDTO } from '../../infrastructure/api/documentAdapter';
import { useAuthStore } from './authStore';

/* ── Filter Types ── */

export interface DocumentFilter {
  status?: DocumentStatus;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  starred?: boolean;
  search?: string;
}

export interface AuditLogFilter {
  operationType?: AuditOperationType;
  operatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

type ViewMode = 'grid' | 'list';

/* ── State Shape ── */

interface KnowledgeState {
  /* ── Core Data ── */
  folders: Folder[];
  documents: Document[];
  versions: Version[];
  auditEntries: AuditEntry[];
  storageStats: StorageStats | null;
  deptStorage: DeptStorage[];
  largeFiles: LargeFile[];

  /* ── UI State ── */
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  searchQuery: string;
  viewMode: ViewMode;
  selectedDocIds: Set<string>;
  isAdminView: boolean;
  documentFilter: DocumentFilter;

  /** true when any async operation is in-flight */
  loading: boolean;
  /** Internal counter — use `loading` instead */
  _loadingCount: number;
  error: string | null;

  /* ── Basic Actions ── */
  reset(): void;
  selectFolder(folderId: string | null): void;
  selectDocument(documentId: string | null): void;
  setViewMode(mode: ViewMode): void;
  setSearchQuery(query: string): void;
  toggleStar(documentId: string): void;
  toggleDocSelection(docId: string): void;
  selectAllDocs(docIds: string[]): void;
  clearDocSelection(): void;
  setAdminView(enabled: boolean): void;
  setDocumentFilter(filter: DocumentFilter): void;

  /* ── Document CRUD ── */
  fetchDocuments(): Promise<void>;
  createDocument(title: string, type?: 'doc' | 'markdown' | 'sheet' | 'slide', content?: string): Promise<string | null>;
  updateDocument(id: string, data: { title?: string; content?: string; version?: number }): Promise<boolean>;
  deleteDocument(id: string): Promise<boolean>;
  uploadFile(file: File): Promise<boolean>;

  /* ── Category / Folder ── */
  fetchCategories(): Promise<void>;
  createFolder(name: string, parentId: string | null, icon?: string): Promise<string | null>;
  updateFolder(id: string, data: { name?: string; icon?: string; description?: string }): Promise<boolean>;
  deleteFolder(id: string): Promise<boolean>;

  /* ── Versions ── */
  fetchVersions(docId: string): Promise<void>;
  restoreVersion(versionId: string): Promise<boolean>;

  /* ── Document Lifecycle ── */
  submitForReview(id: string): Promise<boolean>;
  approveDocument(id: string): Promise<boolean>;
  rejectDocument(id: string, comment: string): Promise<boolean>;
  publishDocument(id: string): Promise<boolean>;
  publishToTarget(docId: string, target: 'org' | 'department' | 'shared', departmentId?: string): Promise<boolean>;
  archiveDocument(id: string): Promise<boolean>;

  /* ── Filtered Fetch ── */
  fetchDocumentsByFilter(filter: DocumentFilter): Promise<void>;
  fetchDrafts(): Promise<void>;
  fetchFavorites(): Promise<void>;

  /* ── Admin ── */
  fetchAuditLog(filter?: AuditLogFilter): Promise<void>;
  fetchStorageStats(): Promise<void>;
  fetchDeptStorage(): Promise<void>;
  fetchLargeFiles(): Promise<void>;

  /* ── Permissions ── */
  updateDocumentPermissions(docId: string, perms: DocumentPermission[]): Promise<boolean>;
}

/* ── Helpers ── */

const isDemo = () => useAuthStore.getState().isDemo;

/** Increment loading counter */
const startLoading = (s: KnowledgeState) => ({
  _loadingCount: s._loadingCount + 1,
  loading: true,
  error: null,
});

/** Decrement loading counter */
const doneLoading = (s: KnowledgeState, extra: Partial<KnowledgeState> = {}) => {
  const c = s._loadingCount - 1;
  return { ...extra, _loadingCount: c, loading: c > 0 } as Partial<KnowledgeState>;
};

const errorLoading = (s: KnowledgeState, msg: string) => {
  const c = s._loadingCount - 1;
  return { error: msg, _loadingCount: c, loading: c > 0 };
};

/* ══════════════════════════════════════════════
   Store Implementation
   ══════════════════════════════════════════════ */

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  /* ── Initial State ── */
  folders: MOCK_FOLDERS,
  documents: [],
  versions: [],
  auditEntries: [],
  storageStats: null,
  deptStorage: [],
  largeFiles: [],
  selectedFolderId: null,
  selectedDocumentId: null,
  searchQuery: '',
  viewMode: 'grid',
  selectedDocIds: new Set<string>(),
  isAdminView: false,
  documentFilter: {},
  loading: false,
  _loadingCount: 0,
  error: null,

  /* ── Basic Actions ── */

  reset() {
    set({
      folders: MOCK_FOLDERS,
      documents: [],
      versions: [],
      auditEntries: [],
      storageStats: null,
      deptStorage: [],
      largeFiles: [],
      selectedFolderId: null,
      selectedDocumentId: null,
      searchQuery: '',
      viewMode: 'grid',
      selectedDocIds: new Set<string>(),
      isAdminView: false,
      documentFilter: {},
      loading: false,
      _loadingCount: 0,
      error: null,
    });
  },

  selectFolder(folderId) {
    set({ selectedFolderId: folderId, selectedDocumentId: null });
  },

  selectDocument(documentId) {
    set({ selectedDocumentId: documentId });
  },

  setViewMode(mode) {
    set({ viewMode: mode });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setDocumentFilter(filter) {
    set({ documentFilter: filter });
  },

  toggleStar(documentId) {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === documentId ? d.withStarred(!d.starred) : d,
      ),
    }));
    if (!isDemo()) {
      documentApi.toggleStar(documentId).catch(() => {
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId ? d.withStarred(!d.starred) : d,
          ),
        }));
      });
    }
  },

  toggleDocSelection(docId) {
    set((state) => {
      const next = new Set(state.selectedDocIds);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return { selectedDocIds: next };
    });
  },

  selectAllDocs(docIds) {
    set({ selectedDocIds: new Set(docIds) });
  },

  clearDocSelection() {
    set({ selectedDocIds: new Set<string>() });
  },

  setAdminView(enabled) {
    set({ isAdminView: enabled });
  },

  /* ── Document CRUD ── */

  async fetchDocuments() {
    if (isDemo()) {
      set({ documents: MOCK_DOCUMENTS, loading: false, error: null });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { documents: dtos } = await documentApi.list();
      const documents = dtos.map(fromDTO);
      set((s) => doneLoading(s, { documents }));
    } catch {
      set((s) => doneLoading(s, { documents: MOCK_DOCUMENTS }));
    }
  },

  async createDocument(title, type = 'doc', content = '') {
    if (isDemo()) {
      // Demo: create a local mock document
      const { Document } = await import('../../domain/knowledge/Document');
      const id = `d-demo-${Date.now()}`;
      const doc = Document.create({
        id, title, content, folderId: 'cat-personal',
        type, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        author: { name: '当前用户' }, status: 'draft', ownerId: 'current-user',
      });
      set((s) => ({ documents: [doc, ...s.documents] }));
      return id;
    }
    set((s) => startLoading(s));
    try {
      const dto = toCreateDTO({ title, type, content });
      const { document: created } = await documentApi.create(dto);
      const doc = fromDTO(created);
      set((s) => doneLoading(s, { documents: [doc, ...s.documents] }));
      return created.id;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '创建文档失败'));
      return null;
    }
  },

  async updateDocument(id, data) {
    if (isDemo()) {
      set((s) => ({
        documents: s.documents.map((d) => {
          if (d.id !== id) return d;
          let updated = d;
          if (data.title !== undefined) updated = updated.withTitle(data.title);
          if (data.content !== undefined) updated = updated.withContent(data.content);
          return updated;
        }),
      }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const dto = toUpdateDTO(data);
      const { document: updated } = await documentApi.update(id, dto);
      const doc = fromDTO(updated);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? doc : d),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '更新文档失败'));
      return false;
    }
  },

  async deleteDocument(id) {
    if (isDemo()) {
      set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      await documentApi.delete(id);
      set((s) => doneLoading(s, {
        documents: s.documents.filter((d) => d.id !== id),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '删除文档失败'));
      return false;
    }
  },

  async uploadFile(file) {
    if (isDemo()) return true;
    set((s) => startLoading(s));
    try {
      await uploadApi.upload(file);
      set((s) => doneLoading(s));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '上传文件失败'));
      return false;
    }
  },

  /* ── Category / Folder ── */

  async fetchCategories() {
    if (isDemo()) {
      set({ folders: MOCK_FOLDERS });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { categories } = await categoryApi.list();
      const folders = categories.map((c: any) => FolderClass.create({
        id: c.id, name: c.name, parentId: c.parentId || null, icon: c.icon || 'folder',
        type: c.type, departmentId: c.departmentId,
      }));
      set((s) => doneLoading(s, { folders }));
    } catch {
      set((s) => doneLoading(s, { folders: MOCK_FOLDERS }));
    }
  },

  async createFolder(name, parentId, icon = 'folder') {
    if (isDemo()) {
      const id = `f-${Date.now()}`;
      const folder = FolderClass.create({ id, name, parentId, icon });
      set((s) => ({ folders: [...s.folders, folder] }));
      return id;
    }
    set((s) => startLoading(s));
    try {
      const { category } = await categoryApi.create({ name, parentId: parentId ?? undefined, icon });
      const folder = FolderClass.create({ id: category.id, name: category.name, parentId: category.parentId ?? undefined, icon: category.icon });
      set((s) => doneLoading(s, { folders: [...s.folders, folder] }));
      return category.id;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '创建文件夹失败'));
      return null;
    }
  },

  async updateFolder(id, data) {
    if (isDemo()) {
      set((s) => ({
        folders: s.folders.map((f) => {
          if (f.id !== id) return f;
          return data.name ? f.withName(data.name) : f;
        }),
      }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      await categoryApi.update(id, data);
      set((s) => doneLoading(s, {
        folders: s.folders.map((f) => {
          if (f.id !== id) return f;
          return data.name ? f.withName(data.name) : f;
        }),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '更新文件夹失败'));
      return false;
    }
  },

  async deleteFolder(id) {
    if (isDemo()) {
      set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      await categoryApi.delete(id);
      set((s) => doneLoading(s, {
        folders: s.folders.filter((f) => f.id !== id),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '删除文件夹失败'));
      return false;
    }
  },

  /* ── Versions ── */

  async fetchVersions(docId) {
    if (isDemo()) {
      const filtered = MOCK_VERSIONS.filter((v) => v.documentId === docId);
      set({ versions: filtered });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { versions: vDtos } = await documentApi.listVersions(docId);
      const { Version: VersionClass } = await import('../../domain/knowledge/Version');
      const versions = vDtos.map((v: any) => VersionClass.create({
        id: v.id, documentId: v.documentId, version: v.versionNumber || v.version || 1,
        author: { name: v.editedBy || v.title || 'unknown' }, createdAt: v.createdAt,
        changeDescription: v.title || '', diffStats: { added: 0, removed: 0 },
        contentSnapshot: v.contentSnapshot || '', status: v.status || 'auto',
      }));
      set((s) => doneLoading(s, { versions }));
    } catch {
      set((s) => doneLoading(s, { versions: [] }));
    }
  },

  async restoreVersion(versionId) {
    const version = get().versions.find((v) => v.id === versionId);
    if (!version || !version.hasSnapshot) return false;

    if (isDemo()) {
      set((s) => ({
        documents: s.documents.map((d) =>
          d.id === version.documentId ? d.withContent(version.contentSnapshot) : d,
        ),
      }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.restoreVersion(versionId);
      const doc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === doc.id ? doc : d),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '恢复版本失败'));
      return false;
    }
  },

  /* ── Document Lifecycle ── */

  async submitForReview(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('pending_review')) return false;

    const updated = doc.submitForReview();
    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === id ? updated : d) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.submitForReview(id);
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? apiDoc : d),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '提交审核失败'));
      return false;
    }
  },

  async approveDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('published')) return false;

    const approved = doc.approve({ name: '当前用户' });
    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === id ? approved : d) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.approve(id);
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? apiDoc : d),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '审批失败'));
      return false;
    }
  },

  async rejectDocument(id, comment) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) return false;

    const rejected = doc.reject({ name: '当前用户' }, comment);
    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === id ? rejected : d) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.reject(id, comment);
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? apiDoc : d),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '驳回失败'));
      return false;
    }
  },

  async publishDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('published')) return false;

    const published = doc.publish();
    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === id ? published : d) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.publish(id);
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? apiDoc : d),
      }));
      // Sync to WeKnora RAG (non-blocking)
      try {
        const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
        const plainText = (apiDoc.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        await weKnoraApi.syncDocument({ id, title: apiDoc.title, content: plainText, type: 'doc' });
      } catch { /* WeKnora sync failure should not block publish */ }
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '发布失败'));
      return false;
    }
  },

  async publishToTarget(docId, target, departmentId?) {
    const TARGET_CATEGORY: Record<string, string> = {
      org: 'cat-official',
      department: 'cat-department',
      shared: 'cat-shared',
    };
    const needsReview = target === 'org' || target === 'department';
    const categoryId = TARGET_CATEGORY[target] || 'cat-shared';

    const doc = get().documents.find((d) => d.id === docId);
    if (!doc) return false;

    // Update category + optionally departmentId, then transition status
    let updated = doc.withCategory(categoryId);
    if (needsReview) {
      updated = updated.submitForReview();
    } else {
      updated = updated.publish();
    }

    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === docId ? updated : d) }));
      return true;
    }

    set((s) => startLoading(s));
    try {
      // Update category first
      await documentApi.update(docId, { categoryId, departmentId });
      // Then transition status
      const apiCall = needsReview
        ? documentApi.submitForReview(docId)
        : documentApi.publish(docId);
      const { document: dto } = await apiCall;
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === docId ? apiDoc : d),
      }));
      if (!needsReview) {
        // Sync to WeKnora RAG (non-blocking)
        try {
          const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
          const plainText = (apiDoc.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          await weKnoraApi.syncDocument({ id: docId, title: apiDoc.title, content: plainText, type: 'doc' });
        } catch { /* WeKnora sync failure should not block publish */ }
      }
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '发布失败'));
      return false;
    }
  },

  async archiveDocument(id) {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.canTransitionTo('archived')) return false;

    const archived = doc.archive();
    if (isDemo()) {
      set((s) => ({ documents: s.documents.map((d) => d.id === id ? archived : d) }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      const { document: dto } = await documentApi.archive(id);
      const apiDoc = fromDTO(dto);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) => d.id === id ? apiDoc : d),
      }));
      // Remove from WeKnora RAG index (non-blocking)
      try {
        const { weKnoraApi } = await import('../../infrastructure/api/weKnoraClient');
        await weKnoraApi.syncDocument({ id, title: '', content: '', type: 'doc' });
      } catch { /* WeKnora sync failure should not block archive */ }
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '归档失败'));
      return false;
    }
  },

  /* ── Filtered Fetch ── */

  async fetchDocumentsByFilter(filter) {
    set({ documentFilter: filter });
    // Ensure documents are loaded first
    if (get().documents.length === 0) {
      await get().fetchDocuments();
    }
    // Filtering is done at render time via selector; this just sets the filter.
    // In non-demo mode with backend pagination, this would call the API with filters.
  },

  async fetchDrafts() {
    await get().fetchDocumentsByFilter({ status: 'draft', ownerId: 'current-user' });
  },

  async fetchFavorites() {
    await get().fetchDocumentsByFilter({ starred: true });
  },

  /* ── Admin ── */

  async fetchAuditLog(filter?) {
    if (isDemo()) {
      let entries = MOCK_AUDIT_ENTRIES;
      if (filter?.operationType) {
        entries = entries.filter((e) => e.operationType === filter.operationType);
      }
      if (filter?.operatorId) {
        entries = entries.filter((e) => e.operatorId === filter.operatorId);
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        entries = entries.filter((e) =>
          e.targetName.toLowerCase().includes(q) ||
          e.operatorName.toLowerCase().includes(q),
        );
      }
      set({ auditEntries: entries });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { entries } = await knowledgeAuditApi.list({
        operationType: filter?.operationType,
        operatorId: filter?.operatorId,
        search: filter?.search,
      });
      const { AuditEntry: AuditEntryClass } = await import('../../domain/knowledge/AuditEntry');
      const auditEntries = entries.map((e: any) => AuditEntryClass.create(e));
      set((s) => doneLoading(s, { auditEntries }));
    } catch {
      set((s) => doneLoading(s, { auditEntries: [] }));
    }
  },

  async fetchStorageStats() {
    if (isDemo()) {
      set({ storageStats: MOCK_STORAGE_STATS });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { stats } = await storageApi.getStats();
      set((s) => doneLoading(s, { storageStats: stats }));
    } catch {
      set((s) => doneLoading(s, { storageStats: null }));
    }
  },

  async fetchDeptStorage() {
    if (isDemo()) {
      set({ deptStorage: MOCK_DEPT_STORAGE });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { departments } = await storageApi.getDeptStorage();
      set((s) => doneLoading(s, { deptStorage: departments }));
    } catch {
      set((s) => doneLoading(s, { deptStorage: [] }));
    }
  },

  async fetchLargeFiles() {
    if (isDemo()) {
      set({ largeFiles: MOCK_LARGE_FILES });
      return;
    }
    set((s) => startLoading(s));
    try {
      const { files } = await storageApi.getLargeFiles();
      set((s) => doneLoading(s, { largeFiles: files }));
    } catch {
      set((s) => doneLoading(s, { largeFiles: [] }));
    }
  },

  /* ── Permissions ── */

  async updateDocumentPermissions(docId, perms) {
    if (isDemo()) {
      set((s) => ({
        documents: s.documents.map((d) =>
          d.id === docId ? d.withPermissions(perms) : d,
        ),
      }));
      return true;
    }
    set((s) => startLoading(s));
    try {
      await documentApi.updatePermissions(docId, perms);
      set((s) => doneLoading(s, {
        documents: s.documents.map((d) =>
          d.id === docId ? d.withPermissions(perms) : d,
        ),
      }));
      return true;
    } catch (err: any) {
      set((s) => errorLoading(s, err?.message || '更新权限失败'));
      return false;
    }
  },
}));
