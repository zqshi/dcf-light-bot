const { nowIso } = require('../../../shared/time');
const { newId, actorOf } = require('./adminCompatUtils');

function registerAdminCompatToolRoutes(router, context, deps) {
  const toolServiceStore = deps.toolServiceStore;
  const hydrateToolServices = deps.hydrateToolServices;
  const normalizeToolRow = deps.normalizeToolRow;

  router.get('/api/admin/tools/mcp-services', async (_req, res) => {
    await hydrateToolServices();
    res.json(Array.from(toolServiceStore.values()).map((x) => ({ ...x, serviceId: x.id })));
  });

  router.post('/api/admin/tools/mcp-services', async (req, res) => {
    await hydrateToolServices();
    const payload = normalizeToolRow(req.body, { registrationStatus: 'pending', registrant: req.adminSession.user.username });
    if (!payload.name || !payload.endpoint) {
      res.status(400).json({ error: 'name and endpoint are required' });
      return;
    }
    toolServiceStore.set(payload.id, payload);
    await context.auditService.log('admin.tools.mcp.created', { serviceId: payload.id, name: payload.name, registrationStatus: payload.registrationStatus });
    res.json({ success: true, service: payload });
  });

  router.post('/api/admin/tools/mcp-services/:id', async (req, res) => {
    await hydrateToolServices();
    const id = String(req.params.id);
    const existed = toolServiceStore.get(id);
    if (!existed) {
      res.status(404).json({ error: 'service not found' });
      return;
    }
    const next = normalizeToolRow(req.body, existed);
    next.id = id;
    next.registrationStatus = existed.registrationStatus || 'approved';
    toolServiceStore.set(id, next);
    await context.auditService.log('admin.tools.mcp.updated', { serviceId: id, enabled: next.enabled });
    res.json({ success: true, service: next });
  });

  router.post('/api/admin/tools/mcp-services/:id/check-health', async (req, res) => {
    await hydrateToolServices();
    const id = String(req.params.id);
    const row = toolServiceStore.get(id);
    if (!row) {
      res.status(404).json({ error: 'service not found' });
      return;
    }
    row.health = { status: 'healthy', latencyMs: 25, checkedAt: nowIso() };
    row.updatedAt = nowIso();
    toolServiceStore.set(id, row);
    await context.auditService.log('admin.tools.mcp.health_checked', { serviceId: id, health: row.health.status });
    res.json({ serviceId: id, health: row.health });
  });

  router.post('/api/admin/tools/mcp-services/:id/delete', async (req, res) => {
    await hydrateToolServices();
    const id = String(req.params.id);
    toolServiceStore.delete(id);
    await context.auditService.log('admin.tools.mcp.deleted', { serviceId: id });
    res.json({ success: true, serviceId: id });
  });

  router.get('/api/admin/tools/pending', async (_req, res) => {
    await hydrateToolServices();
    const rows = Array.from(toolServiceStore.values())
      .filter((x) => ['pending', 'rejected', 'rollback'].includes(String(x.registrationStatus || 'pending')))
      .map((x) => ({ ...x }));
    res.json(rows);
  });

  router.post('/api/admin/tools/mcp-services/:id/:action', async (req, res) => {
    await hydrateToolServices();
    const id = String(req.params.id);
    const action = String(req.params.action || '').trim();
    const row = toolServiceStore.get(id);
    if (!row) {
      res.status(404).json({ error: 'service not found' });
      return;
    }
    const map = { approve: 'approved', reject: 'rejected', rollback: 'rollback', resubmit: 'pending' };
    if (!map[action]) {
      res.status(400).json({ error: 'unsupported action' });
      return;
    }
    row.registrationStatus = map[action];
    row.updatedAt = nowIso();
    toolServiceStore.set(id, row);
    await context.auditService.log(`admin.tools.mcp.${action}`, { serviceId: id, registrationStatus: row.registrationStatus });
    res.json({ success: true, serviceId: id, action, registrationStatus: row.registrationStatus });
  });
}

module.exports = { registerAdminCompatToolRoutes };
