const { toMs } = require('../../../shared/time');

function registerAdminCompatSharedAgentRoutes(router, context, deps) {
  const listSharedAgents = deps.listSharedAgents;
  const ensureSharedAgentsHydrated = deps.ensureSharedAgentsHydrated;
  const parseRuntimeSharedAgentEvent = deps.parseRuntimeSharedAgentEvent;
  const upsertSharedAgentBySignature = deps.upsertSharedAgentBySignature;
  const persistSharedAgents = deps.persistSharedAgents;

  router.get('/api/admin/agents/shared', async (req, res) => {
    let rows = await listSharedAgents();
    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    const status = String((req.query && req.query.status) || '').trim().toLowerCase();
    const owner = String((req.query && req.query.ownerEmployeeId) || '').trim();
    if (keyword) {
      rows = rows.filter((x) => [
        x.id,
        x.name,
        x.capabilitySignature,
        x.description,
        ...(Array.isArray(x.tags) ? x.tags : [])
      ].join(' ').toLowerCase().includes(keyword));
    }
    if (status) rows = rows.filter((x) => String(x.status || '').toLowerCase() === status);
    if (owner) rows = rows.filter((x) => String(x.ownerEmployeeId || '') === owner);

    const summary = {
      total: rows.length,
      active: rows.filter((x) => String(x.status || '').toLowerCase() === 'active').length,
      paused: rows.filter((x) => String(x.status || '').toLowerCase() === 'paused').length,
      owned: rows.filter((x) => String(x.ownerEmployeeId || '').trim()).length,
      shared: rows.filter((x) => !String(x.ownerEmployeeId || '').trim()).length
    };
    res.json({ rows, summary });
  });

  router.post('/api/admin/agents/shared/register', async (_req, res) => {
    res.status(410).json({
      error: 'manual_register_disabled',
      message: '共享Agent改为运行时自动沉淀模式，不支持后台手工注册。'
    });
  });

  router.post('/api/admin/agents/shared/runtime-events', async (req, res) => {
    await ensureSharedAgentsHydrated();
    const actor = (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const events = Array.isArray(body.events) ? body.events : [body.event || body];
    let upserted = 0;
    const rows = [];
    for (const item of events) {
      const parsed = parseRuntimeSharedAgentEvent({ payload: item });
      if (!parsed) continue;
      const result = upsertSharedAgentBySignature(parsed);
      if (!result.changed || !result.row) continue;
      upserted += 1;
      rows.push(result.row);
    }
    if (upserted > 0) {
      await persistSharedAgents(`runtime:${actor}`);
      await context.auditService.log('runtime.openclaw.shared_agent.upserted', {
        actor,
        upserted,
        source: 'runtime-events-api'
      });
    }
    res.json({ success: true, upserted, rows });
  });

  router.post('/api/admin/agents/shared/:id', async (_req, res) => {
    res.status(410).json({
      error: 'manual_update_disabled',
      message: '共享Agent改为只读运营视图，不支持后台手工更新。'
    });
  });

  router.post('/api/admin/agents/shared/:id/delete', async (_req, res) => {
    res.status(410).json({
      error: 'manual_delete_disabled',
      message: '共享Agent改为只读运营视图，不支持后台手工删除。'
    });
  });

  router.get('/api/admin/agents/shared/recommend', async (req, res) => {
    const jobCode = String((req.query && req.query.jobCode) || '').trim().toLowerCase();
    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    let rows = (await listSharedAgents()).filter((x) => String(x.status || '').toLowerCase() === 'active');
    if (jobCode) {
      rows = rows.filter((x) => (
        Array.isArray(x.jobCodes) && x.jobCodes.map((k) => String(k || '').toLowerCase()).includes(jobCode)
      ));
    }
    if (keyword) {
      rows = rows.filter((x) => [
        x.name,
        x.capabilitySignature,
        ...(Array.isArray(x.tags) ? x.tags : [])
      ].join(' ').toLowerCase().includes(keyword));
    }
    rows.sort((a, b) => (Number(b.usageCount || 0) - Number(a.usageCount || 0)) || (toMs(b.updatedAt) - toMs(a.updatedAt)));
    res.json({
      rows: rows.slice(0, 30),
      summary: {
        total: rows.length,
        jobCode: jobCode || null,
        keyword: keyword || null
      }
    });
  });

  router.post('/api/admin/agents/shared/auto-bind/:employeeId', async (_req, res) => {
    res.status(410).json({
      error: 'manual_bind_disabled',
      message: '共享Agent改为运行时自动绑定模式，不支持后台手工绑定。'
    });
  });
}

module.exports = { registerAdminCompatSharedAgentRoutes };
