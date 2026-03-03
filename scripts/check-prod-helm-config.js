const path = require('path');
const { loadEnvValues } = require('./helm-values-utils');

function validateProdValues(values) {
  const errors = [];

  const imageTag = values?.image?.tag;
  if (!imageTag || String(imageTag).trim() === '' || imageTag === 'latest') {
    errors.push('image.tag must be pinned and cannot be latest in prod');
  }

  const hpaEnabled = values?.hpa?.enabled !== false;
  if (!hpaEnabled) {
    errors.push('hpa.enabled must be true in prod');
  }

  const minReplicas = Number(values?.hpa?.minReplicas || 0);
  if (!Number.isFinite(minReplicas) || minReplicas < 2) {
    errors.push('hpa.minReplicas must be >= 2 in prod');
  }

  const secrets = values?.secrets || {};
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

  const host = values?.ingress?.hosts?.[0]?.host || '';
  if (String(host).includes('example.com')) {
    errors.push('ingress host must not use example.com in prod');
  }

  return errors;
}

function run() {
  const root = path.resolve(__dirname, '..');
  const { prodValues: mergedProd } = loadEnvValues(root);
  const errors = validateProdValues(mergedProd);

  if (errors.length > 0) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checks: 6 }));
}

if (require.main === module) {
  run();
}

module.exports = {
  validateProdValues,
};
