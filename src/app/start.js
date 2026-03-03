const { loadConfig } = require('../config');
const { createStore } = require('../infrastructure/persistence/createStore');
const { ControlPlaneRepository } = require('../infrastructure/persistence/ControlPlaneRepository');
const { OpenClawProvisioner } = require('../infrastructure/k8s/OpenClawProvisioner');
const { AuditService } = require('../contexts/audit-observability/application/AuditService');
const { PlatformMetricsService } = require('../contexts/audit-observability/application/PlatformMetricsService');
const { InstanceService } = require('../contexts/tenant-instance/application/InstanceService');
const { RuntimeProxyService } = require('../contexts/tenant-instance/application/RuntimeProxyService');
const { SkillService } = require('../contexts/shared-assets/application/SkillService');
const { TenantAssetResolver } = require('../contexts/shared-assets/application/TenantAssetResolver');
const { AssetCompatibilityService } = require('../contexts/shared-assets/application/AssetCompatibilityService');
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

  const store = createStore(config);
  await store.init();
  const repo = new ControlPlaneRepository(store);
  const auditService = new AuditService(repo, {
    retentionTtlDays: config.auditRetentionTtlDays,
    retentionMaxRows: config.auditRetentionMaxRows,
    archiveEnabled: config.auditArchiveEnabled,
    archiveMaxRows: config.auditArchiveMaxRows
  });
  const metricsService = new PlatformMetricsService();
  const tenantAssetResolver = new TenantAssetResolver(repo);
  const assetCompatibilityService = new AssetCompatibilityService();
  const provisioner = new OpenClawProvisioner(config, {
    resolveTenantAssets: (tenantId) => tenantAssetResolver.resolveByTenant(tenantId),
    validateMountedAssets: (runtimeVersion, mountedAssets) =>
      assetCompatibilityService.validate(runtimeVersion, mountedAssets)
  });
  const instanceService = new InstanceService(repo, provisioner, auditService, config);
  const runtimeProxyService = new RuntimeProxyService(instanceService, config, { auditService });
  const skillService = new SkillService(repo, auditService);
  const assetService = skillService;
  const matrixBot = new MatrixBot(config, logger, instanceService);
  const authService = new AuthService(config);
  const reconciler = new InstanceReconciler(repo, auditService, provisioner, {
    timeoutMs: config.bootstrapProvisioningTimeoutMs,
    reconcileRunning: config.kubernetesReconcileEnabled,
    rollbackOnTimeout: config.kubernetesRollbackOnProvisionFailure
  });

  const app = createServer({
    config,
    instanceService,
    runtimeProxyService,
    skillService,
    assetService,
    auditService,
    metricsService,
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

  const auditRetentionTimer = config.auditRetentionEnabled
    ? setInterval(() => {
      auditService.pruneRetention('scheduler').catch((error) => {
        logger.error('audit retention tick failed', { error: error.message });
      });
    }, Math.max(10_000, Number(config.auditRetentionIntervalMs || 600000)))
    : null;

  const assetReviewSlaTimer = config.assetReviewSlaEnabled
    ? setInterval(() => {
      skillService.escalateOverdueReviews({
        slaHours: config.assetReviewSlaHours,
        maxLevel: config.assetReviewEscalationMaxLevel,
        cooldownHours: config.assetReviewEscalationCooldownHours,
        escalateTo: config.assetReviewEscalationRole,
        trigger: 'scheduler'
      }).then((summary) => {
        if (summary && Number(summary.escalated || 0) > 0) {
          metricsService.recordEscalationEvents(summary.escalated, 'scheduler');
          logger.warn('asset review sla escalated overdue reviews', summary);
        }
      }).catch((error) => {
        logger.error('asset review sla tick failed', { error: error.message });
      });
    }, Math.max(10_000, Number(config.assetReviewSlaIntervalMs || 300000)))
    : null;

  const metricsRefreshTimer = config.metricsEnabled
    ? setInterval(() => {
      Promise.all([
        assetService.getReviewDashboard({ reviewer: '' }),
        instanceService.list(),
        auditService.list(100)
      ]).then(([dashboard, instances, audits]) => {
        const degradedEvents = audits.filter((x) => {
          const t = String(x.type || '');
          return t.includes('degraded') || t.includes('failed');
        });
        const overdue = Number(dashboard.overdueTotal || 0);
        const escalated = Number(dashboard.escalatedTotal || 0);
        const healthLevel = (overdue >= 20 || degradedEvents.length >= 20)
          ? 'unhealthy'
          : ((overdue > 0 || escalated > 0 || degradedEvents.length > 0) ? 'degraded' : 'healthy');
        metricsService.setReviewDashboard(dashboard);
        metricsService.setStatusSnapshot({
          instances: instances.length,
          recentAuditCount: audits.length,
          healthLevel
        });
      }).catch((error) => {
        logger.error('metrics refresh tick failed', { error: error.message });
      });
    }, Math.max(10_000, Number(config.metricsRefreshIntervalMs || 60000)))
    : null;

  return {
    config,
    logger,
    server,
    matrixBot,
    instanceService,
    skillService,
    assetService,
    auditService,
    metricsService,
    authService,
    async shutdown() {
      clearInterval(bootstrapTimer);
      if (auditRetentionTimer) clearInterval(auditRetentionTimer);
      if (assetReviewSlaTimer) clearInterval(assetReviewSlaTimer);
      if (metricsRefreshTimer) clearInterval(metricsRefreshTimer);
      await matrixBot.stop();
      await new Promise((resolve) => server.close(resolve));
      if (store && typeof store.close === 'function') {
        await store.close();
      }
    }
  };
}

module.exports = { startApp };
