const express = require('express');

function buildRuntimeRouter(runtimeProxyService, requirePermission) {
  const router = express.Router();

  router.post('/instances/:instanceId/invoke', requirePermission('control:instance:invoke'), async (req, res, next) => {
    try {
      const out = await runtimeProxyService.invoke(req.params.instanceId, req.body || {});
      res.json({ success: true, data: out });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildRuntimeRouter };
