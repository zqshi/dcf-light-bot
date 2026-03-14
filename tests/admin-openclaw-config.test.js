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

function makeMemoryRepo(seed = {}) {
  const data = { ...seed };
  return {
    async getPlatformConfig(key) {
      return data[String(key)] || null;
    },
    async setPlatformConfig(key, value) {
      data[String(key)] = value;
      return value;
    }
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

  test('hydrates openclaw config from repository and persists updates', async () => {
    const repo = makeMemoryRepo({
      openclawConfig: {
        runtime: {
          openclawImage: 'openclaw/openclaw:2026.4.0',
          openclawRuntimeVersion: '2026.4.0',
          openclawSourcePath: '/persisted/openclaw'
        },
        providers: {
          deepseek: { enabled: false, apiBase: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
          minimax: { enabled: true, apiBase: 'https://api.minimaxi.com/anthropic', model: 'MiniMax-M2.5', apiKey: 'sk-persisted' }
        },
        permissionTemplate: {
          commandAllowlist: ['/help', '/status', '/report'],
          approvalByRisk: {
            L2: { requiredApprovals: 1, requiredAnyRoles: ['ops_admin'], distinctRoles: false }
          }
        },
        updatedAt: '2026-03-04T00:00:00.000Z',
        updatedBy: 'persisted-admin'
      }
    });
    const ctx = makeContext(makeAuth());
    ctx.repo = repo;
    const app = createServer(ctx);
    const agent = request.agent(app);
    await login(agent);

    const getRes = await agent.get('/api/admin/runtime/openclaw-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.runtime.openclawRuntimeVersion).toBe('2026.4.0');
    expect(getRes.body.providers.minimax.hasKey).toBe(true);
    expect(getRes.body.updatedBy).toBe('persisted-admin');

    const postRes = await agent.post('/api/admin/runtime/openclaw-config').send({
      runtime: { openclawRuntimeVersion: '2026.4.1' },
      providers: {
        deepseek: { enabled: false, apiBase: 'https://api.deepseek.com', model: 'deepseek-chat' },
        minimax: { enabled: true, apiBase: 'https://api.minimaxi.com/anthropic', model: 'MiniMax-M2.5' }
      },
      permissionTemplate: {
        commandAllowlist: ['/help'],
        approvalByRisk: { L1: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false } }
      }
    });
    expect(postRes.status).toBe(200);
    const persisted = await repo.getPlatformConfig('openclawConfig');
    expect(persisted.runtime.openclawRuntimeVersion).toBe('2026.4.1');
    expect(persisted.permissionTemplate.commandAllowlist).toEqual(['/help']);
  });
});
