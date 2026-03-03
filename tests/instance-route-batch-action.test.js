const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('instance batch action route', () => {
  test('supports batch start and stop', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: [{ username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false }]
    });

    const app = createServer({
      config: { kubernetesSimulationMode: true },
      authService: auth,
      instanceService: {
        list: async () => [],
        get: async () => ({}),
        start: async (id) => ({ id, state: 'running' }),
        stop: async (id) => ({ id, state: 'stopped' }),
        createFromMatrix: async () => ({}),
        buildMatrixCard: () => ({})
      },
      runtimeProxyService: { invoke: async () => ({ ok: true }) },
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
      skillService: {
        reportAsset: async () => ({}),
        listReportsByType: async () => [],
        approveReport: async () => ({}),
        rejectReport: async () => ({}),
        listSharedAssets: async () => [],
        bindSharedSkill: async () => ({}),
        listAssetBindings: async () => []
      },
      auditService: {
        list: async () => [],
        queryPage: async () => ({ rows: [], total: 0, cursor: '0', nextCursor: null, hasMore: false }),
        export: async () => ({ contentType: 'application/json', body: '[]', nextCursor: null, hasMore: false }),
        traceByInstance: async () => ({ instanceId: 'x', total: 0, byType: {}, latestAt: null, events: [] }),
        log: async () => ({})
      },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const startRes = await request(app)
      .post('/api/control/instances/batch-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'start', instanceIds: ['inst_1', 'inst_2'] });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.total).toBe(2);
    expect(startRes.body.data.succeeded).toBe(2);

    const stopRes = await request(app)
      .post('/api/control/instances/batch-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'stop', instanceIds: ['inst_1'] });
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.action).toBe('stop');
    expect(stopRes.body.data.succeeded).toBe(1);
  });
});
