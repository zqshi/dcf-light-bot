const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function makeCtx(authService, releasePreflightService) {
  return {
    config: { kubernetesSimulationMode: true },
    authService,
    releasePreflightService,
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
  };
}

describe('release preflight route', () => {
  test('ops can query preflight report', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: [{ username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false }]
    });

    const app = createServer(makeCtx(auth, {
      generateReport: () => ({ ok: true, summary: { totalChecks: 6, failedChecks: 0 } }),
      assertReady: () => ({ ok: true })
    }));

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const res = await request(app)
      .get('/api/control/release/preflight')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  test('assert endpoint returns structured failure payload', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: [{ username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false }]
    });

    const app = createServer(makeCtx(auth, {
      generateReport: () => ({ ok: false }),
      assertReady: () => {
        const error = new Error('release preflight failed');
        error.statusCode = 422;
        error.code = 'RELEASE_PREFLIGHT_FAILED';
        error.report = { ok: false, checks: [{ name: 'prod-guardrails', status: 'failed' }] };
        throw error;
      }
    }));

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const res = await request(app)
      .post('/api/control/release/preflight/assert')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RELEASE_PREFLIGHT_FAILED');
  });
});
