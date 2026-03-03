const request = require('supertest');
const { createServer } = require('../src/app/createServer');

describe('health and metrics route', () => {
  test('status returns unhealthy with configured failed-instance threshold and exposes metrics', async () => {
    const metricsService = {
      setReviewDashboard: async () => {},
      setStatusSnapshot: async () => {},
      renderMetrics: async () => (
        '# HELP dcf_review_pending_total\n# TYPE dcf_review_pending_total gauge\ndcf_review_pending_total 3\n'
        + '# HELP dcf_instance_state_total\n# TYPE dcf_instance_state_total gauge\ndcf_instance_state_total{state="failed"} 1\n'
      )
    };
    const app = createServer({
      config: {
        kubernetesSimulationMode: true,
        healthUnhealthyFailedInstancesThreshold: 1,
        healthUnhealthyOverdueThreshold: 20,
        healthUnhealthyDegradedEventThreshold: 20,
        healthDegradedOverdueThreshold: 1,
        healthDegradedEscalatedThreshold: 1,
        healthDegradedEventThreshold: 1,
        healthDegradedFailedInstancesThreshold: 1
      },
      instanceService: { list: async () => [{ id: 'i1', state: 'running' }, { id: 'i2', state: 'failed', lastError: 'timeout' }] },
      skillService: { listReports: async () => [{ id: 'r1' }] },
      assetService: { getReviewDashboard: async () => ({ pendingTotal: 3, overdueTotal: 0, escalatedTotal: 0 }) },
      auditService: {
        list: async () => [{ type: 'runtime.proxy.degraded' }]
      },
      metricsService,
      authService: { verifyMatrixWebhookSecret: () => true },
      matrixBot: { processTextMessage: async () => ({ ignored: true }) }
    });

    const status = await request(app).get('/status');
    expect(status.status).toBe(200);
    expect(status.body.healthLevel).toBe('unhealthy');
    expect(status.body.failedInstances).toBe(1);
    expect(status.body.instanceFailureReasons.timeout).toBe(1);

    const metrics = await request(app).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.headers['content-type']).toContain('text/plain');
    expect(metrics.text).toContain('dcf_review_pending_total');
    expect(metrics.text).toContain('dcf_instance_state_total');
  });
});
