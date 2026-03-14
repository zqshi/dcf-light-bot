/**
 * WeKnora RAG API Client
 *
 * All requests go through DCF backend proxy: /api/control/weknora/*
 * The backend injects WeKnora service-account auth automatically.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = '/api/control/weknora';

async function wkRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(body?.error?.message || body?.message || `WeKnora ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// ─── Types ──────────────────────────────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  createdAt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  knowledgeBaseId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; id: string }[];
}

// ─── API ────────────────────────────────────────────────────────────

export const weKnoraApi = {
  listKnowledgeBases(): Promise<{ data: KnowledgeBase[] }> {
    return wkRequest('/knowledge-bases');
  },

  search(query: string, kbIds?: string[]): Promise<{ data: SearchResult[] }> {
    const qs = new URLSearchParams({ query });
    if (kbIds?.length) qs.set('kbIds', kbIds.join(','));
    return wkRequest(`/search?${qs}`);
  },

  /**
   * Sync a document to WeKnora knowledge base via DCF backend.
   */
  syncDocument(doc: { id?: string; title: string; content: string; type?: string }): Promise<{ success: boolean }> {
    return wkRequest('/sync-document', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  },

  /**
   * Non-streaming question answering.
   */
  async ask(query: string, kbIds?: string[]): Promise<{ answer: string; sources: { title: string; id: string }[] }> {
    return wkRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({ query, kbIds, stream: false }),
    });
  },

  /**
   * Stream chat completion via SSE through DCF backend proxy.
   * Calls onChunk for each token, onDone when complete.
   */
  async chat(
    sessionId: string,
    query: string,
    opts: {
      kbIds?: string[];
      onChunk: (text: string) => void;
      onSources?: (sources: { title: string; id: string }[]) => void;
      onDone: () => void;
      onError: (err: Error) => void;
      signal?: AbortSignal;
    },
  ): Promise<void> {
    const body = JSON.stringify({
      sessionId,
      query,
      kbIds: opts.kbIds ?? [],
      stream: true,
    });

    let res: Response;
    try {
      const controller = opts.signal ? undefined : new AbortController();
      const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : undefined;

      res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: opts.signal ?? controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
    } catch (err: any) {
      if (err.name !== 'AbortError') opts.onError(err);
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      opts.onError(new Error(`WeKnora chat ${res.status}: ${text}`));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      opts.onError(new Error('No response body'));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    // Read timeout: if no data for 30s, abort
    let lastDataTime = Date.now();
    const readTimeoutMs = 30000;

    try {
      while (true) {
        if (Date.now() - lastDataTime > readTimeoutMs) {
          reader.cancel();
          opts.onError(new Error('SSE read timeout'));
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;
        lastDataTime = Date.now();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              opts.onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                opts.onError(new Error(parsed.error));
                return;
              }
              if (parsed.choices?.[0]?.delta?.content) {
                opts.onChunk(parsed.choices[0].delta.content);
              }
              if (parsed.sources && opts.onSources) {
                opts.onSources(parsed.sources);
              }
            } catch {
              // non-JSON SSE line, skip
            }
          }
        }
      }
      opts.onDone();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        opts.onError(err);
      }
    }
  },
};
