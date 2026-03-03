const express = require('express');

function buildAuditRouter(auditService, requirePermission) {
  const router = express.Router();

  function collectFilters(query) {
    const out = {};
    if (query.type) out.type = query.type;
    if (query.actor) out.actor = query.actor;
    if (query.tenantId) out.tenantId = query.tenantId;
    if (query.instanceId) out.instanceId = query.instanceId;
    if (query.from) out.from = query.from;
    if (query.to) out.to = query.to;
    if (query.sinceId) out.sinceId = query.sinceId;
    if (query.sinceAt) out.sinceAt = query.sinceAt;
    if (query.untilAt) out.untilAt = query.untilAt;
    return out;
  }

  router.get('/', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
      const cursor = String(req.query.cursor || '').trim() || '0';
      const page = await auditService.queryPage(limit, collectFilters(req.query || {}), cursor);
      res.json({
        success: true,
        data: page.rows,
        total: page.total,
        cursor: page.cursor,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 1000)));
      const format = String(req.query.format || 'json').trim().toLowerCase();
      const cursor = String(req.query.cursor || '').trim() || '0';
      const out = await auditService.export(limit, collectFilters(req.query || {}), format, cursor);
      res.set('content-type', out.contentType);
      if (out.nextCursor) res.set('x-next-cursor', out.nextCursor);
      res.set('x-has-more', String(Boolean(out.hasMore)));
      res.status(200).send(out.body);
    } catch (error) {
      next(error);
    }
  });

  router.get('/trace/instances/:instanceId', requirePermission('control:audit:read'), async (req, res, next) => {
    try {
      const summary = await auditService.traceByInstance(req.params.instanceId, {
        limit: req.query.limit,
        filters: collectFilters(req.query || {})
      });
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildAuditRouter };
