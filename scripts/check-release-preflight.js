const path = require('path');
const { loadEnvValues, getByPath } = require('./helm-values-utils');
const { validateProdValues } = require('./check-prod-helm-config');

const WATCH_KEYS = [
  'namespace.name',
  'image.repository',
  'image.tag',
  'replicaCount',
  'hpa.enabled',
  'hpa.minReplicas',
  'hpa.maxReplicas',
  'secrets.create',
  'secrets.name',
  'ingress.hosts.0.host',
  'config.AUDIT_RETENTION_TTL_DAYS',
  'config.METRICS_ENABLED',
  'config.KUBERNETES_RECONCILE_ENABLED',
];

function buildDiff(devValues, prodValues, watchKeys = WATCH_KEYS) {
  return watchKeys
    .map((key) => {
      const dev = getByPath(devValues, key);
      const prod = getByPath(prodValues, key);
      return { key, dev, prod, changed: JSON.stringify(dev) !== JSON.stringify(prod) };
    })
    .filter((item) => item.changed);
}

function evaluateChecks(devValues, prodValues) {
  const checks = [];

  const prodErrors = validateProdValues(prodValues);
  checks.push({
    name: 'prod-guardrails',
    status: prodErrors.length ? 'failed' : 'passed',
    detail: prodErrors.length ? prodErrors.join('; ') : 'prod values passed guardrail policy',
  });

  const devNs = devValues?.namespace?.name;
  const prodNs = prodValues?.namespace?.name;
  checks.push({
    name: 'namespace-isolation',
    status: devNs && prodNs && devNs !== prodNs ? 'passed' : 'failed',
    detail: `dev=${devNs || 'n/a'} prod=${prodNs || 'n/a'}`,
  });

  const devHost = devValues?.ingress?.hosts?.[0]?.host;
  const prodHost = prodValues?.ingress?.hosts?.[0]?.host;
  checks.push({
    name: 'ingress-host-separation',
    status: devHost && prodHost && devHost !== prodHost ? 'passed' : 'failed',
    detail: `dev=${devHost || 'n/a'} prod=${prodHost || 'n/a'}`,
  });

  const devReplicas = Number(devValues?.replicaCount || 0);
  const prodReplicas = Number(prodValues?.replicaCount || 0);
  checks.push({
    name: 'prod-capacity-baseline',
    status: Number.isFinite(devReplicas) && Number.isFinite(prodReplicas) && prodReplicas >= devReplicas ? 'passed' : 'failed',
    detail: `dev=${devReplicas} prod=${prodReplicas}`,
  });

  const prodHpaMin = Number(prodValues?.hpa?.minReplicas || 0);
  const prodHpaMax = Number(prodValues?.hpa?.maxReplicas || 0);
  checks.push({
    name: 'prod-hpa-range',
    status: Number.isFinite(prodHpaMin) && Number.isFinite(prodHpaMax) && prodHpaMax >= prodHpaMin ? 'passed' : 'failed',
    detail: `min=${prodHpaMin} max=${prodHpaMax}`,
  });

  const metricsEnabled = String(prodValues?.config?.METRICS_ENABLED || '').toLowerCase() === 'true';
  checks.push({
    name: 'prod-metrics-enabled',
    status: metricsEnabled ? 'passed' : 'failed',
    detail: `METRICS_ENABLED=${prodValues?.config?.METRICS_ENABLED}`,
  });

  return checks;
}

function buildPreflightReport({ devValues, prodValues }) {
  const checks = evaluateChecks(devValues, prodValues);
  const diff = buildDiff(devValues, prodValues);
  const failedChecks = checks.filter((c) => c.status === 'failed');

  return {
    ok: failedChecks.length === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      totalChecks: checks.length,
      failedChecks: failedChecks.length,
      changedKeys: diff.length,
    },
    checks,
    diff,
  };
}

function run() {
  const root = path.resolve(__dirname, '..');
  const { devValues, prodValues } = loadEnvValues(root);
  const report = buildPreflightReport({ devValues, prodValues });

  const output = JSON.stringify(report, null, 2);
  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }
  console.log(output);
}

if (require.main === module) {
  run();
}

module.exports = {
  WATCH_KEYS,
  buildDiff,
  evaluateChecks,
  buildPreflightReport,
};
