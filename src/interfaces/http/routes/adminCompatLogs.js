function registerAdminCompatLogRoutes(router, context, deps) {
  const listInstances = deps.listInstances;

  router.get('/api/admin/logs', async (_req, res) => {
    const rows = await context.auditService.list(1000);
    res.json(rows);
  });

  router.get('/api/admin/tasks', async (_req, res) => {
    const instances = await listInstances();
    const rows = instances.map((x) => ({
      id: `task_${x.id}`,
      status: String(x.state || 'unknown'),
      employeeId: x.id,
      employeeName: x.name,
      goal: `管理实例 ${x.name}`,
      runtime: { source: 'openclaw', taskId: x.id, events: [] },
      logs: []
    }));
    res.json(rows);
  });

  router.get('/api/admin/tasks/:id', async (req, res) => {
    const rows = await listInstances();
    const key = String(req.params.id || '').replace(/^task_/, '');
    const x = rows.find((item) => item.id === key);
    if (!x) {
      res.status(404).json({ error: 'task not found' });
      return;
    }
    res.json({
      id: `task_${x.id}`,
      status: String(x.state || 'unknown'),
      employeeId: x.id,
      employeeName: x.name,
      goal: `管理实例 ${x.name}`,
      runtime: { source: 'openclaw', taskId: x.id, events: [] },
      runtimeConfig: { agentId: 'main', policyId: 'default', toolScope: ['matrix', 'runtime_proxy'] },
      logs: []
    });
  });

  router.get('/api/admin/tasks/:id/rollback-report', (req, res) => {
    res.json({ taskId: req.params.id, supported: false, message: 'rollback report not enabled in light-bot mode' });
  });

  router.get('/api/admin/tasks/:id/rollback-package', (req, res) => {
    res.json({ taskId: req.params.id, supported: false, message: 'rollback package not enabled in light-bot mode' });
  });
}

module.exports = { registerAdminCompatLogRoutes };
