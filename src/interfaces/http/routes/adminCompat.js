const express = require('express');
const crypto = require('crypto');
const { ROLE_PERMISSIONS } = require('../../../contexts/identity-access/application/AuthService');
const { buildPromptStrategyCompatRouter } = require('./adminCompatPromptStrategy');
const { registerAdminCompatInstanceRoutes } = require('./adminCompatInstances');
const { registerAdminCompatAssetRoutes } = require('./adminCompatAssets');

function parseCookies(headerValue) {
  const out = {};
  const raw = String(headerValue || '');
  if (!raw) return out;
  raw.split(';').forEach((item) => {
    const idx = item.indexOf('=');
    if (idx <= 0) return;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function safeJson(input, fallback) {
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return fallback;
  }
}

function pickInstanceRole(name) {
  const raw = String(name || '').toLowerCase();
  if (raw.includes('review')) return 'reviewer';
  if (raw.includes('ops')) return 'operator';
  if (raw.includes('finance')) return 'analyst';
  if (raw.includes('dev') || raw.includes('engineer')) return 'engineer';
  return 'operator';
}

function buildDefaultJobPolicy(instance) {
  const cmdBase = ['/help', '/status'];
  const extra = String(instance.name || '').toLowerCase().includes('dev')
    ? ['/runtime', '/trace']
    : ['/report'];
  return {
    allow: cmdBase.concat(extra),
    deny: ['rm -rf /', 'shutdown now'],
    kpi: ['交付成功率>=95%', '响应时间<2min'],
    escalationRule: '连续失败2次自动升级到reviewer',
    shutdownRule: '检测到高危命令立即中止并上报'
  };
}

function buildDefaultApprovalPolicy() {
  return {
    byRisk: {
      L1: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
      L2: { requiredApprovals: 1, requiredAnyRoles: ['ops_admin'], distinctRoles: false },
      L3: { requiredApprovals: 1, requiredAnyRoles: ['reviewer', 'ops_admin'], distinctRoles: false },
      L4: { requiredApprovals: 2, requiredAnyRoles: ['platform_admin', 'auditor'], distinctRoles: true }
    }
  };
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${String(prefix || 'id')}_${crypto.randomBytes(8).toString('hex')}`;
}

function buildAdminCompatRouter(context) {
  const router = express.Router();
  const sessions = new Map();
  const sessionTtlSec = Math.max(300, Number(context.config.controlPlaneJwtExpiresInSec || 8 * 3600));

  const employeeProfileOverrides = new Map();
  const employeePolicyOverrides = new Map();
  const employeeApprovalOverrides = new Map();
  const employeeSkillLinks = new Map();
  const deletedSkillIds = new Set();
  const skillPolicyState = {
    mode: 'hybrid',
    minConfidence: 0.7,
    fallbackToRulesWhenModelUnavailable: true,
    minRepeatedSuccessForFallback: 2,
    overrides: [],
    updatedAt: nowIso()
  };
  const toolServiceStore = new Map();
  let toolStoreHydrated = false;
  const ossCaseState = new Map();

  const roleStore = new Map();
  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    roleStore.set(role, { role, permissions: Array.from(new Set(perms)), updatedAt: nowIso() });
  });

  const userStore = new Map();
  (Array.isArray(context.config.controlPlaneUsers) ? context.config.controlPlaneUsers : []).forEach((u) => {
    userStore.set(String(u.username), {
      id: `user_${String(u.username)}`,
      username: String(u.username),
      displayName: String(u.username),
      role: String(u.role || 'ops_admin'),
      disabled: Boolean(u.disabled),
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  });

  function buildNavItems() {
    return [
      { path: '/admin/index.html', label: '总览', permission: 'admin.runtime.page.platform-overview.read' },
      { path: '/admin/runtime.html', label: '运行诊断', permission: 'admin.runtime.page.overview.read' },
      { path: '/admin/strategy-center.html', label: '治理中心', permission: 'admin.runtime.write' },
      { path: '/admin/employees.html', label: '员工管理', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/skills.html', label: '技能管理', permission: 'admin.skills.page.management.read' },
      { path: '/admin/tasks.html', label: '任务台账', permission: 'admin.tasks.page.overview.read' },
      { path: '/admin/logs.html', label: '行为日志', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/oss.html', label: '开源检索', permission: 'admin.oss.page.search.read' },
      { path: '/admin/auth-members.html', label: '成员管理', permission: 'admin.auth.page.members.read' }
    ];
  }

  function buildSession(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sid = String(cookies.dcf_admin_session || '');
    if (!sid) return null;
    const sess = sessions.get(sid);
    if (!sess) return null;
    if (Date.now() >= sess.expiresAt) {
      sessions.delete(sid);
      return null;
    }
    return { sid, ...sess };
  }

  function requireSession(req, res, next) {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, error: 'UNAUTHORIZED' });
      return;
    }
    req.adminSession = session;
    next();
  }

  function setSessionCookie(res, sid, maxAgeSec) {
    const maxAge = Math.max(60, Number(maxAgeSec || sessionTtlSec));
    const cookie = [
      `dcf_admin_session=${encodeURIComponent(sid)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`
    ].join('; ');
    res.setHeader('Set-Cookie', cookie);
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'dcf_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }

  async function listInstances() {
    return context.instanceService.list();
  }

  async function listSharedAssets(type) {
    const svc = context.assetService || context.skillService;
    if (!svc || typeof svc.listSharedAssets !== 'function') return [];
    return svc.listSharedAssets(type);
  }

  async function listAssetReportsByType(type) {
    const svc = context.assetService || context.skillService;
    if (!svc || typeof svc.listReportsByType !== 'function') return [];
    return svc.listReportsByType(type);
  }

  async function hydrateToolServices() {
    if (toolStoreHydrated) return;
    const rows = await listSharedAssets('tool');
    rows.forEach((x) => {
      toolServiceStore.set(String(x.id), {
        id: String(x.id),
        name: String(x.name || x.id),
        transport: String((x.payload && x.payload.transport) || 'http'),
        endpoint: String((x.payload && x.payload.endpoint) || ''),
        description: String(x.description || ''),
        enabled: true,
        registrationSource: 'shared-center',
        registrant: 'system',
        registrationStatus: 'approved',
        health: null,
        updatedAt: x.updatedAt || x.createdAt || nowIso(),
        createdAt: x.createdAt || nowIso()
      });
    });
    toolStoreHydrated = true;
  }

  function normalizeToolRow(input = {}, seed = {}) {
    return {
      id: String(seed.id || input.id || newId('tool')),
      name: String(input.name || seed.name || '').trim(),
      transport: String(input.transport || seed.transport || 'http').trim(),
      endpoint: String(input.endpoint || seed.endpoint || '').trim(),
      description: String(input.description || seed.description || '').trim(),
      enabled: input.enabled === undefined ? Boolean(seed.enabled !== false) : Boolean(input.enabled),
      registrationSource: String(seed.registrationSource || input.registrationSource || 'manual'),
      registrant: String(seed.registrant || input.registrant || 'admin'),
      registrationStatus: String(seed.registrationStatus || input.registrationStatus || 'pending'),
      health: seed.health || null,
      createdAt: seed.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }

  function employeeFromInstance(instance) {
    const profile = employeeProfileOverrides.get(instance.id) || {};
    const linked = employeeSkillLinks.get(instance.id) || [];
    const policy = employeePolicyOverrides.get(instance.id) || buildDefaultJobPolicy(instance);
    const approvalPolicy = employeeApprovalOverrides.get(instance.id) || buildDefaultApprovalPolicy();
    const department = String(profile.department || 'operations');
    const role = String(profile.role || pickInstanceRole(instance.name));
    return {
      id: instance.id,
      name: String(profile.name || instance.name || instance.id),
      displayName: String(profile.displayName || profile.name || instance.name || instance.id),
      department,
      role,
      status: String(instance.state || 'unknown'),
      tenantId: String(instance.tenantId || ''),
      creator: String(instance.creator || ''),
      matrixRoomId: instance.matrixRoomId || null,
      runtimeEndpoint: instance.runtime && instance.runtime.endpoint ? instance.runtime.endpoint : null,
      capabilities: Array.isArray(profile.capabilities) ? profile.capabilities : [],
      knowledge: Array.isArray(profile.knowledge) ? profile.knowledge : [],
      linkedSkillIds: Array.isArray(linked) ? linked : [],
      childAgents: Array.isArray(profile.childAgents) ? profile.childAgents : [],
      runtimeProfile: {
        agentId: String(profile.agentId || 'main'),
        policyId: String(profile.policyId || 'default'),
        toolScope: Array.isArray(profile.toolScope) ? profile.toolScope : ['matrix', 'runtime_proxy'],
        systemPrompt: String(profile.systemPrompt || ''),
        extraSystemPrompt: String(profile.extraSystemPrompt || '')
      },
      jobPolicy: safeJson(policy, buildDefaultJobPolicy(instance)),
      approvalPolicy: safeJson(approvalPolicy, buildDefaultApprovalPolicy()),
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    };
  }

  async function listEmployees() {
    const instances = await listInstances();
    return instances.map((row) => employeeFromInstance(row));
  }

  function filterInstanceRows(rows, query = {}) {
    const keyword = String(query.keyword || query.name || '').trim().toLowerCase();
    const department = String(query.department || '').trim();
    const role = String(query.role || '').trim();
    const state = String(query.state || '').trim().toLowerCase();
    const tenantId = String(query.tenantId || '').trim().toLowerCase();
    const channel = String(query.channel || '').trim().toLowerCase();
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (department && row.department !== department) return false;
      if (role && row.role !== role) return false;
      if (state && String(row.status || '').toLowerCase() !== state) return false;
      if (tenantId && !String(row.tenantId || '').toLowerCase().includes(tenantId)) return false;
      if (channel && !String(row.matrixRoomId || '').toLowerCase().includes(channel)) return false;
      if (!keyword) return true;
      const hay = [
        row.id,
        row.name,
        row.displayName,
        row.department,
        row.role,
        row.tenantId,
        row.matrixRoomId
      ].join(' ').toLowerCase();
      return hay.includes(keyword);
    });
  }

  async function getEmployeeById(id) {
    const rows = await listEmployees();
    return rows.find((x) => x.id === id) || null;
  }

  function rolePayload(role) {
    return {
      role: role.role,
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      updatedAt: role.updatedAt || nowIso()
    };
  }

  function userPayload(user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      disabled: user.disabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  router.post('/api/auth/login', async (req, res) => {
    try {
      const body = req.body || {};
      const result = await context.authService.login(body.username || '', body.password || '');
      const sid = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, {
        token: result.token,
        user: result.user,
        expiresAt: Date.now() + (Number(result.expiresInSec || sessionTtlSec) * 1000)
      });
      setSessionCookie(res, sid, Number(result.expiresInSec || sessionTtlSec));
      res.json({ authenticated: true, user: result.user, expiresInSec: result.expiresInSec });
    } catch (error) {
      res.status(Number(error.statusCode || 401)).json({ error: error.message || '登录失败' });
    }
  });

  router.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sid = String(cookies.dcf_admin_session || '');
    if (sid) sessions.delete(sid);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  router.get('/api/auth/me', (req, res) => {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, user: null });
      return;
    }
    const user = session.user || {};
    const roleModel = roleStore.get(String(user.role || ''));
    const permissions = roleModel ? roleModel.permissions : (Array.isArray(user.permissions) ? user.permissions : []);
    res.json({
      authenticated: true,
      user: {
        username: String(user.username || ''),
        displayName: String(user.username || ''),
        role: String(user.role || 'ops_admin'),
        permissions
      }
    });
  });

  router.post('/api/auth/renew', (req, res) => {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, remainingSeconds: 0 });
      return;
    }
    const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
    res.json({ authenticated: true, remainingSeconds: remaining });
  });

  router.get('/api/auth/acl', requireSession, (req, res) => {
    res.json({ navItems: buildNavItems() });
  });

  router.get('/api/auth/sso/capabilities', (_req, res) => {
    res.json({ enabled: false, provider: 'none', bridgeLoginEnabled: false, authorizeConfigured: false });
  });

  router.get('/api/auth/sso/authorize', (_req, res) => {
    res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
  });

  router.post('/api/auth/sso/bridge-login', (_req, res) => {
    res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
  });

  router.get('/api/framework', (_req, res) => {
    res.json({
      name: 'dcf-light-bot',
      mode: context.config.kubernetesSimulationMode ? 'simulation' : 'kubernetes',
      runtime: {
        openclawImage: context.config.openclawImage,
        openclawRuntimeVersion: context.config.openclawRuntimeVersion
      }
    });
  });

  router.get('/api/metrics', async (_req, res) => {
    const instances = await listInstances();
    const audits = await context.auditService.list(1000);
    const succeededTasks = audits.filter((x) => String(x.type) === 'instance.provisioned').length;
    const failedTasks = audits.filter((x) => String(x.type).includes('failed')).length;
    const totalTasks = succeededTasks + failedTasks;
    const successRate = totalTasks ? Math.round((succeededTasks / totalTasks) * 100) : 100;
    res.json({
      totalTasks,
      succeededTasks,
      failedTasks,
      successRate,
      totalEmployees: instances.length,
      skillReused: 0,
      recurrenceErrors: 0,
      p1Incidents: 0
    });
  });

  router.use('/api/admin', requireSession);

  router.get('/api/admin/overview', async (_req, res) => {
    const [instances, dashboard, audits] = await Promise.all([
      listInstances(),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' }),
      context.auditService.list(1000)
    ]);
    const totalTasks = audits.filter((x) => String(x.type).startsWith('instance.')).length;
    const succeededTasks = audits.filter((x) => String(x.type) === 'instance.provisioned').length;
    const failedTasks = audits.filter((x) => String(x.type).includes('failed')).length;
    const inProgressTasks = Math.max(0, totalTasks - succeededTasks - failedTasks);
    const successRate = totalTasks ? Math.round((succeededTasks / totalTasks) * 100) : 100;
    res.json({
      delivery: {
        employeesTotal: instances.length,
        totalTasks,
        succeededTasks,
        failedTasks,
        inProgressTasks,
        successRate
      },
      governance: {
        waitingApprovalTasks: Number(dashboard.pendingTotal || 0),
        compensationPendingTasks: 0,
        rollbackTasks: 0,
        p1Incidents: 0
      },
      assets: {
        skillsTotal: (await listSharedAssets('skill')).length,
        findingsTotal: (await listSharedAssets('knowledge')).length,
        skillReused: 0,
        recurrenceErrors: 0
      },
      runtime: {
        runtimeEnabled: true,
        dialogueEnabled: true,
        queueQueued: 0,
        queueDone: 0,
        backlog: 0,
        phase: 'steady',
        cycleCount: 1,
        manualReviewRequired: Number(dashboard.overdueTotal || 0) > 0
      },
      focus: [
        `当前运行实例 ${instances.length} 个，重点关注失败与降级事件。`,
        `待审批资产 ${Number(dashboard.pendingTotal || 0)} 项，逾期 ${Number(dashboard.overdueTotal || 0)} 项。`,
        '建议持续推进技能、工具、知识的跨租户复用沉淀。'
      ]
    });
  });

  router.get('/api/admin/runtime-status', async (_req, res) => {
    const instances = await listInstances();
    const sharedSkills = await listSharedAssets('skill');
    const sharedFindings = await listSharedAssets('knowledge');
    const reports = await (context.assetService || context.skillService).listReportsByStatus('pending_review');
    res.json({
      runtimeEnabled: true,
      llm: { dialogueEnabled: true },
      counters: {
        employees: instances.length,
        tasks: instances.length,
        skills: sharedSkills.length,
        findings: sharedFindings.length
      },
      queue: {
        researchQueued: 0,
        researchDone: 0
      },
      governance: {
        pendingReviews: reports.length
      },
      bootstrap: {
        phase: 'steady',
        cycleCount: 1,
        manualReviewRequired: reports.length > 0
      }
    });
  });

  router.get('/api/admin/bootstrap-status', async (_req, res) => {
    const reports = await (context.assetService || context.skillService).listReportsByStatus('pending_review');
    res.json({
      phase: 'steady',
      cycleCount: 1,
      manualReviewRequired: reports.length > 0,
      checks: [
        { key: 'matrix', ok: true, label: 'Matrix relay ready' },
        { key: 'openclaw', ok: true, label: 'OpenClaw runtime ready' },
        { key: 'control', ok: true, label: 'Control-plane ready' }
      ]
    });
  });

  registerAdminCompatInstanceRoutes(router, context, { listEmployees, filterInstanceRows, getEmployeeById });
  registerAdminCompatAssetRoutes(router, context, {
    listSharedAssets,
    listAssetReportsByType,
    toolServiceStore,
    hydrateToolServices,
    ossCaseState
  });

  router.get('/api/admin/employees', async (req, res) => {
    const rows = await listEmployees();
    res.json(filterInstanceRows(rows, req.query || {}));
  });

  router.get('/api/admin/employees/:id', async (req, res) => {
    const row = await getEmployeeById(String(req.params.id || ''));
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
    const row = await getEmployeeById(id);
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

  router.get('/api/admin/skills/employees', async (_req, res) => {
    const rows = await listEmployees();
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

  router.use(buildPromptStrategyCompatRouter(context));

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

  router.get('/api/admin/auth/health', (_req, res) => {
    res.json({ ok: true, users: userStore.size, roles: roleStore.size, updatedAt: nowIso() });
  });

  router.get('/api/admin/auth/users', (_req, res) => {
    res.json(Array.from(userStore.values()).map(userPayload));
  });

  router.post('/api/admin/auth/users', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const username = String(body.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const role = String(body.role || 'ops_admin').trim();
    const existed = userStore.get(username);
    const next = existed || {
      id: `user_${username}`,
      username,
      displayName: String(body.displayName || username),
      createdAt: nowIso()
    };
    next.role = role;
    next.disabled = Boolean(body.disabled);
    next.updatedAt = nowIso();
    userStore.set(username, next);
    res.json(userPayload(next));
  });

  router.post('/api/admin/auth/users/:userId', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const row = userStore.get(userId);
    if (!row) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    row.displayName = String(body.displayName || row.displayName || row.username);
    row.role = String(body.role || row.role || 'ops_admin');
    row.disabled = Boolean(body.disabled);
    row.updatedAt = nowIso();
    userStore.set(userId, row);
    res.json(userPayload(row));
  });

  router.post('/api/admin/auth/users/:userId/delete', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    userStore.delete(userId);
    res.json({ success: true, userId });
  });

  router.get('/api/admin/auth/roles', (_req, res) => {
    res.json(Array.from(roleStore.values()).map(rolePayload));
  });

  router.post('/api/admin/auth/roles', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const role = String(body.role || '').trim();
    if (!role) {
      res.status(400).json({ error: 'role is required' });
      return;
    }
    const row = {
      role,
      permissions: Array.isArray(body.permissions) ? body.permissions.map((x) => String(x)) : [],
      updatedAt: nowIso()
    };
    roleStore.set(role, row);
    res.json(rolePayload(row));
  });

  router.post('/api/admin/auth/roles/:role', (req, res) => {
    const role = String(req.params.role || '').trim();
    const existed = roleStore.get(role);
    if (!existed) {
      res.status(404).json({ error: 'role not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    existed.permissions = Array.isArray(body.permissions) ? body.permissions.map((x) => String(x)) : existed.permissions;
    existed.updatedAt = nowIso();
    roleStore.set(role, existed);
    res.json(rolePayload(existed));
  });

  router.post('/api/admin/auth/roles/:role/delete', (req, res) => {
    const role = String(req.params.role || '').trim();
    roleStore.delete(role);
    res.json({ success: true, role });
  });

  router.use('/api/admin', (req, res) => {
    res.json(Array.isArray(req.body) ? [] : { success: true, path: req.path, method: req.method, note: 'compat noop' });
  });

  return router;
}

module.exports = { buildAdminCompatRouter };
