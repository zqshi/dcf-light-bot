const express = require('express');

function buildPlatformTenantRouter(tenantService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('platform:tenant:read'), async (req, res, next) => {
    try {
      const filters = {
        status: req.query.status || null,
        plan: req.query.plan || null,
        q: req.query.q || null
      };
      const tenants = await tenantService.list(filters);
      res.json({ success: true, data: tenants });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      const result = await tenantService.create(req.body || {});
      res.status(201).json({ success: true, data: result.tenant, adminCreated: result.adminCreated });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requirePermission('platform:tenant:read'), async (req, res, next) => {
    try {
      const tenant = await tenantService.getById(req.params.id);
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      const tenant = await tenantService.update(req.params.id, req.body || {});
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/suspend', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      const tenant = await tenantService.suspend(req.params.id);
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/activate', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      const tenant = await tenantService.activate(req.params.id);
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/archive', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      const tenant = await tenantService.archive(req.params.id);
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/usage', requirePermission('platform:tenant:read'), async (req, res, next) => {
    try {
      const usage = await tenantService.getUsage(req.params.id);
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildPlatformTenantRouter };
