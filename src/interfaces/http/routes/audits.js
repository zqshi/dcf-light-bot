const express = require('express');

function buildAuditRouter(auditService, requirePermission) {
  const router = express.Router();

  function collectFilters(query) {
    const out = {};
    if (query.type) out.type = query.type;
    if (query.actor) out.actor = query.actor;
    if (query.tenantId) out.tenantId = query.tenantId;
    if (query.from) out.from = query.from;
    if (query.to) out.to = query.to;
    return out;
  }

  router.get('/', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
      const rows = await auditService.list(limit, collectFilters(req.query || {}));
      res.json({ success: true, data: rows, total: rows.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));
      const format = String(req.query.format || 'json').trim().toLowerCase();
      const out = await auditService.export(limit, collectFilters(req.query || {}), format);
      res.set('content-type', out.contentType);
      res.status(200).send(out.body);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildAuditRouter };
