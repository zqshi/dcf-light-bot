const { loadEnvValues } = require('../../../shared/helmValues');
const { buildPreflightReport } = require('./releasePreflightPolicy');

class ReleasePreflightService {
  constructor(options = {}) {
    this.rootDir = String(options.rootDir || process.cwd());
    this.chartRelativeDir = String(options.chartRelativeDir || 'deploy/helm/dcf-light-bot');
  }

  generateReport() {
    const { devValues, prodValues, files } = loadEnvValues(this.rootDir, this.chartRelativeDir);
    return {
      ...buildPreflightReport({ devValues, prodValues }),
      sourceFiles: files
    };
  }

  assertReady() {
    const report = this.generateReport();
    if (!report.ok) {
      const errors = report.checks.filter((x) => x.status === 'failed').map((x) => x.detail);
      const err = new Error(`release preflight failed: ${errors.join('; ')}`);
      err.statusCode = 422;
      err.code = 'RELEASE_PREFLIGHT_FAILED';
      err.report = report;
      throw err;
    }
    return report;
  }
}

module.exports = { ReleasePreflightService };
