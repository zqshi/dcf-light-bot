const request = require('supertest');
const { createServer } = require('../src/app/createServer');

describe('health and metrics route', () => {
  test('status returns degraded health level and metrics endpoint exposes prometheus text', async () => {
    const metricsService = {
      setReviewDashboard: async () => {},
      setStatusSnapshot: async () => {},
      renderMetrics: async () => '# HELP dcf_review_pending_total\n# TYPE dcf_review_pending_total gauge\ndcf_review_pending_total 3\n'
    };
    const app = createServer({
      config: { kubernetesSimulationMode: true },
      instanceService: { list: async () => [{ id: 'i1' }, { id: 'i2' }] },
      skillService: { listReports: async () => [{ id: 'r1' }] },
      assetService: { getReviewDashboard: async () => ({ pendingTotal: 3, overdueTotal: 1, escalatedTotal: 1 }) },
      auditService: {
        list: async () => [{ type: 'runtime.proxy.degraded' }]
      },
      metricsService,
      authService: { verifyMatrixWebhookSecret: () => true },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const status = await request(app).get('/status');
    expect(status.status).toBe(200);
    expect(status.body.healthLevel).toBe('degraded');
    expect(status.body.overdueReviews).toBe(1);

    const metrics = await request(app).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.headers['content-type']).toContain('text/plain');
    expect(metrics.text).toContain('dcf_review_pending_total');
  });
});
