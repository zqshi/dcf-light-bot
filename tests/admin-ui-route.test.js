const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function makeContext(authService) {
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
  };
}

describe('admin ui static routes', () => {
  test('serves admin index and static app.js', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: []
    });
    const app = createServer(makeContext(auth));

    const indexRes = await request(app).get('/admin');
    expect([200, 301]).toContain(indexRes.status);

    const indexRes2 = await request(app).get('/admin/');
    expect(indexRes2.status).toBe(200);
    expect(indexRes2.headers['content-type']).toContain('text/html');
    expect(indexRes2.text).toContain('DCF Light Bot 管理后台');

    const jsRes = await request(app).get('/admin/app.js');
    expect(jsRes.status).toBe(200);
    expect(jsRes.headers['content-type']).toContain('javascript');

    const matrixRes = await request(app).get('/admin/matrix-channels.html');
    expect(matrixRes.status).toBe(404);

    const notificationRes = await request(app).get('/admin/notifications.html');
    expect(notificationRes.status).toBe(200);
    expect(notificationRes.headers['content-type']).toContain('text/html');

    const disabledRes = await request(app).get('/admin/runtime.html');
    expect(disabledRes.status).toBe(404);
  });
});
