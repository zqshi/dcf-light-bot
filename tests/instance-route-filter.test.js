const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('instance route filters', () => {
  test('supports server-side filters by state/name/tenantId', async () => {
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
        list: async () => [
          { id: 'inst_1', tenantId: 'tenant_alpha', name: 'alice-agent', state: 'running' },
          { id: 'inst_2', tenantId: 'tenant_beta', name: 'bob-agent', state: 'failed' },
          { id: 'inst_3', tenantId: 'tenant_alpha', name: 'alice-dev', state: 'running' }
        ],
        get: async () => ({}),
        start: async () => ({}),
        stop: async () => ({}),
        createFromMatrix: async () => ({}),
        buildMatrixCard: () => ({})
      },
      runtimeProxyService: { invoke: async () => ({}) },
      skillService: {
        reportAsset: async () => ({}),
        listReportsByType: async () => [],
        approveReport: async () => ({}),
        rejectReport: async () => ({}),
        listSharedAssets: async () => [],
        bindSharedSkill: async () => ({}),
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
    });

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const res = await request(app)
      .get('/api/control/instances?state=running&name=alice&tenantId=tenant_alpha')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('inst_1');
  });
});
