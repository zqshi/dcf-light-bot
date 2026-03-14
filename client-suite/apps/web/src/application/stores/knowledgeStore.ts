import { create } from 'zustand';
import type { Folder } from '../../domain/knowledge/Folder';
import type { Document } from '../../domain/knowledge/Document';
import type { Version } from '../../domain/knowledge/Version';
import { MOCK_FOLDERS, MOCK_DOCUMENTS, MOCK_VERSIONS } from '../../data/mockKnowledge';
import { documentApi, uploadApi } from '../../infrastructure/api/dcfApiClient';
import { fromDTO, toCreateDTO, toUpdateDTO } from '../../infrastructure/api/documentAdapter';
import { useAuthStore } from './authStore';

type ViewMode = 'grid' | 'list';

export type KnowledgeTab = 'enterprise' | 'personal' | 'org-assets';

interface KnowledgeState {
  folders: Folder[];
  documents: Document[];
  versions: Version[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  searchQuery: string;
  viewMode: ViewMode;
  selectedDocIds: Set<string>;
  isAdminView: boolean;
  activeTab: KnowledgeTab;
  /** Derived: true when any async operation is in-flight */
  loading: boolean;
  /** Internal counter — do not read directly, use `loading` */
  _loadingCount: number;
  error: string | null;

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
  setActiveTab(tab: KnowledgeTab): void;

  fetchDocuments(): Promise<void>;
  createDocument(title: string, type?: 'doc' | 'markdown' | 'sheet' | 'slide', content?: string): Promise<string | null>;
  updateDocument(id: string, data: { title?: string; content?: string; version?: number }): Promise<boolean>;
  deleteDocument(id: string): Promise<boolean>;
  uploadFile(file: File): Promise<boolean>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  folders: MOCK_FOLDERS,
  documents: [],
  versions: MOCK_VERSIONS,
  selectedFolderId: null,
  selectedDocumentId: null,
  searchQuery: '',
  viewMode: 'grid',
  selectedDocIds: new Set<string>(),
  isAdminView: false,
  activeTab: 'enterprise',
  loading: false,
  _loadingCount: 0,
  error: null,

  reset() {
    set({
      folders: MOCK_FOLDERS,
      documents: [],
      versions: MOCK_VERSIONS,
      selectedFolderId: null,
      selectedDocumentId: null,
      searchQuery: '',
      viewMode: 'grid',
      selectedDocIds: new Set<string>(),
      isAdminView: false,
      activeTab: 'enterprise',
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

  toggleStar(documentId) {
    // Optimistic update, then call API
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === documentId ? d.withStarred(!d.starred) : d,
      ),
    }));
    documentApi.toggleStar(documentId).catch(() => {
      // Revert on failure
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? d.withStarred(!d.starred) : d,
        ),
      }));
    });
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

  setActiveTab(tab) {
    set({ activeTab: tab });
  },

  async fetchDocuments() {
    // Demo mode or backend unavailable → use mock data
    if (useAuthStore.getState().isDemo) {
      set({ documents: MOCK_DOCUMENTS, loading: false, error: null });
      return;
    }
    set((s) => ({ _loadingCount: s._loadingCount + 1, loading: true, error: null }));
    try {
      const { documents: dtos } = await documentApi.list();
      const documents = dtos.map(fromDTO);
      set((s) => {
        const c = s._loadingCount - 1;
        return { documents, _loadingCount: c, loading: c > 0 };
      });
    } catch (err: any) {
      // Fallback to mock data on API failure
      set((s) => {
        const c = s._loadingCount - 1;
        return { documents: MOCK_DOCUMENTS, _loadingCount: c, loading: c > 0, error: null };
      });
    }
  },

  async createDocument(title, type = 'doc', content = '') {
    set((s) => ({ _loadingCount: s._loadingCount + 1, loading: true, error: null }));
    try {
      const dto = toCreateDTO({ title, type, content });
      const { document: created } = await documentApi.create(dto);
      const doc = fromDTO(created);
      set((s) => {
        const c = s._loadingCount - 1;
        return { documents: [doc, ...s.documents], _loadingCount: c, loading: c > 0 };
      });
      return created.id;
    } catch (err: any) {
      set((s) => {
        const c = s._loadingCount - 1;
        return { error: err?.message || 'Failed to create document', _loadingCount: c, loading: c > 0 };
      });
      return null;
    }
  },

  async updateDocument(id, data) {
    set((s) => ({ _loadingCount: s._loadingCount + 1, loading: true, error: null }));
    try {
      const dto = toUpdateDTO(data);
      const { document: updated } = await documentApi.update(id, dto);
      const doc = fromDTO(updated);
      set((s) => {
        const c = s._loadingCount - 1;
        return {
          documents: s.documents.map((d) => d.id === id ? doc : d),
          _loadingCount: c, loading: c > 0,
        };
      });
      return true;
    } catch (err: any) {
      set((s) => {
        const c = s._loadingCount - 1;
        return { error: err?.message || 'Failed to update document', _loadingCount: c, loading: c > 0 };
      });
      return false;
    }
  },

  async deleteDocument(id) {
    set((s) => ({ _loadingCount: s._loadingCount + 1, loading: true, error: null }));
    try {
      await documentApi.delete(id);
      set((s) => {
        const c = s._loadingCount - 1;
        return {
          documents: s.documents.filter((d) => d.id !== id),
          _loadingCount: c, loading: c > 0,
        };
      });
      return true;
    } catch (err: any) {
      set((s) => {
        const c = s._loadingCount - 1;
        return { error: err?.message || 'Failed to delete document', _loadingCount: c, loading: c > 0 };
      });
      return false;
    }
  },

  async uploadFile(file) {
    set((s) => ({ _loadingCount: s._loadingCount + 1, loading: true, error: null }));
    try {
      await uploadApi.upload(file);
      set((s) => {
        const c = s._loadingCount - 1;
        return { _loadingCount: c, loading: c > 0 };
      });
      return true;
    } catch (err: any) {
      set((s) => {
        const c = s._loadingCount - 1;
        return { error: err?.message || 'Failed to upload file', _loadingCount: c, loading: c > 0 };
      });
      return false;
    }
  },
}));
