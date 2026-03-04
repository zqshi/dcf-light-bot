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
        { id: 'inst_a', name: 'agent-a', tenantId: 'tenant_a', matrixRoomId: '!roomA:localhost', state: 'running' },
        { id: 'inst_b', name: 'agent-b', tenantId: 'tenant_b', matrixRoomId: null, state: 'stopped' }
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
      list: async () => ([
        { id: 'a1', type: 'admin.instance.started', at: new Date(now - 1000).toISOString(), payload: { roomId: '!roomA:localhost' } },
        { id: 'a2', type: 'admin.asset.approved', at: new Date(now - 2000).toISOString(), payload: { roomId: '!roomX:localhost' } },
        { id: 'a3', type: 'matrix.bot.started', at: new Date(now - 3000).toISOString(), payload: {} },
        { id: 'a4', type: 'matrix.relay.started', at: new Date(now - 4000).toISOString(), payload: {} },
        { id: 'a5', type: 'matrix.relay.inbound', at: new Date(now - 5000).toISOString(), payload: { roomId: '!roomA:localhost' } },
        { id: 'a6', type: 'matrix.relay.delivery.succeeded', at: new Date(now - 6000).toISOString(), payload: { roomId: '!roomA:localhost' } },
        { id: 'a7', type: 'matrix.command.handled', at: new Date(now - 7000).toISOString(), payload: { phase: 'succeeded' } }
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

describe('admin matrix channels routes', () => {
  test('lists channels and rejects manual bind/unbind', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const listRes = await agent.get('/api/admin/matrix/channels');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.rows)).toBe(true);
    expect(listRes.body.summary.channels).toBeGreaterThanOrEqual(2);
    expect(listRes.body.status.botOnline).toBe(true);
    expect(listRes.body.status.deliverySucceeded24h).toBeGreaterThanOrEqual(1);

    const bindRes = await agent
      .post('/api/admin/matrix/channels/%21roomX%3Alocalhost/bind-instance')
      .send({ instanceId: 'inst_b' });
    expect(bindRes.status).toBe(410);
    expect(bindRes.body.reason).toBe('fixed_session_mapping');

    const afterBind = await agent.get('/api/admin/matrix/channels?keyword=roomX');
    expect(afterBind.status).toBe(200);
    expect(afterBind.body.rows[0].bound).toBe(false);
    expect(afterBind.body.rows[0].boundInstanceId).toBe('');

    const unbindRes = await agent.post('/api/admin/matrix/channels/%21roomX%3Alocalhost/unbind').send({});
    expect(unbindRes.status).toBe(410);
    expect(unbindRes.body.reason).toBe('fixed_session_mapping');

    const statusRes = await agent.get('/api/admin/matrix/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.relayOnline).toBe(true);
    expect(statusRes.body.inbound24h).toBeGreaterThanOrEqual(1);
  });
});
