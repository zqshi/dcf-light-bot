const { WeKnoraService } = require('../src/integrations/weknora/WeKnoraService');

// Mock HTTP server
const http = require('http');
let mockServer;
let mockPort;
let lastRequest;
let mockResponse;

beforeAll((done) => {
  mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      lastRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : undefined,
      };
      const response = typeof mockResponse === 'function' ? mockResponse(req) : mockResponse;
      res.writeHead(response.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response.body || {}));
    });
  });
  mockServer.listen(0, () => {
    mockPort = mockServer.address().port;
    done();
  });
});

afterAll((done) => {
  mockServer.close(done);
});

beforeEach(() => {
  lastRequest = null;
  mockResponse = { status: 200, body: {} };
});

function createService(overrides = {}) {
  return new WeKnoraService({
    weKnoraEnabled: true,
    weKnoraApiUrl: `http://127.0.0.1:${mockPort}`,
    weKnoraJwtSecret: 'test-secret',
    ...overrides,
  });
}

describe('WeKnoraService', () => {
  test('throws when disabled', async () => {
    const svc = createService({ weKnoraEnabled: false });
    await expect(svc.query('test')).rejects.toThrow('not enabled');
  });

  test('authenticates and caches token', async () => {
    let authCallCount = 0;
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        authCallCount++;
        return { status: 200, body: { token: 'jwt-123', expires_in: 3600 } };
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'GET') {
        return { status: 200, body: { data: [{ id: 'kb-1', name: 'DCF KB' }] } };
      }
      return { status: 200, body: { choices: [{ message: { content: 'answer' } }] } };
    };

    const svc = createService();
    await svc.query('test question');
    expect(authCallCount).toBe(1);

    // Second call should reuse cached token
    await svc.query('test again');
    expect(authCallCount).toBe(1);
  });

  test('query() returns answer and sources', async () => {
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        return { status: 200, body: { token: 'jwt-123', expires_in: 3600 } };
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'GET') {
        return { status: 200, body: { data: [{ id: 'kb-1', name: 'DCF test' }] } };
      }
      if (req.url.includes('/chat/completions')) {
        return {
          status: 200,
          body: {
            choices: [{ message: { content: 'Q4目标是提升留存率' } }],
            sources: [{ title: '产品规划', id: 'doc-1' }],
          },
        };
      }
      return { status: 200, body: {} };
    };

    const svc = createService();
    const result = await svc.query('Q4目标是什么');
    expect(result.answer).toBe('Q4目标是提升留存率');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe('产品规划');
  });

  test('search() returns results', async () => {
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        return { status: 200, body: { token: 'jwt-123', expires_in: 3600 } };
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'GET') {
        return { status: 200, body: { data: [{ id: 'kb-1', name: 'DCF test' }] } };
      }
      if (req.url.includes('/knowledge/search')) {
        return { status: 200, body: { data: [{ id: 'r1', title: '产品规划', content: '...', score: 0.95 }] } };
      }
      return { status: 200, body: {} };
    };

    const svc = createService();
    const results = await svc.search('产品规划');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('产品规划');
    expect(results[0].score).toBe(0.95);
  });

  test('syncDocument() calls the correct endpoint', async () => {
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        return { status: 200, body: { token: 'jwt-123', expires_in: 3600 } };
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'GET') {
        return { status: 200, body: { data: [{ id: 'kb-1', name: 'DCF test' }] } };
      }
      if (req.url.includes('/documents') && req.method === 'POST') {
        return { status: 200, body: { success: true } };
      }
      return { status: 200, body: {} };
    };

    const svc = createService();
    await svc.syncDocument({ id: 'doc-1', title: '测试文档', content: '内容', type: 'doc' });
    expect(lastRequest.method).toBe('POST');
    expect(lastRequest.body.title).toBe('测试文档');
    expect(lastRequest.body.metadata.source).toBe('dcf');
  });

  test('_ensureDefaultKB() creates KB when none exists', async () => {
    let createKBCalled = false;
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        return { status: 200, body: { token: 'jwt-123', expires_in: 3600 } };
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'GET') {
        return { status: 200, body: { data: [] } }; // empty
      }
      if (req.url.includes('/knowledge-bases') && req.method === 'POST') {
        createKBCalled = true;
        return { status: 200, body: { id: 'new-kb-1' } };
      }
      return { status: 200, body: { choices: [{ message: { content: 'ok' } }] } };
    };

    const svc = createService();
    await svc.query('test');
    expect(createKBCalled).toBe(true);
  });

  test('gracefully handles auth failure (dev mode)', async () => {
    mockResponse = (req) => {
      if (req.url.includes('/auth/login')) {
        return { status: 401, body: { message: 'unauthorized' } };
      }
      if (req.url.includes('/knowledge-bases')) {
        return { status: 200, body: { data: [] } };
      }
      return { status: 200, body: { choices: [{ message: { content: 'no-auth answer' } }] } };
    };

    const svc = createService();
    const result = await svc.query('test');
    expect(result.answer).toBe('no-auth answer');
  });

  test('handles WeKnora server error', async () => {
    mockResponse = () => ({ status: 500, body: { message: 'internal error' } });
    const svc = createService();
    // Auth will fail, then query will fail
    await expect(svc.query('test')).rejects.toThrow('500');
  });
});
