const express = require('express');

const EDITABLE_RESOURCE_KEYS = ['tenantDefaultCpu', 'tenantDefaultMemory', 'tenantDefaultStorage'];
const EDITABLE_AUDIT_KEYS = [
  'auditRetentionEnabled', 'auditRetentionTtlDays', 'auditRetentionMaxRows',
  'auditArchiveEnabled', 'auditArchiveMaxRows'
];
const EDITABLE_SLA_KEYS = [
  'assetReviewSlaEnabled', 'assetReviewSlaHours',
  'assetReviewEscalationMaxLevel', 'assetReviewEscalationCooldownHours'
];
const EDITABLE_PLATFORM_KEYS = ['platformBaseUrl', 'metricsEnabled'];

const ALL_EDITABLE_KEYS = new Set([
  ...EDITABLE_RESOURCE_KEYS, ...EDITABLE_AUDIT_KEYS,
  ...EDITABLE_SLA_KEYS, ...EDITABLE_PLATFORM_KEYS
]);

function coerce(key, value) {
  if (key.endsWith('Enabled')) return value === true || value === 'true';
  if (['auditRetentionTtlDays', 'auditRetentionMaxRows', 'auditArchiveMaxRows',
    'assetReviewSlaHours', 'assetReviewEscalationMaxLevel',
    'assetReviewEscalationCooldownHours'].includes(key)) {
    return Math.max(0, Number(value) || 0);
  }
  return String(value || '').trim();
}

function resolveValue(configVal, overrides, key) {
  if (overrides && overrides[key] !== undefined) return { value: overrides[key], source: 'override' };
  return { value: configVal, source: 'env' };
}

function buildConfigResponse(config, overrides) {
  const providers = Array.isArray(config.providers) ? config.providers : [];
  const ov = overrides || {};

  const rv = (key, fallback) => resolveValue(fallback, ov, key);

  return {
    providers: providers.map((p) => ({ name: p.name, configured: Boolean(p.key) })),
    resourceDefaults: {
      cpu: rv('tenantDefaultCpu', config.tenantDefaultCpu),
      memory: rv('tenantDefaultMemory', config.tenantDefaultMemory),
      storage: rv('tenantDefaultStorage', config.tenantDefaultStorage)
    },
    runtime: {
      openclawImage: config.openclawImage,
      openclawRuntimeVersion: config.openclawRuntimeVersion,
      kubernetesSimulationMode: config.kubernetesSimulationMode,
      kubernetesNamespacePrefix: config.kubernetesNamespacePrefix
    },
    audit: {
      retentionEnabled: rv('auditRetentionEnabled', config.auditRetentionEnabled),
      retentionTtlDays: rv('auditRetentionTtlDays', config.auditRetentionTtlDays),
      retentionMaxRows: rv('auditRetentionMaxRows', config.auditRetentionMaxRows),
      archiveEnabled: rv('auditArchiveEnabled', config.auditArchiveEnabled),
      archiveMaxRows: rv('auditArchiveMaxRows', config.auditArchiveMaxRows)
    },
    assetReview: {
      slaEnabled: rv('assetReviewSlaEnabled', config.assetReviewSlaEnabled),
      slaHours: rv('assetReviewSlaHours', config.assetReviewSlaHours),
      escalationMaxLevel: rv('assetReviewEscalationMaxLevel', config.assetReviewEscalationMaxLevel),
      escalationCooldownHours: rv('assetReviewEscalationCooldownHours', config.assetReviewEscalationCooldownHours)
    },
    platform: {
      baseUrl: rv('platformBaseUrl', config.platformBaseUrl),
      defaultTenantId: config.defaultTenantId,
      persistenceBackend: config.persistenceBackend,
      ssoEnabled: config.ssoEnabled,
      ssoProvider: config.ssoProvider,
      metricsEnabled: rv('metricsEnabled', config.metricsEnabled)
    }
  };
}

function buildPlatformConfigRouter(config, repo, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('platform:config:read'), async (req, res, next) => {
    try {
      const overrides = repo ? await repo.getPlatformConfig('overrides') : null;
      res.json({ success: true, data: buildConfigResponse(config, overrides) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requirePermission('platform:config:write'), async (req, res, next) => {
    try {
      if (!repo) return res.status(501).json({ success: false, error: { message: 'config persistence not available' } });
      const body = req.body || {};
      const existing = (await repo.getPlatformConfig('overrides')) || {};
      const updated = { ...existing };
      for (const [key, value] of Object.entries(body)) {
        if (ALL_EDITABLE_KEYS.has(key)) {
          updated[key] = coerce(key, value);
        }
      }
      await repo.setPlatformConfig('overrides', updated);
      res.json({ success: true, data: buildConfigResponse(config, updated) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildPlatformConfigRouter };
