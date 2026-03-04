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

function makeContext(authService) {
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
      providers: [
        { name: 'deepseek', key: 'sk-deepseek-old' },
        { name: 'minimax', key: 'sk-minimax-old' }
      ]
    },
    authService,
    instanceService: {
      list: async () => ([]),
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
      list: async () => ([]),
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

describe('admin openclaw config routes', () => {
  test('gets and updates config with masked secrets', async () => {
    const app = createServer(makeContext(makeAuth()));
    const agent = request.agent(app);
    await login(agent);

    const getRes = await agent.get('/api/admin/runtime/openclaw-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.providers.deepseek.hasKey).toBe(true);
    expect(getRes.body.providers.deepseek.apiKeyMasked).toContain('***');
    expect(getRes.body.providers.deepseek.apiKeyMasked).not.toContain('sk-deepseek-old');

    const postRes = await agent.post('/api/admin/runtime/openclaw-config').send({
      runtime: {
        openclawImage: 'openclaw/openclaw:2026.3.1',
        openclawRuntimeVersion: '2026.3.1',
        openclawSourcePath: '/Users/zqs/Downloads/project/dependencies/openclaw'
      },
      providers: {
        deepseek: {
          enabled: true,
          apiBase: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          apiKey: 'sk-deepseek-new'
        },
        minimax: {
          enabled: true,
          apiBase: 'https://api.minimaxi.com/anthropic',
          model: 'MiniMax-M2.5',
          apiKey: 'sk-minimax-new'
        }
      },
      permissionTemplate: {
        commandAllowlist: ['/help', '/status'],
        approvalByRisk: {
          L4: { requiredApprovals: 2, requiredAnyRoles: ['platform_admin'], distinctRoles: true }
        }
      }
    });
    expect(postRes.status).toBe(200);
    expect(postRes.body.runtime.openclawRuntimeVersion).toBe('2026.3.1');
    expect(postRes.body.providers.deepseek.hasKey).toBe(true);
    expect(postRes.body.providers.deepseek.apiKeyMasked).toContain('***');
    expect(postRes.body.providers.deepseek.apiKeyMasked).not.toContain('sk-deepseek-new');

    const afterRes = await agent.get('/api/admin/runtime/openclaw-config');
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.runtime.openclawImage).toBe('openclaw/openclaw:2026.3.1');
    expect(afterRes.body.permissionTemplate.commandAllowlist).toEqual(['/help', '/status']);
  });
});
