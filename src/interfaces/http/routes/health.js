const express = require('express');

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
  return {
    stateCounts,
    failureReasons,
    failedCount
  };
}

function pickHealthLevel(snapshot, thresholds = {}) {
  const overdue = Number(snapshot.overdueReviews || 0);
  const escalated = Number(snapshot.escalatedReviews || 0);
  const recentDegraded = Number(snapshot.recentDegradedEvents || 0);
  const failedInstances = Number(snapshot.failedInstances || 0);

  const unhealthyOverdue = Math.max(1, Number(thresholds.unhealthyOverdue || 20));
  const unhealthyDegradedEvents = Math.max(1, Number(thresholds.unhealthyDegradedEvents || 20));
  const unhealthyFailedInstances = Math.max(1, Number(thresholds.unhealthyFailedInstances || 5));

  const degradedOverdue = Math.max(1, Number(thresholds.degradedOverdue || 1));
  const degradedEscalated = Math.max(1, Number(thresholds.degradedEscalated || 1));
  const degradedEvents = Math.max(1, Number(thresholds.degradedEvents || 1));
  const degradedFailedInstances = Math.max(1, Number(thresholds.degradedFailedInstances || 1));

  if (overdue >= unhealthyOverdue || recentDegraded >= unhealthyDegradedEvents || failedInstances >= unhealthyFailedInstances) {
    return 'unhealthy';
  }
  if (overdue >= degradedOverdue || escalated >= degradedEscalated || recentDegraded >= degradedEvents || failedInstances >= degradedFailedInstances) {
    return 'degraded';
  }
  return 'healthy';
}

function buildHealthRouter(context) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    res.json({
      ok: true,
      ts: new Date().toISOString(),
      mode: context.config.kubernetesSimulationMode ? 'simulation' : 'kubernetes'
    });
  });

  router.get('/status', async (req, res) => {
    const audits = await context.auditService.list(100);
    const instances = await context.instanceService.list();
    const reports = await context.skillService.listReports();
    const dashboard = context.assetService && typeof context.assetService.getReviewDashboard === 'function'
      ? await context.assetService.getReviewDashboard({ reviewer: '' })
      : { pendingTotal: 0, overdueTotal: 0, escalatedTotal: 0 };
    const degradedEvents = audits.filter((x) => {
      const t = String(x.type || '');
      return t.includes('degraded') || t.includes('failed');
    });
    const instanceSummary = summarizeInstances(instances);
    const healthThresholds = {
      unhealthyOverdue: context.config.healthUnhealthyOverdueThreshold,
      unhealthyDegradedEvents: context.config.healthUnhealthyDegradedEventThreshold,
      unhealthyFailedInstances: context.config.healthUnhealthyFailedInstancesThreshold,
      degradedOverdue: context.config.healthDegradedOverdueThreshold,
      degradedEscalated: context.config.healthDegradedEscalatedThreshold,
      degradedEvents: context.config.healthDegradedEventThreshold,
      degradedFailedInstances: context.config.healthDegradedFailedInstancesThreshold
    };
    const healthLevel = pickHealthLevel({
      overdueReviews: dashboard.overdueTotal,
      escalatedReviews: dashboard.escalatedTotal,
      recentDegradedEvents: degradedEvents.length,
      failedInstances: instanceSummary.failedCount
    }, healthThresholds);
    const statusPayload = {
      ok: healthLevel !== 'unhealthy',
      healthLevel,
      instances: instances.length,
      instanceStateCounts: instanceSummary.stateCounts,
      instanceFailureReasons: instanceSummary.failureReasons,
      failedInstances: instanceSummary.failedCount,
      skillReports: reports.length,
      pendingReviews: Number(dashboard.pendingTotal || 0),
      overdueReviews: Number(dashboard.overdueTotal || 0),
      escalatedReviews: Number(dashboard.escalatedTotal || 0),
      recentAuditCount: audits.length,
      recentDegradedEvents: degradedEvents.length,
      thresholds: healthThresholds
    };
    if (context.metricsService && typeof context.metricsService.setReviewDashboard === 'function') {
      context.metricsService.setReviewDashboard(dashboard);
      context.metricsService.setStatusSnapshot(statusPayload);
    }
    res.json(statusPayload);
  });

  router.get('/metrics', async (req, res) => {
    if (!context.metricsService || typeof context.metricsService.renderMetrics !== 'function') {
      res.status(503).send('# metrics disabled');
      return;
    }
    const text = await context.metricsService.renderMetrics();
    res.set('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(text);
  });

  return router;
}

module.exports = { buildHealthRouter };
