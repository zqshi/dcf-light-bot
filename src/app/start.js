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
const { MatrixRelay } = require('../integrations/matrix/MatrixRelay');
const { AuthService } = require('../contexts/identity-access/application/AuthService');
const { InstanceReconciler } = require('../contexts/tenant-instance/application/InstanceReconciler');
const { ReleasePreflightService } = require('../contexts/release-management/application/ReleasePreflightService');
const { createServer } = require('./createServer');

function createLogger() {
  return {
    info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, meta),
    warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, meta),
    error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, meta)
  };
}

function normalizeFailureReason(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'none';
  if (raw.includes('timeout')) return 'timeout';
  if (raw.includes('auth')) return 'auth';
  if (raw.includes('network')) return 'network';
  if (raw.includes('dns')) return 'dns';
  if (raw.includes('rate')) return 'rate_limit';
  if (raw.includes('k8s')) return 'k8s';
  if (raw.includes('provision')) return 'provision';
  return 'other';
}

function summarizeInstances(instances) {
  const rows = Array.isArray(instances) ? instances : [];
  const stateCounts = {};
  const failureReasons = {};
  let failedCount = 0;
  for (const row of rows) {
    const state = String(row && row.state || 'unknown');
    stateCounts[state] = (stateCounts[state] || 0) + 1;
    if (state === 'failed') {
      failedCount += 1;
      const reason = normalizeFailureReason(row && row.lastError);
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    }
  }
  return { stateCounts, failureReasons, failedCount };
}

function evaluateHealthLevel(input, thresholds) {
  const overdue = Number(input.overdueReviews || 0);
  const escalated = Number(input.escalatedReviews || 0);
  const degradedEvents = Number(input.recentDegradedEvents || 0);
  const failedInstances = Number(input.failedInstances || 0);
  if (
    overdue >= Number(thresholds.unhealthyOverdue || 20)
    || degradedEvents >= Number(thresholds.unhealthyDegradedEvents || 20)
    || failedInstances >= Number(thresholds.unhealthyFailedInstances || 5)
  ) return 'unhealthy';
  if (
    overdue >= Number(thresholds.degradedOverdue || 1)
    || escalated >= Number(thresholds.degradedEscalated || 1)
    || degradedEvents >= Number(thresholds.degradedEvents || 1)
    || failedInstances >= Number(thresholds.degradedFailedInstances || 1)
  ) return 'degraded';
  return 'healthy';
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
  const matrixRelay = new MatrixRelay(config, logger, matrixBot);
  const authService = new AuthService(config);
  const releasePreflightService = new ReleasePreflightService({ rootDir: process.cwd() });
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
    authService,
    releasePreflightService
  });
  const server = app.listen(config.port, config.host, () => {
    logger.info('server started', { host: config.host, port: config.port });
  });

  await matrixBot.start();
  await matrixRelay.start();

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
        const summary = summarizeInstances(instances);
        const thresholds = {
          unhealthyOverdue: config.healthUnhealthyOverdueThreshold,
          unhealthyDegradedEvents: config.healthUnhealthyDegradedEventThreshold,
          unhealthyFailedInstances: config.healthUnhealthyFailedInstancesThreshold,
          degradedOverdue: config.healthDegradedOverdueThreshold,
          degradedEscalated: config.healthDegradedEscalatedThreshold,
          degradedEvents: config.healthDegradedEventThreshold,
          degradedFailedInstances: config.healthDegradedFailedInstancesThreshold
        };
        const healthLevel = evaluateHealthLevel({
          overdueReviews: dashboard.overdueTotal,
          escalatedReviews: dashboard.escalatedTotal,
          recentDegradedEvents: degradedEvents.length,
          failedInstances: summary.failedCount
        }, thresholds);
        metricsService.setReviewDashboard(dashboard);
        metricsService.setStatusSnapshot({
          instances: instances.length,
          recentAuditCount: audits.length,
          healthLevel,
          instanceStateCounts: summary.stateCounts,
          instanceFailureReasons: summary.failureReasons
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
    matrixRelay,
    instanceService,
    skillService,
    assetService,
    auditService,
    metricsService,
    authService,
    releasePreflightService,
    async shutdown() {
      clearInterval(bootstrapTimer);
      if (auditRetentionTimer) clearInterval(auditRetentionTimer);
      if (assetReviewSlaTimer) clearInterval(assetReviewSlaTimer);
      if (metricsRefreshTimer) clearInterval(metricsRefreshTimer);
      await matrixRelay.stop();
      await matrixBot.stop();
      await new Promise((resolve) => server.close(resolve));
      if (store && typeof store.close === 'function') {
        await store.close();
      }
    }
  };
}

module.exports = { startApp };
