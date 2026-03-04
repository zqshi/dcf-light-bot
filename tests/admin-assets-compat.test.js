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

function makeContext(authService, assetService) {
  return {
    config: { kubernetesSimulationMode: true },
    authService,
    instanceService: {
      list: async () => [],
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
    assetService,
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

describe('admin assets compat routes', () => {
  test('lists tool assets via unified assets contract', async () => {
    const assetService = {
      reportAsset: async () => ({}),
      listReportsByType: async () => [{ id: 'r_tool_1', assetType: 'tool', name: 'Tool Report', status: 'pending_review' }],
      listPendingReviews: async () => [],
      getReviewDashboard: async () => ({ pendingTotal: 0, overdueTotal: 0, escalatedTotal: 0 }),
      listReviewHistory: async () => [],
      reviewReport: async () => ({}),
      approveReport: async () => ({ report: { id: 'r_tool_1', status: 'approved' }, sharedSkill: { id: 'a_tool_1', assetType: 'tool' } }),
      rejectReport: async () => ({}),
      listSharedAssets: async () => [{ id: 'a_tool_1', assetType: 'tool', name: 'Shared Tool', sourceReportId: 'r_tool_1' }],
      bindSharedAsset: async () => ({ id: 'b_tool_1', tenantId: 'tenant_1', assetId: 'a_tool_1', assetType: 'tool' }),
      listAssetBindings: async () => [{ id: 'b_tool_1', tenantId: 'tenant_1', assetId: 'a_tool_1', assetType: 'tool' }]
    };
    const app = createServer(makeContext(makeAuth(), assetService));
    const agent = request.agent(app);
    await login(agent);

    const res = await agent.get('/api/admin/assets/tool');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('tool');
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(Array.isArray(res.body.sharedAssets)).toBe(true);
    expect(Array.isArray(res.body.bindings)).toBe(true);
    expect(Array.isArray(res.body.toolServices)).toBe(true);
  });

  test('supports publish and bind actions', async () => {
    const approveReport = jest.fn(async () => ({ report: { id: 'r_knowledge_1', status: 'approved' } }));
    const bindSharedAsset = jest.fn(async () => ({ id: 'b_1', tenantId: 'tenant_a', assetId: 'a_knowledge_1', assetType: 'knowledge' }));
    const assetService = {
      reportAsset: async () => ({}),
      listReportsByType: async () => [{ id: 'r_knowledge_1', assetType: 'knowledge', name: 'Case 1', status: 'pending_review' }],
      listPendingReviews: async () => [],
      getReviewDashboard: async () => ({ pendingTotal: 0, overdueTotal: 0, escalatedTotal: 0 }),
      listReviewHistory: async () => [],
      reviewReport: async () => ({}),
      approveReport,
      rejectReport: async () => ({}),
      listSharedAssets: async () => [{ id: 'a_knowledge_1', assetType: 'knowledge', name: 'Knowledge 1', sourceReportId: 'r_knowledge_1' }],
      bindSharedAsset,
      listAssetBindings: async () => []
    };
    const app = createServer(makeContext(makeAuth(), assetService));
    const agent = request.agent(app);
    await login(agent);

    const publishRes = await agent.post('/api/admin/assets/knowledge/r_knowledge_1/publish').send({});
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.success).toBe(true);
    expect(publishRes.body.action).toBe('publish');

    const bindBad = await agent.post('/api/admin/assets/knowledge/a_knowledge_1/bind').send({});
    expect(bindBad.status).toBe(400);

    const bindRes = await agent.post('/api/admin/assets/knowledge/a_knowledge_1/bind').send({ tenantId: 'tenant_a' });
    expect(bindRes.status).toBe(200);
    expect(bindRes.body.success).toBe(true);
    expect(bindRes.body.action).toBe('bind');
    expect(bindSharedAsset).toHaveBeenCalledWith('tenant_a', 'a_knowledge_1', 'knowledge', 'admin');
  });
});
