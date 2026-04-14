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
      { username: 'admin', role: 'ops_admin', password: 'plain:admin123', disabled: false },
      { username: 'auditor', role: 'auditor', password: 'plain:audit123', disabled: true }
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
        { id: 'inst1', name: 'A', tenantId: 'tenant_a', matrixRoomId: '!roomA:localhost', state: 'running' },
        { id: 'inst2', name: 'B', tenantId: 'tenant_b', state: 'failed' }
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
      getReviewDashboard: async () => ({ pendingTotal: 3, overdueTotal: 1, escalatedTotal: 0 }),
      listReviewHistory: async () => [],
      reviewReport: async () => ({}),
      approveReport: async () => ({}),
      rejectReport: async () => ({}),
      listSharedAssets: async (type) => {
        if (type === 'skill') return [{ id: 's1' }, { id: 's2' }];
        if (type === 'tool') return [{ id: 't1' }];
        if (type === 'knowledge') return [{ id: 'k1' }, { id: 'k2' }];
        return [];
      },
      bindSharedAsset: async () => ({}),
      listAssetBindings: async (type) => {
        if (type === 'skill') return [{ id: 'bs1' }];
        if (type === 'tool') return [{ id: 'bt1' }, { id: 'bt2' }];
        if (type === 'knowledge') return [];
        return [];
      }
    },
    auditService: {
      list: async () => ([
        { id: 'a1', type: 'instance.provisioned', at: new Date(now - 1000).toISOString() },
        { id: 'a2', type: 'admin.instance.started', at: new Date(now - 2000).toISOString() },
        { id: 'a3', type: 'admin.asset.approved', at: new Date(now - 3000).toISOString() },
        { id: 'a4', type: 'auth.login.succeeded', at: new Date(now - 4000).toISOString() }
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

describe('admin overview payload', () => {
  test('returns capability-aligned overview with compatibility fields', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/overview');
    expect(res.status).toBe(200);

    expect(res.body.overview.platform.instancesTotal).toBe(2);
    expect(res.body.overview.platform.runningInstances).toBe(1);
    expect(res.body.overview.platform.abnormalInstances).toBe(1);
    expect(res.body.overview.assets.pendingReviews).toBe(3);
    expect(res.body.overview.assets.overdueReviews).toBe(1);
    expect(typeof res.body.overview.security.disabledUsers).toBe('number');

    expect(Array.isArray(res.body.focus)).toBe(true);
  });
});
