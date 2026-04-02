/**
 * DCF Backend API Client
 *
 * Wraps fetch() for the DCF backend REST API.
 * Uses cookie-based session auth (Set-Cookie: dcf_admin_session).
 * In dev mode, Vite proxy forwards /api → http://127.0.0.1:3000.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: any,
  ) {
    super(`API ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include', // send cookie
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, res.statusText, body);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// ─── Auth ────────────────────────────────────────────────────────────

export interface AuthUser {
  username: string;
  role: string;
  permissions?: string[];
}

export interface LoginResult {
  authenticated: boolean;
  user?: AuthUser;
  expiresInSec?: number;
  error?: string;
}

export const authApi = {
  login(username: string, password: string): Promise<LoginResult> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  me(): Promise<{ authenticated: boolean; user?: AuthUser }> {
    return request('/api/auth/me');
  },

  logout(): Promise<void> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  acl(): Promise<{ navItems: any[] }> {
    return request('/api/auth/acl');
  },
};

// ─── Employees ───────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  displayName?: string;
  category?: string;
  status?: string;
  matrixUserId?: string;
  [key: string]: any;
}

export const employeeApi = {
  list(): Promise<Employee[]> {
    return request('/api/admin/employees');
  },

  get(id: string): Promise<Employee> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}`);
  },
};

// ─── Shared Agents ───────────────────────────────────────────────────

export interface SharedAgentDTO {
  id: string;
  name: string;
  category: string;
  description?: string;
  status?: string;
  source?: string;
  [key: string]: any;
}

export const agentApi = {
  listShared(params?: {
    keyword?: string;
    status?: string;
    ownerEmployeeId?: string;
  }): Promise<{ rows: SharedAgentDTO[]; summary: any }> {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    if (params?.status) qs.set('status', params.status);
    if (params?.ownerEmployeeId) qs.set('ownerEmployeeId', params.ownerEmployeeId);
    const q = qs.toString();
    return request(`/api/admin/agents/shared${q ? `?${q}` : ''}`);
  },

  register(data: Partial<SharedAgentDTO>): Promise<any> {
    return request('/api/admin/agents/shared/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  recommend(params?: { jobCode?: string; keyword?: string }): Promise<{ rows: SharedAgentDTO[]; summary: any }> {
    const qs = new URLSearchParams();
    if (params?.jobCode) qs.set('jobCode', params.jobCode);
    if (params?.keyword) qs.set('keyword', params.keyword);
    const q = qs.toString();
    return request(`/api/admin/agents/shared/recommend${q ? `?${q}` : ''}`);
  },
};

// ─── Notifications ───────────────────────────────────────────────────

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  [key: string]: any;
}

export const notificationApi = {
  list(): Promise<{ items: NotificationDTO[]; summary: any }> {
    return request('/api/admin/notifications');
  },
};

// ─── Tasks ───────────────────────────────────────────────────────────

export interface TaskDTO {
  id: string;
  name: string;
  status: string;
  progress?: number;
  [key: string]: any;
}

export const taskApi = {
  list(): Promise<TaskDTO[]> {
    return request('/api/admin/tasks');
  },

  get(id: string): Promise<TaskDTO> {
    return request(`/api/admin/tasks/${encodeURIComponent(id)}`);
  },
};

// ─── Documents ───────────────────────────────────────────────────────

export interface DocumentDTO {
  id: string;
  roomId?: string | null;
  type: 'doc' | 'code' | 'markdown' | 'sheet' | 'slide';
  title: string;
  content: Record<string, any>;
  status?: string;
  categoryId?: string | null;
  departmentId?: string | null;
  ownerId?: string;
  permissions?: any[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DocumentFilter {
  roomId?: string;
  folderId?: string;
  status?: string;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  starred?: boolean;
  search?: string;
}

export const documentApi = {
  list(filter: DocumentFilter = {}): Promise<{ documents: DocumentDTO[] }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return request(`/api/control/documents${q ? `?${q}` : ''}`);
  },

  get(id: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`);
  },

  create(data: Partial<DocumentDTO>): Promise<{ document: DocumentDTO }> {
    return request('/api/control/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<DocumentDTO>): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  toggleStar(id: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/star`, {
      method: 'PATCH',
    });
  },

  submitForReview(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/submit-review`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  approve(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  reject(id: string, comment: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment, actor }),
    });
  },

  publish(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  archive(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  listVersions(documentId: string): Promise<{ versions: any[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/versions`);
  },

  restoreVersion(versionId: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/versions/${encodeURIComponent(versionId)}/restore`, {
      method: 'POST',
    });
  },

  getPermissions(documentId: string): Promise<{ permissions: any[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/permissions`);
  },

  updatePermissions(documentId: string, permissions: any[]): Promise<{ permissions: any[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  },
};

// ─── Categories ─────────────────────────────────────────────────────

export const categoryApi = {
  list(): Promise<{ categories: any[] }> {
    return request('/api/control/categories');
  },

  get(id: string): Promise<{ category: any }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`);
  },

  create(data: { name: string; icon?: string; parentId?: string; departmentId?: string }): Promise<{ category: any }> {
    return request('/api/control/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<{ name: string; icon: string; description: string }>): Promise<{ category: any }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// ─── Knowledge Audit Logs ───────────────────────────────────────────

export const knowledgeAuditApi = {
  list(filter?: { operationType?: string; operatorId?: string; search?: string; limit?: number }): Promise<{ entries: any[] }> {
    const qs = new URLSearchParams();
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      }
    }
    const q = qs.toString();
    return request(`/api/control/knowledge-audits${q ? `?${q}` : ''}`);
  },
};

// ─── Storage ────────────────────────────────────────────────────────

export const storageApi = {
  getStats(): Promise<{ stats: any }> {
    return request('/api/control/storage/stats');
  },

  getDeptStorage(): Promise<{ departments: any[] }> {
    return request('/api/control/storage/departments');
  },

  getLargeFiles(): Promise<{ files: any[] }> {
    return request('/api/control/storage/large-files');
  },
};

// ─── Uploads ─────────────────────────────────────────────────────────

export interface UploadResult {
  id: string;
  url: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export const uploadApi = {
  async upload(file: File): Promise<{ file: UploadResult }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/control/uploads', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      let body: any;
      try { body = await res.json(); } catch { /* ignore */ }
      throw new ApiError(res.status, res.statusText, body);
    }
    return res.json();
  },
};

// ─── Audit Logs ─────────────────────────────────────────────────────

export const logsApi = {
  list(): Promise<any[]> {
    return request('/api/admin/logs');
  },
};

// ─── Overview / Health ───────────────────────────────────────────────

export const systemApi = {
  overview(): Promise<any> {
    return request('/api/admin/overview');
  },

  runtimeStatus(): Promise<any> {
    return request('/api/admin/runtime-status');
  },

  health(): Promise<any> {
    return request('/health');
  },

  matrixStatus(): Promise<any> {
    return request('/api/admin/matrix/status');
  },
};

// ─── OpenClaw ─────────────────────────────────────────────────────────

export const openclawApi = {
  async listRuntimes() {
    return request<{ runtimes: Record<string, unknown>[] }>('/api/admin/agents/runtime');
  },

  async listAgentTasks(agentId: string) {
    return request<{ tasks: Record<string, unknown>[] }>(
      `/api/admin/agents/${encodeURIComponent(agentId)}/tasks`,
    );
  },

  async getTaskLogs(taskId: string) {
    return request<{ logs: Record<string, unknown>[] }>(
      `/api/admin/agents/tasks/${encodeURIComponent(taskId)}/logs`,
    );
  },

  async channelStatuses() {
    return request<{ channels: Record<string, unknown>[] }>('/api/admin/channels/status');
  },
};
