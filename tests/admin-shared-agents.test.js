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
      { username: 'admin', role: 'platform_admin', password: 'plain:admin123', disabled: false }
    ]
  });
}

function makeRepo(seed = {}) {
  const state = { ...seed };
  return {
    async getPlatformConfig(key) {
      return state[String(key)] || null;
    },
    async setPlatformConfig(key, value) {
      state[String(key)] = value;
      return value;
    }
  };
}

function makeContext(authService, auditEvents = []) {
  const audits = Array.isArray(auditEvents) ? auditEvents.slice() : [];
  return {
    config: {
      kubernetesSimulationMode: true,
      controlPlaneUsers: [],
      openclawImage: 'openclaw/openclaw:2026.2.27',
      openclawRuntimeVersion: '2026.2.27',
      openclawSourcePath: '/tmp/openclaw',
      deepseekApiBase: 'https://api.deepseek.com',
      deepseekModel: 'deepseek-chat',
      minimaxApiBase: 'https://api.minimaxi.com/anthropic',
      minimaxModel: 'MiniMax-M2.5',
      providers: []
    },
    repo: makeRepo(),
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
      list: async () => audits,
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

describe('admin shared agents routes', () => {
  test('is read-only for manual operations', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const registerRes = await agent.post('/api/admin/agents/shared/register').send({
      name: '采购比价Agent',
      capabilitySignature: 'procurement:compare-price:v1'
    });
    expect(registerRes.status).toBe(410);
    expect(registerRes.body.error).toBe('manual_register_disabled');

    const updateRes = await agent.post('/api/admin/agents/shared/shared_agent_1').send({ status: 'paused' });
    expect(updateRes.status).toBe(410);
    expect(updateRes.body.error).toBe('manual_update_disabled');

    const deleteRes = await agent.post('/api/admin/agents/shared/shared_agent_1/delete').send({});
    expect(deleteRes.status).toBe(410);
    expect(deleteRes.body.error).toBe('manual_delete_disabled');

    const bindRes = await agent.post('/api/admin/agents/shared/auto-bind/inst_test').send({ sharedAgentId: 'shared_agent_1' });
    expect(bindRes.status).toBe(410);
    expect(bindRes.body.error).toBe('manual_bind_disabled');
  });

  test('upserts shared agents from runtime events with signature de-dup and usage count', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const upsert1 = await agent.post('/api/admin/agents/shared/runtime-events').send({
      events: [
        {
          name: '采购比价Agent',
          capabilitySignature: 'procurement:compare-price:v1',
          ownerEmployeeId: 'inst_x1',
          spawnedBy: '@employee01:localhost',
          tags: ['采购', '比价'],
          jobCodes: ['procurement']
        },
        {
          name: '采购比价Agent重复触发',
          capabilitySignature: 'procurement:compare-price:v1',
          ownerEmployeeId: 'inst_x1',
          spawnedBy: '@employee01:localhost',
          tags: ['供应链'],
          jobCodes: ['procurement']
        }
      ]
    });
    expect(upsert1.status).toBe(200);
    expect(upsert1.body.success).toBe(true);
    expect(Number(upsert1.body.upserted)).toBe(2);

    const list = await agent.get('/api/admin/agents/shared');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.rows)).toBe(true);
    expect(list.body.rows.length).toBe(1);

    const row = list.body.rows[0];
    expect(row.capabilitySignature).toBe('procurement:compare-price:v1');
    expect(row.source).toBe('runtime/openclaw');
    expect(row.ownerEmployeeId).toBe('inst_x1');
    expect(row.spawnedBy).toBe('@employee01:localhost');
    expect(Number(row.usageCount)).toBe(2);
    expect(Array.isArray(row.tags)).toBe(true);
    expect(row.tags).toEqual(expect.arrayContaining(['采购', '比价', '供应链']));

    const recommend = await agent.get('/api/admin/agents/shared/recommend?jobCode=procurement');
    expect(recommend.status).toBe(200);
    expect(Array.isArray(recommend.body.rows)).toBe(true);
    expect(recommend.body.rows.some((x) => String(x.id) === String(row.id))).toBe(true);
  });

  test('reconciles shared agents from audit runtime discovered events', async () => {
    const auditEvents = [
      {
        id: 'audit_shared_1',
        type: 'runtime.openclaw.shared_agent.discovered',
        payload: {
          name: '合同审阅Agent',
          capabilitySignature: 'legal:contract-review:v1',
          ownerEmployeeId: 'inst_legal_1',
          spawnedBy: '@employee02:localhost',
          tags: ['法务'],
          jobCodes: ['legal']
        },
        at: '2026-03-05T10:00:00.000Z'
      }
    ];
    const app = createServer(makeContext(makeAuth(), auditEvents));
    const agent = request.agent(app);
    await login(agent);

    const list = await agent.get('/api/admin/agents/shared');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.rows)).toBe(true);
    expect(list.body.rows.some((x) => x.capabilitySignature === 'legal:contract-review:v1')).toBe(true);
  });
});
