const path = require('path');
const { loadEnvValues } = require('./helm-values-utils');
const {
  WATCH_KEYS,
  buildDiff,
  evaluateChecks,
  buildPreflightReport
} = require('../src/contexts/release-management/application/releasePreflightPolicy');

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
