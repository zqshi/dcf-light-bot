function actorOf(req) {
  return (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
}

function registerAdminCompatInstanceRoutes(router, context, deps) {
  const listEmployees = deps.listEmployees;
  const filterInstanceRows = deps.filterInstanceRows;
  const getEmployeeById = deps.getEmployeeById;

  router.get('/api/admin/instances', async (req, res) => {
    const rows = await listEmployees(req.tenantId);
    res.json(filterInstanceRows(rows, req.query || {}));
  });

  router.get('/api/admin/instances/:id', async (req, res) => {
    const row = await getEmployeeById(String(req.params.id || ''), req.tenantId);
    if (!row) {
      res.status(404).json({ error: 'instance not found' });
      return;
    }
    res.json(row);
  });

  router.post('/api/admin/instances/:id/start', async (req, res) => {
    const id = String(req.params.id || '');
    const next = await context.instanceService.start(id);
    await context.auditService.log('admin.instance.started', {
      instanceId: id,
      state: next.state,
      actor: actorOf(req)
    });
    const row = await getEmployeeById(id, req.tenantId);
    res.json(row || next);
  });

  router.post('/api/admin/instances/:id/stop', async (req, res) => {
    const id = String(req.params.id || '');
    const next = await context.instanceService.stop(id);
    await context.auditService.log('admin.instance.stopped', {
      instanceId: id,
      state: next.state,
      actor: actorOf(req)
    });
    const row = await getEmployeeById(id, req.tenantId);
    res.json(row || next);
  });

  router.post('/api/admin/instances/:id/rebuild', async (req, res) => {
    const id = String(req.params.id || '');
    const next = await context.instanceService.rebuild(id);
    await context.auditService.log('admin.instance.rebuilt', {
      instanceId: id,
      state: next.state,
      actor: actorOf(req)
    });
    const row = await getEmployeeById(id, req.tenantId);
    res.json(row || next);
  });

  router.post('/api/admin/instances/:id/delete', async (req, res) => {
    const id = String(req.params.id || '');
    await context.instanceService.remove(id);
    await context.auditService.log('admin.instance.deleted', {
      instanceId: id,
      actor: actorOf(req)
    });
    res.json({ success: true, instanceId: id });
  });
}

module.exports = { registerAdminCompatInstanceRoutes };

