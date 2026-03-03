const { loadConfig } = require('../config');
const { FileStore } = require('../infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../infrastructure/persistence/ControlPlaneRepository');
const { OpenClawProvisioner } = require('../infrastructure/k8s/OpenClawProvisioner');
const { AuditService } = require('../contexts/audit-observability/application/AuditService');
const { InstanceService } = require('../contexts/tenant-instance/application/InstanceService');
const { RuntimeProxyService } = require('../contexts/tenant-instance/application/RuntimeProxyService');
const { SkillService } = require('../contexts/shared-assets/application/SkillService');
const { MatrixBot } = require('../integrations/matrix/MatrixBot');
const { AuthService } = require('../contexts/identity-access/application/AuthService');
const { InstanceReconciler } = require('../contexts/tenant-instance/application/InstanceReconciler');
const { createServer } = require('./createServer');

function createLogger() {
  return {
    info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, meta),
    warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, meta),
    error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, meta)
  };
}

async function startApp() {
  const config = loadConfig();
  const logger = createLogger();

  const store = new FileStore(config.storeFile);
  await store.init();
  const repo = new ControlPlaneRepository(store);
  const auditService = new AuditService(repo);
  const provisioner = new OpenClawProvisioner(config);
  const instanceService = new InstanceService(repo, provisioner, auditService, config);
  const runtimeProxyService = new RuntimeProxyService(instanceService, config);
  const skillService = new SkillService(repo, auditService);
  const assetService = skillService;
  const matrixBot = new MatrixBot(config, logger, instanceService);
  const authService = new AuthService(config);
  const reconciler = new InstanceReconciler(repo, auditService, config.bootstrapProvisioningTimeoutMs);

  const app = createServer({
    config,
    instanceService,
    runtimeProxyService,
    skillService,
    assetService,
    auditService,
    matrixBot,
    authService
  });
  const server = app.listen(config.port, config.host, () => {
    logger.info('server started', { host: config.host, port: config.port });
  });

  await matrixBot.start();

  const bootstrapTimer = setInterval(() => {
    reconciler.tick().catch((error) => logger.error('bootstrap tick failed', { error: error.message }));
  }, config.bootstrapIntervalMs);

  return {
    config,
    logger,
    server,
    matrixBot,
    instanceService,
    skillService,
    assetService,
    auditService,
    authService,
    async shutdown() {
      clearInterval(bootstrapTimer);
      await matrixBot.stop();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

module.exports = { startApp };
