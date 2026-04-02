const express = require('express');

function buildDocumentRouter(documentService, requirePermission) {
  const router = express.Router();

  // GET /api/control/documents
  router.get('/', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const { roomId, folderId, status, categoryId, departmentId, ownerId, starred, search } = req.query;
      const documents = await documentService.list(
        String(roomId || '').trim() || undefined,
        {
          folderId: String(folderId || '').trim() || undefined,
          status: String(status || '').trim() || undefined,
          categoryId: String(categoryId || '').trim() || undefined,
          departmentId: String(departmentId || '').trim() || undefined,
          ownerId: String(ownerId || '').trim() || undefined,
          starred: starred !== undefined ? starred === 'true' : undefined,
          search: String(search || '').trim() || undefined,
        },
      );
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

  // POST /api/control/documents/:id/submit-review
  router.post('/:id/submit-review', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.submitForReview(req.params.id, req.body.actor || {});
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents/:id/approve
  router.post('/:id/approve', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.approve(req.params.id, req.body.actor || {});
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents/:id/reject
  router.post('/:id/reject', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.reject(req.params.id, req.body.comment, req.body.actor || {});
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents/:id/publish
  router.post('/:id/publish', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.publish(req.params.id, req.body.actor || {});
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents/:id/archive
  router.post('/:id/archive', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.archive(req.params.id, req.body.actor || {});
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // GET /api/control/documents/:id/versions
  router.get('/:id/versions', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const versions = await documentService.listVersions(req.params.id);
      res.json({ success: true, versions });
    } catch (error) { next(error); }
  });

  // POST /api/control/documents/versions/:versionId/restore
  router.post('/versions/:versionId/restore', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const doc = await documentService.restoreVersion(req.params.versionId);
      res.json({ success: true, document: doc });
    } catch (error) { next(error); }
  });

  // GET /api/control/documents/:id/permissions
  router.get('/:id/permissions', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const permissions = await documentService.getPermissions(req.params.id);
      res.json({ success: true, permissions });
    } catch (error) { next(error); }
  });

  // PUT /api/control/documents/:id/permissions
  router.put('/:id/permissions', requirePermission('control:document:write'), async (req, res, next) => {
    try {
      const permissions = await documentService.updatePermissions(req.params.id, req.body.permissions || []);
      res.json({ success: true, permissions });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildDocumentRouter };
