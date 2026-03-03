const { getByPath } = require('../../../shared/helmValues');

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
  'config.KUBERNETES_RECONCILE_ENABLED'
];

function validateProdValues(values) {
  const errors = [];

  const imageTag = values && values.image && values.image.tag;
  if (!imageTag || String(imageTag).trim() === '' || imageTag === 'latest') {
    errors.push('image.tag must be pinned and cannot be latest in prod');
  }

  const hpaEnabled = values && values.hpa && values.hpa.enabled !== false;
  if (!hpaEnabled) {
    errors.push('hpa.enabled must be true in prod');
  }

  const minReplicas = Number(values && values.hpa && values.hpa.minReplicas || 0);
  if (!Number.isFinite(minReplicas) || minReplicas < 2) {
    errors.push('hpa.minReplicas must be >= 2 in prod');
  }

  const secrets = values && values.secrets || {};
  if (secrets.create !== false) {
    errors.push('secrets.create must be false in prod (use external secret)');
  }

  if (!secrets.name || String(secrets.name).trim() === '') {
    errors.push('secrets.name must be set in prod when secrets.create=false');
  }

  const secretData = secrets.data || {};
  const hasPlaceholder = Object.values(secretData).some((v) => String(v || '').includes('replace-me'));
  if (hasPlaceholder) {
    errors.push('secrets.data contains placeholder values (replace-me) in prod');
  }

  const host = values && values.ingress && values.ingress.hosts && values.ingress.hosts[0] && values.ingress.hosts[0].host || '';
  if (String(host).includes('example.com')) {
    errors.push('ingress host must not use example.com in prod');
  }

  return errors;
}

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
    detail: prodErrors.length ? prodErrors.join('; ') : 'prod values passed guardrail policy'
  });

  const devNs = devValues && devValues.namespace && devValues.namespace.name;
  const prodNs = prodValues && prodValues.namespace && prodValues.namespace.name;
  checks.push({
    name: 'namespace-isolation',
    status: devNs && prodNs && devNs !== prodNs ? 'passed' : 'failed',
    detail: `dev=${devNs || 'n/a'} prod=${prodNs || 'n/a'}`
  });

  const devHost = devValues && devValues.ingress && devValues.ingress.hosts && devValues.ingress.hosts[0] && devValues.ingress.hosts[0].host;
  const prodHost = prodValues && prodValues.ingress && prodValues.ingress.hosts && prodValues.ingress.hosts[0] && prodValues.ingress.hosts[0].host;
  checks.push({
    name: 'ingress-host-separation',
    status: devHost && prodHost && devHost !== prodHost ? 'passed' : 'failed',
    detail: `dev=${devHost || 'n/a'} prod=${prodHost || 'n/a'}`
  });

  const devReplicas = Number(devValues && devValues.replicaCount || 0);
  const prodReplicas = Number(prodValues && prodValues.replicaCount || 0);
  checks.push({
    name: 'prod-capacity-baseline',
    status: Number.isFinite(devReplicas) && Number.isFinite(prodReplicas) && prodReplicas >= devReplicas ? 'passed' : 'failed',
    detail: `dev=${devReplicas} prod=${prodReplicas}`
  });

  const prodHpaMin = Number(prodValues && prodValues.hpa && prodValues.hpa.minReplicas || 0);
  const prodHpaMax = Number(prodValues && prodValues.hpa && prodValues.hpa.maxReplicas || 0);
  checks.push({
    name: 'prod-hpa-range',
    status: Number.isFinite(prodHpaMin) && Number.isFinite(prodHpaMax) && prodHpaMax >= prodHpaMin ? 'passed' : 'failed',
    detail: `min=${prodHpaMin} max=${prodHpaMax}`
  });

  const metricsEnabled = String(prodValues && prodValues.config && prodValues.config.METRICS_ENABLED || '').toLowerCase() === 'true';
  checks.push({
    name: 'prod-metrics-enabled',
    status: metricsEnabled ? 'passed' : 'failed',
    detail: `METRICS_ENABLED=${prodValues && prodValues.config && prodValues.config.METRICS_ENABLED}`
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
      changedKeys: diff.length
    },
    checks,
    diff
  };
}

module.exports = {
  WATCH_KEYS,
  validateProdValues,
  buildDiff,
  evaluateChecks,
  buildPreflightReport
};
