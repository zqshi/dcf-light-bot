const path = require('path');
const { loadEnvValues } = require('./helm-values-utils');
const { validateProdValues } = require('../src/contexts/release-management/application/releasePreflightPolicy');

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
