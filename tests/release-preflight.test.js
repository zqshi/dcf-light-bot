const { buildDiff, evaluateChecks, buildPreflightReport } = require('../scripts/check-release-preflight');

describe('release preflight', () => {
  const devValues = {
    namespace: { name: 'dcf-system-dev' },
    ingress: { hosts: [{ host: 'dcf-dev.internal' }] },
    replicaCount: 1,
    hpa: { enabled: false, minReplicas: 1, maxReplicas: 1 },
    secrets: { create: true, name: '' },
    image: { repository: 'dcf-light-bot', tag: 'dev' },
    config: { METRICS_ENABLED: 'true', KUBERNETES_RECONCILE_ENABLED: 'true', AUDIT_RETENTION_TTL_DAYS: '7' },
  };

  const prodValues = {
    namespace: { name: 'dcf-system' },
    ingress: { hosts: [{ host: 'dcf.prod.company.internal' }] },
    replicaCount: 3,
    hpa: { enabled: true, minReplicas: 3, maxReplicas: 20 },
    secrets: { create: false, name: 'dcf-light-bot-secret' },
    image: { repository: 'dcf-light-bot', tag: 'stable-20260303' },
    config: { METRICS_ENABLED: 'true', KUBERNETES_RECONCILE_ENABLED: 'true', AUDIT_RETENTION_TTL_DAYS: '90' },
  };

  test('buildDiff returns changed key list', () => {
    const diff = buildDiff(devValues, prodValues, ['replicaCount', 'image.tag']);
    expect(diff).toHaveLength(2);
    expect(diff[0]).toMatchObject({ key: 'replicaCount', changed: true });
  });

  test('evaluateChecks passes for compliant values', () => {
    const checks = evaluateChecks(devValues, prodValues);
    expect(checks.every((c) => c.status === 'passed')).toBe(true);
  });

  test('buildPreflightReport fails when guardrails are broken', () => {
    const brokenProd = {
      ...prodValues,
      image: { tag: 'latest' },
      secrets: { create: true, name: '' },
      ingress: { hosts: [{ host: 'dcf.example.com' }] },
    };

    const report = buildPreflightReport({ devValues, prodValues: brokenProd });
    expect(report.ok).toBe(false);
    expect(report.summary.failedChecks).toBeGreaterThan(0);
  });
});
