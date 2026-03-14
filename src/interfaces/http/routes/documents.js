const express = require('express');

function buildDocumentRouter(documentService, requirePermission) {
  const router = express.Router();

  // GET /api/control/documents
  router.get('/', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const roomId = String(req.query.roomId || '').trim() || undefined;
      const folderId = String(req.query.folderId || '').trim() || undefined;
      const documents = await documentService.list(roomId, { folderId });
      res.json({ success: true, documents });
    } catch (error) { next(error); }
  });

  // GET /api/control/documents/:id
  router.get('/:id', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const doc = await documentService.get(req.params.id);
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents
  router.post('/', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.create(req.body);
      res.status(201).json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // PUT /api/control/documents/:id
  router.put('/:id', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.update(req.params.id, req.body);
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // DELETE /api/control/documents/:id
  router.delete('/:id', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      await documentService.delete(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // PATCH /api/control/documents/:id/star
  router.patch('/:id/star', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.toggleStar(req.params.id);
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildDocumentRouter };
