const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('audit export route', () => {
  test('auditor can export audit as ndjson', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: [{ username: 'auditor', role: 'auditor', password: 'plain:audit123', disabled: false }]
    });

    const app = createServer({
      config: { kubernetesSimulationMode: true },
      authService: auth,
      instanceService: {
        list: async () => [],
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
      auditService: {
        list: async () => [{ id: 'a1', type: 'instance.started' }],
        export: async () => ({
          contentType: 'application/x-ndjson; charset=utf-8',
          body: '{"id":"a1","type":"instance.started"}'
        }),
        log: async () => ({})
      },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const login = await request(app).post('/api/control/auth/login').send({ username: 'auditor', password: 'audit123' });
    const token = login.body.data.token;
    const res = await request(app)
      .get('/api/control/audits/export?format=ndjson')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.text).toContain('instance.started');
  });
});
