const express = require('express');

function buildAssetRouter(assetService, requirePermission, metricsService) {
  const router = express.Router();

  router.post('/reports', requirePermission('control:asset:write'), async (req, res, next) => {
    try {
      const report = await assetService.reportAsset(req.body || {});
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports', requirePermission('control:asset:read'), async (req, res, next) => {
    try {
      let rows = await assetService.listReportsByType(req.query.type);
      if (req.query.status) {
        rows = rows.filter((x) => String(x.status || '') === String(req.query.status));
      }
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reviews/pending', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const reviewer = req.query.reviewer || req.principal.username || '';
      const rows = await assetService.listPendingReviews(reviewer);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reviews/dashboard', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.getReviewDashboard({
        slaHours: req.query.slaHours,
        reviewer: req.query.reviewer || req.principal.username || ''
      });
      if (metricsService && typeof metricsService.setReviewDashboard === 'function') {
        metricsService.setReviewDashboard(out);
      }
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reviews/escalate', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.escalateOverdueReviews({
        slaHours: req.body.slaHours,
        maxLevel: req.body.maxLevel,
        cooldownHours: req.body.cooldownHours,
        escalateTo: req.body.escalateTo,
        trigger: req.body.trigger || `manual:${req.principal.username || 'reviewer'}`
      });
      if (metricsService && typeof metricsService.recordEscalationEvents === 'function') {
        metricsService.recordEscalationEvents(out.escalated, 'manual');
      }
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reviews/batch', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const ids = Array.isArray(body.reportIds) ? body.reportIds : [];
      const decision = body.decision || 'approve';
      const reviewer = body.reviewer || req.principal.username || 'platform_admin';
      const opinion = body.opinion || '';
      const results = [];
      for (const id of ids) {
        const reportId = String(id || '').trim();
        if (!reportId) continue;
        try {
          const out = await assetService.reviewReport(reportId, reviewer, decision, opinion);
          results.push({ reportId, ok: true, data: out });
        } catch (error) {
          results.push({ reportId, ok: false, error: String(error.message || 'review failed') });
        }
      }
      const succeeded = results.filter((x) => x.ok).length;
      const failed = results.length - succeeded;
      res.json({
        success: true,
        data: {
          total: results.length,
          succeeded,
          failed,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports/:reportId/reviews', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const rows = await assetService.listReviewHistory(req.params.reportId);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/reviews', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.reviewReport(
        req.params.reportId,
        req.body.reviewer || req.principal.username || 'platform_admin',
        req.body.decision || 'approve',
        req.body.opinion || ''
      );
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/approve', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.approveReport(
        req.params.reportId,
        req.body.reviewer || req.principal.username || 'platform_admin',
        req.body.opinion || ''
      );
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/reject', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.rejectReport(
        req.params.reportId,
        req.body.reviewer || req.principal.username || 'platform_admin',
        req.body.reason || req.body.opinion || ''
      );
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.get('/shared', requirePermission('control:asset:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await assetService.listSharedAssets(req.query.type) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bindings', requirePermission('control:asset:bind'), async (req, res, next) => {
    try {
      const out = await assetService.bindSharedAsset(
        req.body.tenantId,
        req.body.assetId,
        req.body.assetType,
        req.body.actor || req.principal.username || 'platform_admin'
      );
      res.status(201).json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bindings/batch', requirePermission('control:asset:bind'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const tenantId = body.tenantId;
      const assetType = body.assetType;
      const actor = body.actor || req.principal.username || 'platform_admin';
      const ids = Array.isArray(body.assetIds) ? body.assetIds : [];
      const results = [];
      for (const id of ids) {
        const assetId = String(id || '').trim();
        if (!assetId) continue;
        try {
          const out = await assetService.bindSharedAsset(tenantId, assetId, assetType, actor);
          results.push({ assetId, ok: true, data: out });
        } catch (error) {
          results.push({ assetId, ok: false, error: String(error.message || 'bind failed') });
        }
      }
      const succeeded = results.filter((x) => x.ok).length;
      const failed = results.length - succeeded;
      res.json({
        success: true,
        data: {
          total: results.length,
          succeeded,
          failed,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/bindings', requirePermission('control:asset:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await assetService.listAssetBindings(req.query.type) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildAssetRouter };
