const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

function ctxFromAuth(authService) {
  return {
    config: { kubernetesSimulationMode: true },
    authService,
    instanceService: {
      list: async () => [{ id: 'inst1' }],
      get: async () => ({ id: 'inst1' }),
      start: async () => ({ id: 'inst1', state: 'running' }),
      stop: async () => ({ id: 'inst1', state: 'stopped' }),
      createFromMatrix: async () => ({ id: 'inst1', state: 'running' }),
      buildMatrixCard: () => ({ instanceId: 'inst1' })
    },
    skillService: {
      report: async () => ({ id: 'r1' }),
      listReports: async () => [],
      approveReport: async () => ({}),
      rejectReport: async () => ({}),
      listSharedSkills: async () => [],
      bindSharedSkill: async () => ({}),
      listBindings: async () => []
    },
    auditService: { list: async () => [] },
    matrixBot: { processTextMessage: async () => ({ ignored: true }) }
  };
}

describe('RBAC auth', () => {
  const auth = new AuthService({
    controlPlaneAdminToken: 'admintoken',
    controlPlaneJwtSecret: 'jwtsecret',
    controlPlaneJwtExpiresInSec: 3600,
    matrixWebhookSecret: 'mx',
    controlPlaneUsers: [
      { username: 'admin', role: 'platform_admin', password: 'plain:admin123', disabled: false },
      { username: 'ops', role: 'ops_admin', password: 'plain:ops123', disabled: false },
      { username: 'auditor', role: 'auditor', password: 'plain:audit123', disabled: false }
    ]
  });

  test('login issues jwt token', async () => {
    const app = createServer(ctxFromAuth(auth));
    const res = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  test('ops can read instances but cannot read audits', async () => {
    const app = createServer(ctxFromAuth(auth));
    const login = await request(app).post('/api/control/auth/login').send({ username: 'ops', password: 'ops123' });
    const token = login.body.data.token;

    const okRes = await request(app)
      .get('/api/control/instances')
      .set('Authorization', `Bearer ${token}`);
    expect(okRes.status).toBe(200);

    const denyRes = await request(app)
      .get('/api/control/audits')
      .set('Authorization', `Bearer ${token}`);
    expect(denyRes.status).toBe(403);
  });

  test('legacy admin token still works', async () => {
    const app = createServer(ctxFromAuth(auth));
    const res = await request(app)
      .get('/api/control/audits')
      .set('Authorization', 'Bearer admintoken');
    expect(res.status).toBe(200);
  });
});
