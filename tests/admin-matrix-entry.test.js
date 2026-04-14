const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function makeRepo(records) {
  const state = {
    identityDirectory: {
      records: records || {}
    }
  };
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

function makeContext() {
  const config = {
    kubernetesSimulationMode: true,
    controlPlaneAdminToken: 'admintoken',
    controlPlaneJwtSecret: 'jwtsecret',
    controlPlaneJwtExpiresInSec: 3600,
    matrixWebhookSecret: 'mx',
    controlPlaneUsers: [
      { username: 'employee01', role: 'ops_admin', password: 'plain:test123', disabled: false },
      { username: 'disabled01', role: 'ops_admin', password: 'plain:test123', disabled: true }
    ]
  };
  return {
    config,
    repo: makeRepo({
      '@employee01:localhost': { username: 'employee01', role: 'ops_admin' },
      '@disabled01:localhost': { username: 'disabled01', role: 'ops_admin' }
    }),
    authService: new AuthService(config),
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

describe('matrix admin entry api', () => {
  test('returns showAdminEntry for mapped enabled admin user', async () => {
    const app = createServer(makeContext());
    const res = await request(app).get('/api/auth/matrix-admin-entry').query({ matrixUserId: '@employee01:localhost' });
    expect(res.status).toBe(200);
    expect(res.body.showAdminEntry).toBe(true);
    expect(res.body.adminUrl).toBe('/admin/openclaw-statistics.html');
  });

  test('returns hidden for mapped disabled user', async () => {
    const app = createServer(makeContext());
    const res = await request(app).get('/api/auth/matrix-admin-entry').query({ matrixUserId: '@disabled01:localhost' });
    expect(res.status).toBe(200);
    expect(res.body.showAdminEntry).toBe(false);
  });
});

