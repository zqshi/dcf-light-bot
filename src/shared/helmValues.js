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

function getByPath(obj, keyPath) {
  return String(keyPath || '').split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }
    return acc[key];
  }, obj);
}

function loadEnvValues(rootDir, chartRelativeDir = 'deploy/helm/dcf-light-bot') {
  const chartDir = path.join(rootDir, chartRelativeDir);
  const baseFile = path.join(chartDir, 'values.yaml');
  const devFile = path.join(chartDir, 'values-dev.yaml');
  const prodFile = path.join(chartDir, 'values-prod.yaml');

  const baseValues = readYaml(baseFile);
  const devOverlay = readYaml(devFile);
  const prodOverlay = readYaml(prodFile);

  return {
    baseValues,
    devValues: mergeDeep(baseValues, devOverlay),
    prodValues: mergeDeep(baseValues, prodOverlay),
    files: { baseFile, devFile, prodFile }
  };
}

module.exports = {
  readYaml,
  mergeDeep,
  getByPath,
  loadEnvValues
};
