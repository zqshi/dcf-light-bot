const express = require('express');

function buildInstanceRouter(instanceService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('control:instance:read'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await instanceService.list() });
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

  return router;
}

module.exports = { buildInstanceRouter };
