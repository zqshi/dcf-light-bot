const express = require('express');

function pickHealthLevel(snapshot) {
  const overdue = Number(snapshot.overdueReviews || 0);
  const escalated = Number(snapshot.escalatedReviews || 0);
  const recentDegraded = Number(snapshot.recentDegradedEvents || 0);
  if (overdue >= 20 || recentDegraded >= 20) return 'unhealthy';
  if (overdue > 0 || escalated > 0 || recentDegraded > 0) return 'degraded';
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
    const healthLevel = pickHealthLevel({
      overdueReviews: dashboard.overdueTotal,
      escalatedReviews: dashboard.escalatedTotal,
      recentDegradedEvents: degradedEvents.length
    });
    const statusPayload = {
      ok: healthLevel !== 'unhealthy',
      healthLevel,
      instances: instances.length,
      skillReports: reports.length,
      pendingReviews: Number(dashboard.pendingTotal || 0),
      overdueReviews: Number(dashboard.overdueTotal || 0),
      escalatedReviews: Number(dashboard.escalatedTotal || 0),
      recentAuditCount: audits.length,
      recentDegradedEvents: degradedEvents.length
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
