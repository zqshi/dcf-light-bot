const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('instance lifecycle routes', () => {
  test('supports rebuild/delete routes and batch lifecycle actions', async () => {
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
        rebuild: async (id) => ({ id, state: 'running' }),
        remove: async (id) => ({ id, deleted: true }),
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
        log: async () => ({})
      },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const rebuildRes = await request(app)
      .post('/api/control/instances/inst_1/rebuild')
      .set('Authorization', `Bearer ${token}`);
    expect(rebuildRes.status).toBe(200);
    expect(rebuildRes.body.data.state).toBe('running');

    const deleteRes = await request(app)
      .post('/api/control/instances/inst_1/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);

    const batchRes = await request(app)
      .post('/api/control/instances/batch-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'rebuild', instanceIds: ['inst_1', 'inst_2'] });
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.total).toBe(2);
    expect(batchRes.body.data.succeeded).toBe(2);
  });
});

