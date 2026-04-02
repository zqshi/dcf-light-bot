const express = require('express');

function buildKnowledgeAuditRouter(knowledgeAuditService, requirePermission) {
  const router = express.Router();

  router.get('/', requirePermission('control:document:read'), async (req, res, next) => {
    try {
      const { operationType, operatorId, search, limit } = req.query;
      const entries = await knowledgeAuditService.list({
        operationType: String(operationType || '').trim() || undefined,
        operatorId: String(operatorId || '').trim() || undefined,
        search: String(search || '').trim() || undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, entries });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { buildKnowledgeAuditRouter };
