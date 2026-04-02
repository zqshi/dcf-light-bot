const express = require('express');

function buildStorageRouter(storageService, requirePermission) {
  const router = express.Router();

  router.get('/stats', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const stats = await storageService.getStats();
      res.json({ success: true, stats });
    } catch (error) { next(error); }
  });

  router.get('/departments', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const departments = await storageService.getDeptStorage();
      res.json({ success: true, departments });
    } catch (error) { next(error); }
  });

  router.get('/large-files', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const files = await storageService.getLargeFiles();
      res.json({ success: true, files });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildStorageRouter };
