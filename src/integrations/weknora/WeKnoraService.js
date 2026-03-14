/**
 * WeKnoraService — DCF ↔ WeKnora RAG integration
 *
 * Server-to-server authenticated proxy:
 *  - Authenticates with WeKnora using service account credentials
 *  - Caches JWT token with TTL-based refresh
 *  - Auto-creates/caches a default DCF knowledge base
 *
 * API methods:
 *  - query(): chat-style RAG question answering
 *  - search(): semantic document search
 *  - syncDocument(): push a document into the DCF knowledge base
 *  - proxy(): forward arbitrary requests (for frontend proxy route)
 */

const http = require('http');
const https = require('https');

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5min before expiry
const DEFAULT_KB_NAME = 'DCF 企业知识库';

class WeKnoraService {
  constructor(config) {
    this.apiUrl = String(config.weKnoraApiUrl || 'http://weknora-app:8080').replace(/\/+$/, '');
    this.enabled = Boolean(config.weKnoraEnabled);
    this.jwtSecret = String(config.weKnoraJwtSecret || '').trim();
    this._token = null;
    this._tokenExpiresAt = 0;
    this._defaultKbId = null;
  }

  async _rawRequest(method, path, body, extraHeaders) {
    if (!this.enabled) {
      throw new Error('WeKnora is not enabled');
    }

    const url = new URL(path, this.apiUrl);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...(extraHeaders || {}),
          },
          timeout: 30000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 400) {
              const err = new Error(`WeKnora ${res.statusCode}: ${data.slice(0, 200)}`);
              err.statusCode = res.statusCode;
              return reject(err);
            }
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve(data);
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('WeKnora request timeout'));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Get a valid auth token, refreshing if necessary.
   * Falls back to no-auth if WeKnora doesn't require it (dev mode).
   */
  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this._token;
    }
    try {
      const result = await this._rawRequest('POST', '/api/v1/auth/login', {
        username: 'dcf-service',
        password: this.jwtSecret || 'dcf-service-account',
      });
      this._token = result.token || result.access_token || null;
      // Default to 1 hour if no expiry info
      const expiresIn = Number(result.expires_in || 3600) * 1000;
      this._tokenExpiresAt = Date.now() + expiresIn;
      return this._token;
    } catch {
      // WeKnora may not require auth in dev mode — proceed without token
      this._token = null;
      this._tokenExpiresAt = Date.now() + 60_000; // retry in 1min
      return null;
    }
  }

  async _request(method, path, body) {
    const token = await this._getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this._rawRequest(method, path, body, headers);
  }

  /**
   * Get or create the default DCF knowledge base.
   */
  async _ensureDefaultKB() {
    if (this._defaultKbId) return this._defaultKbId;
    try {
      const result = await this._request('GET', '/api/v1/knowledge-bases');
      const bases = Array.isArray(result?.data) ? result.data : [];
      const existing = bases.find((kb) =>
        String(kb.name || '').includes('DCF') || String(kb.description || '').includes('dcf'));
      if (existing) {
        this._defaultKbId = existing.id;
        return this._defaultKbId;
      }
      // Create one
      const created = await this._request('POST', '/api/v1/knowledge-bases', {
        name: DEFAULT_KB_NAME,
        description: 'DCF 平台自动同步的企业知识库',
      });
      this._defaultKbId = created?.data?.id || created?.id || null;
      return this._defaultKbId;
    } catch {
      return null; // Non-fatal — sync will just skip
    }
  }

  /**
   * Ask a question against one or more knowledge bases.
   * Returns { answer, sources }.
   */
  async query(question, kbIds) {
    if (!kbIds || !kbIds.length) {
      const defaultKb = await this._ensureDefaultKB();
      kbIds = defaultKb ? [defaultKb] : [];
    }
    const body = {
      query: String(question || '').trim(),
      knowledge_base_ids: kbIds,
      stream: false,
    };
    const result = await this._request('POST', '/api/v1/chat/completions', body);
    const choice = result?.choices?.[0];
    return {
      answer: choice?.message?.content || String(result?.answer || ''),
      sources: Array.isArray(result?.sources) ? result.sources : [],
    };
  }

  /**
   * Semantic search across knowledge bases.
   * Returns array of { id, title, content, score }.
   */
  async search(query, kbIds) {
    if (!kbIds || !kbIds.length) {
      const defaultKb = await this._ensureDefaultKB();
      kbIds = defaultKb ? [defaultKb] : [];
    }
    const qs = new URLSearchParams({ query: String(query || '').trim() });
    if (kbIds.length) qs.set('knowledge_base_ids', kbIds.join(','));
    const result = await this._request('GET', `/api/v1/knowledge/search?${qs}`);
    return Array.isArray(result?.data) ? result.data : [];
  }

  /**
   * Push/sync a document into WeKnora's DCF knowledge base.
   */
  async syncDocument(doc) {
    const kbId = await this._ensureDefaultKB();
    if (!kbId) throw new Error('No WeKnora knowledge base available');
    const body = {
      title: String(doc.title || ''),
      content: String(doc.content || ''),
      metadata: {
        source: 'dcf',
        documentId: String(doc.id || ''),
        type: String(doc.type || 'doc'),
      },
    };
    return this._request('POST', `/api/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents`, body);
  }

  /**
   * Forward a request from the frontend proxy route.
   * Injects the service token automatically.
   */
  async proxy(method, path, body) {
    return this._request(method, path, body);
  }
}

module.exports = { WeKnoraService };
