const express = require('express');

function buildAuditRouter(auditService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
      const rows = await auditService.list(limit);
      res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildAuditRouter };
