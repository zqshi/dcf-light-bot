const express = require('express');

function buildAssetRouter(assetService, requirePermission) {
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
      res.json({ success: true, data: await assetService.listReportsByType(req.query.type) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/approve', requirePermission('control:asset:review'), async (req, res, next) => {
    try {
      const out = await assetService.approveReport(req.params.reportId, req.body.reviewer || req.principal.username || 'platform_admin');
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
        req.body.reason || ''
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
