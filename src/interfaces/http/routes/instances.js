const express = require('express');

function buildInstanceRouter(instanceService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('control:instance:read'), async (req, res, next) => {
    try {
      let rows = await instanceService.list();
      const state = String(req.query.state || '').trim();
      const name = String(req.query.name || '').trim().toLowerCase();
      const tenantId = String(req.query.tenantId || '').trim().toLowerCase();
      if (state) {
        rows = rows.filter((x) => String(x.state || '') === state);
      }
      if (name) {
        rows = rows.filter((x) => String(x.name || '').toLowerCase().includes(name));
      }
      if (tenantId) {
        rows = rows.filter((x) => String(x.tenantId || '').toLowerCase().includes(tenantId));
      }
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:instanceId', requirePermission('control:instance:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.get(req.params.instanceId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      const created = await instanceService.createFromMatrix({
        ...req.body,
        creator: req.body.creator || req.principal.username || 'api',
        matrixRoomId: req.body.matrixRoomId || null
      });
      res.status(201).json({ success: true, data: created, card: instanceService.buildMatrixCard(created) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/batch-actions', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const action = String(body.action || 'start').trim().toLowerCase();
      const ids = Array.isArray(body.instanceIds) ? body.instanceIds : [];
      const results = [];
      for (const rawId of ids) {
        const instanceId = String(rawId || '').trim();
        if (!instanceId) continue;
        try {
          let data;
          if (action === 'start') data = await instanceService.start(instanceId);
          else if (action === 'stop') data = await instanceService.stop(instanceId);
          else if (action === 'rebuild') data = await instanceService.rebuild(instanceId);
          else if (action === 'delete') data = await instanceService.remove(instanceId);
          else throw new Error('action must be start|stop|rebuild|delete');
          results.push({ instanceId, ok: true, data });
        } catch (error) {
          results.push({ instanceId, ok: false, error: String(error.message || 'batch action failed') });
        }
      }
      const succeeded = results.filter((x) => x.ok).length;
      const failed = results.length - succeeded;
      res.json({
        success: true,
        data: {
          action,
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

  router.post('/:instanceId/start', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.start(req.params.instanceId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:instanceId/stop', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.stop(req.params.instanceId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:instanceId/rebuild', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.rebuild(req.params.instanceId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:instanceId/delete', requirePermission('control:instance:write'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.remove(req.params.instanceId) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildInstanceRouter };
