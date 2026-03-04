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
  const now = Date.now();
  return {
    config: { kubernetesSimulationMode: true, controlPlaneUsers: [] },
    authService,
    instanceService: {
      list: async () => ([
        { id: 'inst_failed', name: 'bad-agent', tenantId: 'tenant_a', state: 'failed', updatedAt: new Date(now - 1000).toISOString() },
        { id: 'inst_ok', name: 'good-agent', tenantId: 'tenant_b', state: 'running' }
      ]),
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
      getReviewDashboard: async () => ({ pendingTotal: 2, overdueTotal: 1, escalatedTotal: 0 }),
      listReviewHistory: async () => [],
      reviewReport: async () => ({}),
      approveReport: async () => ({}),
      rejectReport: async () => ({}),
      listSharedAssets: async () => [],
      bindSharedAsset: async () => ({}),
      listAssetBindings: async () => []
    },
    auditService: {
      list: async () => ([
        { id: 'a1', type: 'matrix.relay.delivery.failed', at: new Date(now - 2000).toISOString(), payload: {} },
        { id: 'a2', type: 'instance.provision.failed', at: new Date(now - 3000).toISOString(), payload: {} }
      ]),
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

describe('admin notifications api', () => {
  test('returns aggregated actionable notifications', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/notifications');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    expect(res.body.summary.high).toBeGreaterThanOrEqual(1);
  });
});
