const request = require('supertest');
const { createServer } = require('../src/app/createServer');
const { AuthService } = require('../src/contexts/identity-access/application/AuthService');

describe('admin auth and matrix webhook', () => {
  test('rejects control routes without admin bearer token', async () => {
    const ctx = {
      config: { kubernetesSimulationMode: true },
      authService: new AuthService({ controlPlaneAdminToken: 'token', matrixWebhookSecret: 'mx' }),
      instanceService: { list: async () => [] },
      skillService: { listReports: async () => [] },
      auditService: { list: async () => [] },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    };
    const app = createServer(ctx);
    const res = await request(app).get('/api/control/instances');
    expect(res.status).toBe(401);
  });

  test('accepts matrix command endpoint with webhook secret', async () => {
    const ctx = {
      config: { kubernetesSimulationMode: true },
      authService: new AuthService({ controlPlaneAdminToken: 'token', matrixWebhookSecret: 'mx' }),
      instanceService: { list: async () => [] },
      skillService: { listReports: async () => [] },
      auditService: { list: async () => [] },
      matrixBot: {
        processTextMessage: async () => ({ ignored: false, reply: 'ok' })
      }
    };
    const app = createServer(ctx);
    const res = await request(app)
      .post('/api/integrations/matrix/commands')
      .set('x-matrix-webhook-secret', 'mx')
      .send({ sender: '@u:matrix', roomId: '!r:matrix', text: '!create_agent foo' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toBe('ok');
  });
});
