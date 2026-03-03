const { PlatformMetricsService } = require('../src/contexts/audit-observability/application/PlatformMetricsService');

describe('PlatformMetricsService', () => {
  test('renders labeled instance state and failure reason metrics', async () => {
    const svc = new PlatformMetricsService();
    svc.setStatusSnapshot({
      instances: 3,
      recentAuditCount: 5,
      healthLevel: 'degraded',
      instanceStateCounts: { running: 2, failed: 1 },
      instanceFailureReasons: { timeout: 1 }
    });
    const text = await svc.renderMetrics();
    expect(text).toContain('dcf_instance_state_total{state="running"} 2');
    expect(text).toContain('dcf_instance_state_total{state="failed"} 1');
    expect(text).toContain('dcf_instance_failure_reason_total{reason="timeout"} 1');
  });
});
