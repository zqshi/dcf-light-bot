const { nowIso } = require('../../../shared/time');

function registerAdminCompatSkillRoutes(router, context, deps) {
  const listSharedAssets = deps.listSharedAssets;
  const listEmployees = deps.listEmployees;
  const deletedSkillIds = deps.deletedSkillIds;
  const employeeSkillLinks = deps.employeeSkillLinks;
  const skillPolicyState = deps.skillPolicyState;

  router.get('/api/admin/skills', async (req, res) => {
    const shared = await listSharedAssets('skill');
    const rows = shared
      .filter((x) => !deletedSkillIds.has(String(x.id)))
      .map((x) => ({
        id: x.id,
        name: x.name,
        status: 'active',
        source: 'shared-center',
        description: x.description || '',
        linkedEmployeeIds: [],
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        metadata: x.metadata || {}
      }));

    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const out = keyword
      ? rows.filter((x) => `${x.id} ${x.name} ${x.description}`.toLowerCase().includes(keyword))
      : rows;
    res.json(out);
  });

  router.get('/api/admin/skills/:id', async (req, res) => {
    const rows = await listSharedAssets('skill');
    const row = rows.find((x) => String(x.id) === String(req.params.id));
    if (!row || deletedSkillIds.has(String(row.id))) {
      res.status(404).json({ error: 'skill not found' });
      return;
    }
    res.json({
      id: row.id,
      name: row.name,
      description: row.description || '',
      status: 'active',
      source: 'shared-center',
      linkedEmployeeIds: [],
      resources: row.payload || {},
      metadata: row.metadata || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  });

  router.get('/api/admin/skills/employees', async (req, res) => {
    const rows = await listEmployees(req.tenantId);
    res.json(rows.map((x) => ({ id: x.id, name: x.name, department: x.department, role: x.role })));
  });

  router.post('/api/admin/skills/:id/link', (req, res) => {
    const skillId = String(req.params.id);
    const employeeId = String((req.body && req.body.employeeId) || '').trim();
    if (!employeeId) {
      res.status(400).json({ error: 'employeeId is required' });
      return;
    }
    const list = employeeSkillLinks.get(employeeId) || [];
    if (!list.includes(skillId)) list.push(skillId);
    employeeSkillLinks.set(employeeId, list);
    res.json({ success: true, employeeId, skillId });
  });

  router.post('/api/admin/skills/:id/unlink', (req, res) => {
    const skillId = String(req.params.id);
    const employeeId = String((req.body && req.body.employeeId) || '').trim();
    if (employeeId) {
      const list = (employeeSkillLinks.get(employeeId) || []).filter((x) => x !== skillId);
      employeeSkillLinks.set(employeeId, list);
    }
    res.json({ success: true, employeeId, skillId });
  });

  router.delete('/api/admin/skills/:id', (req, res) => {
    deletedSkillIds.add(String(req.params.id));
    res.json({ success: true });
  });

  router.get('/api/admin/skills/export', async (_req, res) => {
    const shared = await listSharedAssets('skill');
    res.json(shared.filter((x) => !deletedSkillIds.has(String(x.id))));
  });

  router.post('/api/admin/skills/import', (_req, res) => {
    res.json({ success: true, imported: 0, skipped: 0, mode: 'noop' });
  });

  router.get('/api/admin/runtime/skill-sedimentation-policy', (_req, res) => {
    res.json(skillPolicyState);
  });

  router.post('/api/admin/runtime/skill-sedimentation-policy', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    skillPolicyState.mode = String(body.mode || skillPolicyState.mode || 'hybrid');
    skillPolicyState.minConfidence = Number(body.minConfidence ?? skillPolicyState.minConfidence ?? 0.7);
    skillPolicyState.fallbackToRulesWhenModelUnavailable = body.fallbackToRulesWhenModelUnavailable !== false;
    skillPolicyState.minRepeatedSuccessForFallback = Math.max(1, Number(body.minRepeatedSuccessForFallback || skillPolicyState.minRepeatedSuccessForFallback || 2));
    skillPolicyState.overrides = Array.isArray(body.overrides) ? body.overrides : [];
    skillPolicyState.updatedAt = nowIso();
    res.json(skillPolicyState);
  });
}

module.exports = { registerAdminCompatSkillRoutes };
