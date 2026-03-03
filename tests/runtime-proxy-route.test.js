const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('runtime proxy route', () => {
  test('allows ops invoke permission', async () => {
    const auth = new AuthService({
      controlPlaneAdminToken: 'admintoken',
      controlPlaneJwtSecret: 'jwtsecret',
      controlPlaneJwtExpiresInSec: 3600,
      matrixWebhookSecret: 'mx',
      controlPlaneUsers: [
        { username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false }
      ]
    });

    const app = createServer({
      config: { kubernetesSimulationMode: true },
      authService: auth,
      instanceService: {
        list: async () => [],
        get: async () => ({ id: 'inst_1', state: 'running', runtime: { endpoint: 'x' } }),
        start: async () => ({}),
        stop: async () => ({}),
        createFromMatrix: async () => ({}),
        buildMatrixCard: () => ({})
      },
      runtimeProxyService: {
        invoke: async () => ({ mode: 'kubernetes', response: { ok: true } })
      },
      skillService: {
        report: async () => ({}),
        listReports: async () => [],
        approveReport: async () => ({}),
        rejectReport: async () => ({}),
        listSharedSkills: async () => [],
        bindSharedSkill: async () => ({}),
        listBindings: async () => []
      },
      auditService: { list: async () => [], log: async () => {} },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const res = await request(app)
      .post('/api/control/runtime/instances/inst_1/invoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'ping' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
