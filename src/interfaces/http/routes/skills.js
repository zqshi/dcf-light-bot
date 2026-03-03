const express = require('express');

function buildSkillRouter(skillService, requirePermission) {
  const router = express.Router();

  router.post('/reports', requirePermission('control:skill:write'), async (req, res, next) => {
    try {
      const report = await skillService.reportAsset({
        ...(req.body || {}),
        assetType: req.body && req.body.assetType ? req.body.assetType : 'skill'
      });
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports', requirePermission('control:skill:read'), async (req, res, next) => {
    try {
      const rows = await skillService.listReportsByType(req.query.type || 'skill');
      if (req.query.status) {
        res.json({ success: true, data: rows.filter((x) => String(x.status || '') === String(req.query.status)) });
        return;
      }
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/approve', requirePermission('control:skill:review'), async (req, res, next) => {
    try {
      const out = await skillService.approveReport(
        req.params.reportId,
        req.body.reviewer || req.principal.username || 'platform_admin',
        req.body.opinion || ''
      );
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/:reportId/reject', requirePermission('control:skill:review'), async (req, res, next) => {
    try {
      const out = await skillService.rejectReport(
        req.params.reportId,
        req.body.reviewer || req.principal.username || 'platform_admin',
        req.body.reason || req.body.opinion || ''
      );
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.get('/shared', requirePermission('control:skill:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await skillService.listSharedAssets(req.query.type || 'skill') });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bindings', requirePermission('control:skill:bind'), async (req, res, next) => {
    try {
      const out = await skillService.bindSharedSkill(
        req.body.tenantId,
        req.body.skillId || req.body.assetId,
        req.body.actor || req.principal.username || 'platform_admin'
      );
      res.status(201).json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  router.get('/bindings', requirePermission('control:skill:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await skillService.listAssetBindings(req.query.type || 'skill') });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildSkillRouter };
