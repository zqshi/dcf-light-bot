const express = require('express');

function buildReleaseRouter(releasePreflightService, requirePermission) {
  const router = express.Router();

  router.get('/preflight', requirePermission('control:instance:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: releasePreflightService.generateReport() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/preflight/assert', requirePermission('control:instance:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: releasePreflightService.assertReady() });
    } catch (error) {
      if (error && error.report) {
        res.status(Number(error.statusCode || 422)).json({
          success: false,
          error: {
            message: error.message,
            code: error.code || 'RELEASE_PREFLIGHT_FAILED',
            report: error.report
          }
        });
        return;
      }
      next(error);
    }
  });

  return router;
}

module.exports = { buildReleaseRouter };
