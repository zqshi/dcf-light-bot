const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function makeAuth() {
  return new AuthService({
    controlPlaneAdminToken: 'admintoken',
    controlPlaneJwtSecret: 'jwtsecret',
    controlPlaneJwtExpiresInSec: 3600,
    matrixWebhookSecret: 'mx',
    controlPlaneUsers: [
      { username: 'admin', role: 'ops_admin', password: 'plain:admin123', disabled: false }
    ]
  });
}

function makeContext(authService) {
  return {
    config: { kubernetesSimulationMode: true, controlPlaneUsers: [] },
    authService,
    instanceService: {
      list: async () => [],
      get: async () => ({}),
      start: async () => ({}),
      stop: async () => ({}),
      rebuild: async () => ({}),
      remove: async () => ({}),
      createFromMatrix: async () => ({}),
      buildMatrixCard: () => ({})
    },
    runtimeProxyService: { invoke: async () => ({ ok: true }) },
    skillService: {
      reportAsset: async () => ({}),
      listReportsByType: async () => [],
      approveReport: async () => ({}),
      rejectReport: async () => ({}),
      listSharedAssets: async () => [],
      bindSharedSkill: async () => ({}),
      bindSharedAsset: async () => ({}),
      listAssetBindings: async () => []
    },
    assetService: {
      reportAsset: async () => ({}),
      listReportsByType: async () => [],
      listPendingReviews: async () => [],
      getReviewDashboard: async () => ({ pendingTotal: 0, overdueTotal: 0, escalatedTotal: 0 }),
      listReviewHistory: async () => [],
      reviewReport: async () => ({}),
      approveReport: async () => ({}),
      rejectReport: async () => ({}),
      listSharedAssets: async () => [],
      bindSharedAsset: async () => ({}),
      listAssetBindings: async () => []
    },
    auditService: {
      list: async () => [],
      queryPage: async () => ({ rows: [], total: 0, cursor: '0', nextCursor: null, hasMore: false }),
      export: async () => ({ contentType: 'application/json', body: '[]', nextCursor: null, hasMore: false }),
      log: async () => ({})
    },
    matrixBot: { processTextMessage: async () => ({ ignored: true }) }
  };
}

async function login(agent) {
  const res = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  expect(res.status).toBe(200);
}

describe('AI Gateway — Traces', () => {
  test('GET /api/admin/ai-gateway/traces returns seeded traces', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/traces');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
  });

  test('GET /api/admin/ai-gateway/traces supports pagination', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/traces?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.limit).toBe(5);
  });

  test('GET /api/admin/ai-gateway/traces supports status filter', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/traces?status=completed');
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.status).toBe('completed');
    }
  });

  test('GET /api/admin/ai-gateway/traces/:traceId returns detail', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const list = await agent.get('/api/admin/ai-gateway/traces?limit=1');
    const traceId = list.body.items[0].traceId;

    const res = await agent.get(`/api/admin/ai-gateway/traces/${encodeURIComponent(traceId)}`);
    expect(res.status).toBe(200);
    expect(res.body.traceId).toBe(traceId);
    expect(res.body.flowNodes).toBeDefined();
    expect(Array.isArray(res.body.flowNodes)).toBe(true);
  });

  test('GET /api/admin/ai-gateway/traces/:traceId returns 404 for unknown', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/traces/trc_nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('AI Gateway — Stats', () => {
  test('GET /api/admin/ai-gateway/stats returns summary', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.completed).toBe('number');
    expect(typeof res.body.blocked).toBe('number');
    expect(typeof res.body.failed).toBe('number');
    expect(typeof res.body.totalTokens).toBe('number');
  });
});

describe('AI Gateway — Costs', () => {
  test('GET /api/admin/ai-gateway/costs returns aggregated data', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/costs');
    expect(res.status).toBe(200);
    expect(typeof res.body.totalPromptTokens).toBe('number');
    expect(typeof res.body.totalCompletionTokens).toBe('number');
    expect(typeof res.body.totalEstimatedCost).toBe('number');
    expect(Array.isArray(res.body.userSummary)).toBe(true);
    expect(Array.isArray(res.body.modelSummary)).toBe(true);
    expect(Array.isArray(res.body.dailyTrend)).toBe(true);
  });
});

describe('AI Gateway — Risk Rules', () => {
  test('GET /api/admin/ai-gateway/risk-rules returns default rules', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/ai-gateway/risk-rules');
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(5);
    const ids = res.body.rows.map(r => r.ruleId);
    expect(ids).toContain('private_key');
    expect(ids).toContain('api_key');
    expect(ids).toContain('id_card');
  });

  test('POST /api/admin/ai-gateway/risk-rules creates a new rule', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.post('/api/admin/ai-gateway/risk-rules').send({
      ruleId: 'test_custom',
      displayName: 'Test Custom Rule',
      description: 'For testing',
      pattern: 'password\\s*=',
      severity: 'medium',
      action: 'allow'
    });
    expect(res.status).toBe(200);
    expect(res.body.rule.ruleId).toBe('test_custom');

    const list = await agent.get('/api/admin/ai-gateway/risk-rules');
    const found = list.body.rows.find(r => r.ruleId === 'test_custom');
    expect(found).toBeTruthy();
    expect(found.displayName).toBe('Test Custom Rule');
  });

  test('POST /api/admin/ai-gateway/risk-rules rejects invalid regex', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.post('/api/admin/ai-gateway/risk-rules').send({
      ruleId: 'bad_regex',
      displayName: 'Bad',
      pattern: '(unclosed',
      severity: 'low',
      action: 'allow'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('POST /api/admin/ai-gateway/risk-rules/:ruleId/toggle toggles enabled state', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const before = await agent.get('/api/admin/ai-gateway/risk-rules');
    const rule = before.body.rows.find(r => r.ruleId === 'phone_number');
    const wasBefore = rule.isEnabled;

    await agent.post('/api/admin/ai-gateway/risk-rules/phone_number/toggle');
    const after = await agent.get('/api/admin/ai-gateway/risk-rules');
    const ruleAfter = after.body.rows.find(r => r.ruleId === 'phone_number');
    expect(ruleAfter.isEnabled).toBe(!wasBefore);
  });

  test('POST /api/admin/ai-gateway/risk-rules/test detects risk', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.post('/api/admin/ai-gateway/risk-rules/test').send({
      text: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...'
    });
    expect(res.status).toBe(200);
    expect(res.body.hits.length).toBeGreaterThan(0);
    expect(res.body.highestAction).toBe('block');
  });

  test('POST /api/admin/ai-gateway/risk-rules/test returns safe for clean text', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.post('/api/admin/ai-gateway/risk-rules/test').send({
      text: 'Hello, this is a normal message with no sensitive data.'
    });
    expect(res.status).toBe(200);
    expect(res.body.hits).toHaveLength(0);
  });
});

describe('AI Gateway — Auth required', () => {
  test('returns 401 without session', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);

    const endpoints = [
      '/api/admin/ai-gateway/traces',
      '/api/admin/ai-gateway/stats',
      '/api/admin/ai-gateway/costs',
      '/api/admin/ai-gateway/risk-rules'
    ];

    for (const url of endpoints) {
      const res = await agent.get(url);
      expect(res.status).toBe(401);
    }
  });
});
