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
      { username: 'admin', role: 'platform_admin', password: 'plain:admin123', disabled: false }
    ]
  });
}

function makeRepo() {
  const state = {};
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

function makeContext(authService) {
  const instance = {
    id: 'inst_sync',
    name: 'sync-agent',
    tenantId: 'tenant_sync',
    creator: '@alice:localhost',
    state: 'running',
    department: 'operations',
    jobCode: 'ops',
    jobTitle: '运维工程师',
    runtime: { endpoint: 'http://runtime' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return {
    config: {
      kubernetesSimulationMode: true,
      controlPlaneUsers: [],
      openclawImage: 'openclaw/openclaw:2026.2.27',
      openclawRuntimeVersion: '2026.2.27',
      openclawSourcePath: '/tmp/openclaw',
      deepseekApiBase: 'https://api.deepseek.com',
      deepseekModel: 'deepseek-chat',
      minimaxApiBase: 'https://api.minimaxi.com/anthropic',
      minimaxModel: 'MiniMax-M2.5',
      providers: [],
      ssoEnabled: true,
      ssoProvider: 'oidc',
      ssoBridgeLoginEnabled: true,
      ssoAuthorizeUrl: 'https://sso.example.com/authorize',
      ssoCallbackUrl: 'https://dcf.example.com/callback',
      ssoProfileMapping: { username: 'preferred_username', email: 'email', role: 'role', displayName: 'name' }
    },
    repo: makeRepo(),
    authService,
    instanceService: {
      list: async () => [instance],
      get: async (id) => (String(id) === instance.id ? instance : null),
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
      list: async () => [],
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

describe('admin sso identity mapping', () => {
  test('persists identity mapping via bridge login, disables manual admin maintenance, and supports sync', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);

    const bridge = await agent.post('/api/auth/sso/bridge-login').send({
      preferred_username: 'alice',
      email: 'alice@corp.local',
      role: 'ops_admin',
      name: 'Alice',
      matrixUserId: '@alice:localhost',
      employeeNo: 'E1001',
      jobCode: 'ops',
      jobTitle: '运维工程师',
      department: 'operations'
    });
    expect(bridge.status).toBe(200);
    expect(bridge.body.authenticated).toBe(true);

    await login(agent);

    const list = await agent.get('/api/admin/auth/identity-mappings');
    expect(list.status).toBe(410);

    const patch = await agent.post('/api/admin/auth/identity-mappings/%40alice%3Alocalhost').send({
      jobCode: 'finance'
    });
    expect(patch.status).toBe(410);

    const sync = await agent.post('/api/admin/employees/inst_sync/sync-identity').send({});
    expect(sync.status).toBe(200);
    expect(sync.body.success).toBe(true);
    expect(sync.body.mapping.jobCode).toBe('ops');
    expect(sync.body.employee.role).toBe('ops');
  });
});
