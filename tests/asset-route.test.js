const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function makeCtx(authService) {
  return {
    config: { kubernetesSimulationMode: true },
    authService,
    instanceService: {
      list: async () => [],
      get: async () => ({}),
      start: async () => ({}),
      stop: async () => ({}),
      createFromMatrix: async () => ({}),
      buildMatrixCard: () => ({})
    },
    runtimeProxyService: { invoke: async () => ({ ok: true }) },
    assetService: {
      reportAsset: async (body) => ({ id: 'r1', ...body, status: 'pending' }),
      listReportsByType: async () => [{ id: 'r1', assetType: 'tool' }],
      listPendingReviews: async () => [{ id: 'r_pending', status: 'pending_review' }],
      getReviewDashboard: async () => ({
        pendingTotal: 3,
        overdueTotal: 1,
        escalatedTotal: 1,
        reviewerQueue: 2,
        byAssetType: { skill: 1, tool: 1, knowledge: 1 }
      }),
      escalateOverdueReviews: async () => ({ pendingTotal: 3, escalated: 1 }),
      listReviewHistory: async () => [{ reviewer: 'reviewer_1', decision: 'approve' }],
      reviewReport: async () => ({ report: { id: 'r1', status: 'pending_review' }, stage: { remainingApprovals: 1 } }),
      approveReport: async () => ({ report: { id: 'r1', status: 'approved' }, sharedSkill: { id: 'a1', assetType: 'tool' } }),
      rejectReport: async () => ({ id: 'r1', status: 'rejected' }),
      listSharedAssets: async () => [{ id: 'a1', assetType: 'tool' }],
      bindSharedAsset: async () => ({ id: 'b1', tenantId: 't1', assetId: 'a1', assetType: 'tool' }),
      listAssetBindings: async () => [{ id: 'b1', assetType: 'tool' }]
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
    auditService: { list: async () => [], log: async () => ({}) },
    matrixBot: { processTextMessage: async () => ({ ignored: true }) }
  };
}

describe('Asset route', () => {
  const auth = new AuthService({
    controlPlaneAdminToken: 'admintoken',
    controlPlaneJwtSecret: 'jwtsecret',
    controlPlaneJwtExpiresInSec: 3600,
    matrixWebhookSecret: 'mx',
    controlPlaneUsers: [
      { username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false },
      { username: 'reviewer', role: 'reviewer', password: 'plain:review123', disabled: false }
    ]
  });

  test('ops can list and bind tool assets', async () => {
    const app = createServer(makeCtx(auth));
    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const listRes = await request(app)
      .get('/api/control/assets/shared?type=tool')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data[0].assetType).toBe('tool');

    const bindRes = await request(app)
      .post('/api/control/assets/bindings')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 't1', assetId: 'a1', assetType: 'tool' });
    expect(bindRes.status).toBe(201);
    expect(bindRes.body.data.assetType).toBe('tool');
  });

  test('reviewer can query pending reviews and review history', async () => {
    const app = createServer(makeCtx(auth));
    const login = await request(app).post('/api/control/auth/login').send({ username: 'reviewer', password: 'review123' });
    const token = login.body.data.token;

    const pendingRes = await request(app)
      .get('/api/control/assets/reviews/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data[0].status).toBe('pending_review');

    const historyRes = await request(app)
      .get('/api/control/assets/reports/r1/reviews')
      .set('Authorization', `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data[0].reviewer).toBe('reviewer_1');

    const dashboardRes = await request(app)
      .get('/api/control/assets/reviews/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.data.pendingTotal).toBe(3);

    const escalateRes = await request(app)
      .post('/api/control/assets/reviews/escalate')
      .set('Authorization', `Bearer ${token}`)
      .send({ slaHours: 24, maxLevel: 3, cooldownHours: 4 });
    expect(escalateRes.status).toBe(200);
    expect(escalateRes.body.data.escalated).toBe(1);

    const batchRes = await request(app)
      .post('/api/control/assets/reviews/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportIds: ['r1', 'r2'], decision: 'approve', opinion: 'batch ok' });
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.total).toBe(2);
    expect(batchRes.body.data.succeeded).toBe(2);
  });
});
