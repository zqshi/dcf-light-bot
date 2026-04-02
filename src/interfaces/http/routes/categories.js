const express = require('express');

function buildCategoryRouter(categoryService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const categories = await categoryService.list();
      res.json({ success: true, categories });
    } catch (error) { next(error); }
  });

  router.get('/:id', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const category = await categoryService.get(req.params.id);
      res.json({ success: true, category });
    } catch (error) { next(error); }
  });

  router.post('/', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const category = await categoryService.create(req.body);
      res.status(201).json({ success: true, category });
    } catch (error) { next(error); }
  });

  router.put('/:id', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const category = await categoryService.update(req.params.id, req.body);
      res.json({ success: true, category });
    } catch (error) { next(error); }
  });

  router.delete('/:id', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      await categoryService.delete(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildCategoryRouter };
