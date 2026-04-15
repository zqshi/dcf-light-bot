const { nowIso } = require('../../../shared/time');
const { safeJson, buildDefaultJobPolicy, buildDefaultApprovalPolicy, actorOf } = require('./adminCompatUtils');

function registerAdminCompatEmployeeRoutes(router, context, deps) {
  const listEmployees = deps.listEmployees;
  const getEmployeeById = deps.getEmployeeById;
  const filterInstanceRows = deps.filterInstanceRows;
  const employeeProfileOverrides = deps.employeeProfileOverrides;
  const employeePolicyOverrides = deps.employeePolicyOverrides;
  const employeeApprovalOverrides = deps.employeeApprovalOverrides;
  const getIdentityMappingByMatrixUserId = deps.getIdentityMappingByMatrixUserId;

  router.get('/api/admin/employees', async (req, res) => {
    const rows = await listEmployees(req.tenantId);
    res.json(filterInstanceRows(rows, req.query || {}));
  });

  router.get('/api/admin/employees/:id', async (req, res) => {
    const row = await getEmployeeById(String(req.params.id || ''), req.tenantId);
    if (!row) {
      res.status(404).json({ error: 'employee not found' });
      return;
    }
    res.json(row);
  });

  router.post('/api/admin/employees/:id/profile', async (req, res) => {
    const id = String(req.params.id);
    const patch = req.body && typeof req.body === 'object' ? req.body : {};
    const prev = employeeProfileOverrides.get(id) || {};
    employeeProfileOverrides.set(id, { ...prev, ...patch, updatedAt: nowIso() });
    const row = await getEmployeeById(id, req.tenantId);
    res.json(row || { success: true });
  });

  router.post('/api/admin/employees/:id/policy', (req, res) => {
    const id = String(req.params.id);
    employeePolicyOverrides.set(id, safeJson(req.body, buildDefaultJobPolicy({ name: id })));
    res.json({ success: true, updatedAt: nowIso() });
  });

  router.post('/api/admin/employees/:id/approval-policy', (req, res) => {
    const id = String(req.params.id);
    employeeApprovalOverrides.set(id, safeJson(req.body, buildDefaultApprovalPolicy()));
    res.json({ success: true, updatedAt: nowIso() });
  });

  router.post('/api/admin/employees/:id/policy-optimize', (req, res) => {
    const id = String(req.params.id);
    const base = employeePolicyOverrides.get(id) || buildDefaultJobPolicy({ name: id });
    res.json({
      optimizedPolicy: {
        ...base,
        kpi: Array.from(new Set([...(base.kpi || []), '审批平均时延<=10分钟']))
      },
      reasons: ['结合审计行为建议提升审批时延 KPI', '保留现有高危动作拦截规则']
    });
  });

  router.post('/api/admin/employees/:id/sync-identity', async (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'employee id is required' });
      return;
    }
    let instance = null;
    try {
      instance = await context.instanceService.get(id);
    } catch {
      instance = null;
    }
    if (!instance) {
      res.status(404).json({ error: 'employee not found' });
      return;
    }
    const mapping = await getIdentityMappingByMatrixUserId(instance.creator || '');
    if (!mapping) {
      res.status(404).json({ error: 'identity mapping not found for employee creator' });
      return;
    }
    const prev = employeeProfileOverrides.get(id) || {};
    employeeProfileOverrides.set(id, {
      ...prev,
      department: String(mapping.department || prev.department || instance.department || '').trim(),
      role: String(mapping.jobCode || prev.role || instance.jobCode || '').trim(),
      updatedAt: nowIso()
    });
    await context.auditService.log('admin.employee.identity.synced', {
      actor: actorOf(req),
      employeeId: id,
      matrixUserId: String(instance.creator || '')
    });
    const row = await getEmployeeById(id, req.tenantId);
    res.json({
      success: true,
      employeeId: id,
      mapping: {
        matrixUserId: String(instance.creator || ''),
        employeeNo: String(mapping.employeeNo || ''),
        email: String(mapping.email || ''),
        jobCode: String(mapping.jobCode || ''),
        jobTitle: String(mapping.jobTitle || ''),
        department: String(mapping.department || '')
      },
      employee: row
    });
  });
}

module.exports = { registerAdminCompatEmployeeRoutes };
