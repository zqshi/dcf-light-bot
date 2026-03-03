const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

function readYaml(filePath) {
  const content = fs.readFileSync(path.resolve(filePath), 'utf8');
  return yaml.parse(content) || {};
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, overlay) {
  if (!isObject(base) || !isObject(overlay)) {
    return overlay === undefined ? base : overlay;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (isObject(value) && isObject(base[key])) {
      out[key] = mergeDeep(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

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
  const baseFile = path.join(root, 'deploy/helm/dcf-light-bot/values.yaml');
  const prodFile = path.join(root, 'deploy/helm/dcf-light-bot/values-prod.yaml');

  const baseValues = readYaml(baseFile);
  const prodOverlay = readYaml(prodFile);
  const mergedProd = mergeDeep(baseValues, prodOverlay);
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
  mergeDeep,
  validateProdValues,
};
