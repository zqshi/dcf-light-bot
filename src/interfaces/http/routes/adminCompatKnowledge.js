const { nowIso } = require('../../../shared/time');
const { actorOf } = require('./adminCompatUtils');

function registerAdminCompatKnowledgeRoutes(router, context, deps) {
  const listSharedAssets = deps.listSharedAssets;
  const listAssetReportsByType = deps.listAssetReportsByType;
  const ossCaseState = deps.ossCaseState;

  router.get('/api/admin/oss-findings', async (_req, res) => {
    const rows = await listSharedAssets('knowledge');
    res.json(rows.map((x) => ({
      id: x.id,
      name: x.name,
      source: x.sourceReportId || 'shared-center',
      status: 'approved',
      createdAt: x.createdAt
    })));
  });

  router.get('/api/admin/oss-cases', async (_req, res) => {
    const reports = await listAssetReportsByType('knowledge');
    res.json(reports.map((x) => ({
      id: x.id,
      title: x.name,
      status: (ossCaseState.get(String(x.id)) || {}).status || x.status,
      sourceTenantId: x.sourceTenantId,
      createdAt: x.createdAt,
      updatedAt: (ossCaseState.get(String(x.id)) || {}).updatedAt || x.updatedAt
    })));
  });

  router.get('/api/admin/oss-cases/:id', async (req, res) => {
    const reports = await listAssetReportsByType('knowledge');
    const row = reports.find((x) => String(x.id) === String(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'oss case not found' });
      return;
    }
    const patch = ossCaseState.get(String(row.id)) || {};
    res.json({
      ...row,
      status: patch.status || row.status,
      updatedAt: patch.updatedAt || row.updatedAt
    });
  });

  router.post('/api/admin/oss-cases/:id/:action', async (req, res) => {
    const caseId = String(req.params.id);
    const action = String(req.params.action || '').trim();
    const reports = await listAssetReportsByType('knowledge');
    const row = reports.find((x) => String(x.id) === caseId);
    if (!row) {
      res.status(404).json({ error: 'oss case not found' });
      return;
    }
    const statusMap = { approve: 'approved', reject: 'rejected', deploy: 'deployed', verify: 'verified', rollback: 'rollback' };
    const nextStatus = statusMap[action] || row.status;
    ossCaseState.set(caseId, { status: nextStatus, updatedAt: nowIso(), action });
    await context.auditService.log('admin.oss.case.action', { caseId, action, status: nextStatus });
    res.json({ success: true, caseId, action, status: nextStatus });
  });
}

module.exports = { registerAdminCompatKnowledgeRoutes };
