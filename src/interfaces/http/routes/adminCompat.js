const express = require('express');
const crypto = require('crypto');
const { ROLE_PERMISSIONS } = require('../../../contexts/identity-access/application/AuthService');
const { nowIso, toMs } = require('../../../shared/time');
const {
  parseCookies,
  safeJson,
  pickInstanceRole,
  buildDefaultJobPolicy,
  buildDefaultApprovalPolicy,
  newId,
  normalizeMatrixUserId,
  normalizeTagList,
  normalizeSharedAgent,
  maskSecret
} = require('./adminCompatUtils');
const { registerAdminCompatInstanceRoutes } = require('./adminCompatInstances');
const { registerAdminCompatAssetRoutes } = require('./adminCompatAssets');
const { registerAdminCompatAIGatewayRoutes } = require('./adminCompatAIGateway');
const { registerAdminCompatRuntimeRoutes } = require('./adminCompatRuntime');
const { registerAdminCompatNotificationRoutes } = require('./adminCompatNotifications');
const { registerAdminCompatEmployeeRoutes } = require('./adminCompatEmployees');
const { registerAdminCompatSkillRoutes } = require('./adminCompatSkills');
const { registerAdminCompatLogRoutes } = require('./adminCompatLogs');
const { registerAdminCompatToolRoutes } = require('./adminCompatTools');
const { registerAdminCompatKnowledgeRoutes } = require('./adminCompatKnowledge');
const { registerAdminCompatAuthMgmtRoutes } = require('./adminCompatAuthMgmt');
const { registerAdminCompatSharedAgentRoutes } = require('./adminCompatSharedAgentRoutes');

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
  const sharedAgentStore = new Map();
  const sharedAgentRuntimeEventIds = new Set();
  const sharedAgentRuntimeEventIdLimit = 5000;
  let sharedAgentHydrated = false;
  let sharedAgentHydrating = null;
  const matrixRoomOverrideByInstance = new Map();
  const providerKeyByName = new Map(
    (Array.isArray(context.config.providers) ? context.config.providers : [])
      .map((x) => [String((x && x.name) || '').toLowerCase(), String((x && x.key) || '')])
      .filter(([name]) => Boolean(name))
  );
  const openclawConfigState = {
    runtime: {
      openclawImage: String(context.config.openclawImage || ''),
      openclawRuntimeVersion: String(context.config.openclawRuntimeVersion || ''),
      openclawSourcePath: String(context.config.openclawSourcePath || '')
    },
    providers: {
      deepseek: {
        enabled: providerKeyByName.has('deepseek'),
        apiBase: String(context.config.deepseekApiBase || ''),
        model: String(context.config.deepseekModel || ''),
        apiKey: providerKeyByName.get('deepseek') || ''
      },
      minimax: {
        enabled: providerKeyByName.has('minimax'),
        apiBase: String(context.config.minimaxApiBase || ''),
        model: String(context.config.minimaxModel || ''),
        apiKey: providerKeyByName.get('minimax') || ''
      }
    },
    permissionTemplate: safeJson(context.config.openclawPermissionTemplate, null) || {
      commandAllowlist: ['/help', '/status', '/report'],
      approvalByRisk: buildDefaultApprovalPolicy().byRisk
    },
    updatedAt: nowIso(),
    updatedBy: 'system',
    retention: { auditLogTtlDays: 90, auditLogMaxRows: 100000, archiveEnabled: true, archiveRingSize: 3 }
  };
  const configSnapshots = [];
  const MAX_SNAPSHOTS = 30;
  let openclawConfigHydrated = false;
  let openclawConfigHydrating = null;

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
  // ── Navigation ──
  function buildNavItems() {
    return [
      { path: '/admin/openclaw-statistics.html', label: '数据统计', permission: 'admin.runtime.page.openclaw-config.read' },
      { path: '/admin/openclaw-monitor.html', label: '平台运营', permission: 'admin.runtime.page.openclaw-config.read' },
      { path: '/admin/employees.html', label: '员工管理', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/shared-agents.html', label: '共享Agent', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/skills.html', label: '技能管理', permission: 'admin.skills.page.management.read' },
      { path: '/admin/tools.html', label: '工具管理', permission: 'admin.tools.page.assets.read' },
      { path: '/admin/ai-gateway.html', label: 'AI Gateway', permission: 'admin.ai-gateway.page.read' },
      { path: '/admin/notifications.html', label: '通知中心', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/logs-service.html', label: '行为日志', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/auth-members.html', label: '成员管理', permission: 'admin.auth.page.members.read' }
    ];
  }
  // ── OpenClaw config helpers ──
  function buildOpenclawConfigView() {
    const providers = openclawConfigState.providers || {};
    const deepseek = providers.deepseek || {};
    const minimax = providers.minimax || {};
    return {
      runtime: safeJson(openclawConfigState.runtime, {}),
      providers: {
        deepseek: {
          enabled: Boolean(deepseek.enabled),
          apiBase: String(deepseek.apiBase || ''),
          model: String(deepseek.model || ''),
          hasKey: Boolean(String(deepseek.apiKey || '').trim()),
          apiKeyMasked: maskSecret(deepseek.apiKey)
        },
        minimax: {
          enabled: Boolean(minimax.enabled),
          apiBase: String(minimax.apiBase || ''),
          model: String(minimax.model || ''),
          hasKey: Boolean(String(minimax.apiKey || '').trim()),
          apiKeyMasked: maskSecret(minimax.apiKey)
        }
      },
      permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {}),
      retention: safeJson(openclawConfigState.retention, {}),
      updatedAt: openclawConfigState.updatedAt,
      updatedBy: openclawConfigState.updatedBy
    };
  }

  function syncContextWithOpenclawConfig() {
    const runtime = openclawConfigState.runtime || {};
    const providers = openclawConfigState.providers || {};
    const deepseek = providers.deepseek || {};
    const minimax = providers.minimax || {};
    context.config.openclawImage = String(runtime.openclawImage || '');
    context.config.openclawRuntimeVersion = String(runtime.openclawRuntimeVersion || '');
    context.config.openclawSourcePath = String(runtime.openclawSourcePath || '');
    context.config.deepseekApiBase = String(deepseek.apiBase || '');
    context.config.deepseekModel = String(deepseek.model || '');
    context.config.minimaxApiBase = String(minimax.apiBase || '');
    context.config.minimaxModel = String(minimax.model || '');
    context.config.openclawPermissionTemplate = safeJson(openclawConfigState.permissionTemplate, {
      commandAllowlist: ['/help', '/status', '/report'],
      approvalByRisk: buildDefaultApprovalPolicy().byRisk
    });
    const providerRows = [];
    if (deepseek.enabled && String(deepseek.apiKey || '').trim()) {
      providerRows.push({ name: 'deepseek', key: String(deepseek.apiKey || '').trim() });
    }
    if (minimax.enabled && String(minimax.apiKey || '').trim()) {
      providerRows.push({ name: 'minimax', key: String(minimax.apiKey || '').trim() });
    }
    context.config.providers = providerRows;
  }

  function applyPersistedOpenclawConfig(input) {
    if (!input || typeof input !== 'object') return;
    const runtime = input.runtime && typeof input.runtime === 'object' ? input.runtime : {};
    const providers = input.providers && typeof input.providers === 'object' ? input.providers : {};
    const deepseek = providers.deepseek && typeof providers.deepseek === 'object' ? providers.deepseek : {};
    const minimax = providers.minimax && typeof providers.minimax === 'object' ? providers.minimax : {};
    const permissionTemplate = input.permissionTemplate && typeof input.permissionTemplate === 'object'
      ? input.permissionTemplate
      : null;

    openclawConfigState.runtime.openclawImage = String(runtime.openclawImage || openclawConfigState.runtime.openclawImage || '').trim();
    openclawConfigState.runtime.openclawRuntimeVersion = String(runtime.openclawRuntimeVersion || openclawConfigState.runtime.openclawRuntimeVersion || '').trim();
    openclawConfigState.runtime.openclawSourcePath = String(runtime.openclawSourcePath || openclawConfigState.runtime.openclawSourcePath || '').trim();

    if (deepseek && Object.keys(deepseek).length) {
      openclawConfigState.providers.deepseek.enabled = Boolean(deepseek.enabled);
      openclawConfigState.providers.deepseek.apiBase = String(deepseek.apiBase || openclawConfigState.providers.deepseek.apiBase || '').trim();
      openclawConfigState.providers.deepseek.model = String(deepseek.model || openclawConfigState.providers.deepseek.model || '').trim();
      if (String(deepseek.apiKey || '').trim()) {
        openclawConfigState.providers.deepseek.apiKey = String(deepseek.apiKey || '').trim();
      }
    }
    if (minimax && Object.keys(minimax).length) {
      openclawConfigState.providers.minimax.enabled = Boolean(minimax.enabled);
      openclawConfigState.providers.minimax.apiBase = String(minimax.apiBase || openclawConfigState.providers.minimax.apiBase || '').trim();
      openclawConfigState.providers.minimax.model = String(minimax.model || openclawConfigState.providers.minimax.model || '').trim();
      if (String(minimax.apiKey || '').trim()) {
        openclawConfigState.providers.minimax.apiKey = String(minimax.apiKey || '').trim();
      }
    }

    if (permissionTemplate) {
      openclawConfigState.permissionTemplate = safeJson(permissionTemplate, openclawConfigState.permissionTemplate);
    }
    const retention = input.retention && typeof input.retention === 'object' ? input.retention : null;
    if (retention) {
      const prev = openclawConfigState.retention || {};
      const ttl = Number(retention.auditLogTtlDays), maxRows = Number(retention.auditLogMaxRows), ringSize = Number(retention.archiveRingSize);
      openclawConfigState.retention = {
        auditLogTtlDays: Number.isFinite(ttl) && ttl > 0 ? Math.round(ttl) : (prev.auditLogTtlDays || 90),
        auditLogMaxRows: Number.isFinite(maxRows) && maxRows > 0 ? Math.round(maxRows) : (prev.auditLogMaxRows || 100000),
        archiveEnabled: retention.archiveEnabled !== false,
        archiveRingSize: Number.isFinite(ringSize) && ringSize > 0 ? Math.round(ringSize) : (prev.archiveRingSize || 3)
      };
    }
    openclawConfigState.updatedAt = String(input.updatedAt || openclawConfigState.updatedAt || nowIso());
    openclawConfigState.updatedBy = String(input.updatedBy || openclawConfigState.updatedBy || 'system');
    syncContextWithOpenclawConfig();
  }

  async function ensureOpenclawConfigHydrated() {
    if (openclawConfigHydrated) return;
    if (openclawConfigHydrating) {
      await openclawConfigHydrating;
      return;
    }
    openclawConfigHydrating = (async () => {
      if (context.repo && typeof context.repo.getPlatformConfig === 'function') {
        const persisted = await context.repo.getPlatformConfig('openclawConfig');
        applyPersistedOpenclawConfig(persisted);
      }
      openclawConfigHydrated = true;
      openclawConfigHydrating = null;
    })().catch((error) => {
      openclawConfigHydrating = null;
      throw error;
    });
    await openclawConfigHydrating;
  }
  // ── Session helpers ──
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
  // ── Data helpers ──
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

  async function ensureSharedAgentsHydrated() {
    if (sharedAgentHydrated) return;
    if (sharedAgentHydrating) {
      await sharedAgentHydrating;
      return;
    }
    sharedAgentHydrating = (async () => {
      if (context.repo && typeof context.repo.getPlatformConfig === 'function') {
        const persisted = await context.repo.getPlatformConfig('sharedAgentHall');
        const rows = Array.isArray(persisted && persisted.agents) ? persisted.agents : [];
        rows.forEach((row) => {
          const normalized = normalizeSharedAgent(row);
          if (!normalized.name) return;
          sharedAgentStore.set(normalized.id, normalized);
        });
        const processed = Array.isArray(persisted && persisted.runtime && persisted.runtime.processedAuditEventIds)
          ? persisted.runtime.processedAuditEventIds
          : [];
        processed.forEach((id) => {
          const eventId = String(id || '').trim();
          if (!eventId) return;
          sharedAgentRuntimeEventIds.add(eventId);
        });
      }
      sharedAgentHydrated = true;
      sharedAgentHydrating = null;
    })().catch((error) => {
      sharedAgentHydrating = null;
      throw error;
    });
    await sharedAgentHydrating;
  }

  async function persistSharedAgents(actor = 'system') {
    if (!context.repo || typeof context.repo.setPlatformConfig !== 'function') return;
    await context.repo.setPlatformConfig('sharedAgentHall', {
      agents: Array.from(sharedAgentStore.values()),
      runtime: {
        processedAuditEventIds: Array.from(sharedAgentRuntimeEventIds).slice(-sharedAgentRuntimeEventIdLimit)
      },
      updatedAt: nowIso(),
      updatedBy: actor
    });
  }

  function parseRuntimeSharedAgentEvent(event) {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
    const candidate = payload.agent && typeof payload.agent === 'object' ? payload.agent : payload;
    const name = String(candidate.name || payload.name || '').trim();
    const capabilitySignatureRaw = String(candidate.capabilitySignature || payload.capabilitySignature || '').trim();
    const tags = normalizeTagList(
      Array.isArray(candidate.tags) ? candidate.tags : (Array.isArray(payload.tags) ? payload.tags : [])
    );
    const jobCodes = normalizeTagList(
      Array.isArray(candidate.jobCodes) ? candidate.jobCodes : (Array.isArray(payload.jobCodes) ? payload.jobCodes : [])
    );
    const capabilitySignature = capabilitySignatureRaw || `${name || 'runtime-agent'}:${jobCodes.join(',') || 'general'}`;
    if (!name && !capabilitySignatureRaw) return null;
    return {
      id: String(candidate.id || payload.agentId || '').trim() || undefined,
      name: name || String(candidate.label || payload.label || '子数字员工').trim(),
      capabilitySignature,
      ownerEmployeeId: String(payload.ownerEmployeeId || payload.instanceId || payload.employeeId || payload.sourceInstanceId || '').trim() || null,
      ownerType: 'employee',
      source: 'runtime/openclaw',
      spawnedBy: String(payload.spawnedBy || payload.sender || payload.actor || '').trim() || null,
      status: 'active',
      tags,
      jobCodes,
      description: String(candidate.description || payload.description || '').trim()
    };
  }

  function upsertSharedAgentBySignature(input = {}) {
    const normalizedInput = normalizeSharedAgent(input);
    if (!normalizedInput.name || !normalizedInput.capabilitySignature) return { changed: false, row: null };
    const signature = String(normalizedInput.capabilitySignature || '').toLowerCase();
    const existed = Array.from(sharedAgentStore.values()).find((x) => (
      String(x.capabilitySignature || '').toLowerCase() === signature
      && String(x.status || '').toLowerCase() !== 'deleted'
    ));
    if (existed) {
      const next = normalizeSharedAgent({
        ...existed,
        name: existed.name || normalizedInput.name,
        ownerEmployeeId: normalizedInput.ownerEmployeeId || existed.ownerEmployeeId || null,
        ownerType: normalizedInput.ownerType || existed.ownerType || 'employee',
        source: 'runtime/openclaw',
        spawnedBy: normalizedInput.spawnedBy || existed.spawnedBy || null,
        tags: normalizeTagList([...(Array.isArray(existed.tags) ? existed.tags : []), ...(Array.isArray(normalizedInput.tags) ? normalizedInput.tags : [])]),
        jobCodes: normalizeTagList([...(Array.isArray(existed.jobCodes) ? existed.jobCodes : []), ...(Array.isArray(normalizedInput.jobCodes) ? normalizedInput.jobCodes : [])]),
        description: normalizedInput.description || existed.description || '',
        usageCount: Math.max(0, Number(existed.usageCount || 0)) + 1,
        status: 'active'
      }, existed);
      sharedAgentStore.set(existed.id, next);
      return { changed: true, row: next, created: false };
    }
    const created = normalizeSharedAgent({
      ...normalizedInput,
      source: 'runtime/openclaw',
      ownerType: normalizedInput.ownerType || 'employee',
      usageCount: 1,
      status: 'active'
    });
    sharedAgentStore.set(created.id, created);
    return { changed: true, row: created, created: true };
  }

  async function reconcileSharedAgentsFromRuntimeEvents() {
    if (!context.auditService || typeof context.auditService.list !== 'function') return;
    const events = await context.auditService.list(1000);
    const ordered = Array.isArray(events) ? events.slice().reverse() : [];
    let changed = false;
    for (const event of ordered) {
      const type = String(event && event.type || '').trim();
      const eventId = String(event && event.id || '').trim();
      if (!eventId || sharedAgentRuntimeEventIds.has(eventId)) continue;
      if (type !== 'runtime.openclaw.shared_agent.discovered') continue;
      const parsed = parseRuntimeSharedAgentEvent(event);
      if (!parsed) {
        sharedAgentRuntimeEventIds.add(eventId);
        continue;
      }
      const result = upsertSharedAgentBySignature(parsed);
      if (result.changed) changed = true;
      sharedAgentRuntimeEventIds.add(eventId);
      while (sharedAgentRuntimeEventIds.size > sharedAgentRuntimeEventIdLimit) {
        const first = sharedAgentRuntimeEventIds.values().next().value;
        if (!first) break;
        sharedAgentRuntimeEventIds.delete(first);
      }
    }
    if (changed) {
      await persistSharedAgents('runtime/openclaw');
      await context.auditService.log('runtime.openclaw.shared_agent.synced', {
        changed: true,
        total: sharedAgentStore.size
      });
    }
  }

  async function listSharedAgents() {
    await ensureSharedAgentsHydrated();
    await reconcileSharedAgentsFromRuntimeEvents();
    return Array.from(sharedAgentStore.values()).sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
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
  // ── Employee helpers ──
  function employeeFromInstance(instance) {
    const profile = employeeProfileOverrides.get(instance.id) || {};
    const linked = employeeSkillLinks.get(instance.id) || [];
    const policy = employeePolicyOverrides.get(instance.id) || buildDefaultJobPolicy(instance);
    const approvalPolicy = employeeApprovalOverrides.get(instance.id) || buildDefaultApprovalPolicy();
    const department = String(profile.department || instance.department || 'operations');
    const role = String(profile.role || instance.jobCode || pickInstanceRole(instance.name));
    const resolvedMatrixRoomId = matrixRoomOverrideByInstance.has(instance.id)
      ? matrixRoomOverrideByInstance.get(instance.id)
      : instance.matrixRoomId;
    const ownedSharedAgents = Array.from(sharedAgentStore.values())
      .filter((x) => String(x.ownerEmployeeId || '') === String(instance.id || ''))
      .map((x) => ({
        id: x.id,
        name: x.name,
        status: x.status,
        shared: true,
        capabilitySignature: x.capabilitySignature,
        usageCount: x.usageCount,
        tags: x.tags
      }));
    const childAgents = [
      ...(Array.isArray(profile.childAgents) ? profile.childAgents : []),
      ...ownedSharedAgents
    ];
    return {
      id: instance.id,
      name: String(profile.name || instance.name || instance.id),
      displayName: String(profile.displayName || profile.name || instance.name || instance.id),
      department,
      role,
      employeeId: String(instance.employeeId || ''),
      employeeNo: String(instance.employeeNo || ''),
      email: String(instance.email || ''),
      jobCode: String(instance.jobCode || ''),
      jobTitle: String(instance.jobTitle || ''),
      permissionTemplateId: String(instance.permissionTemplateId || ''),
      status: String(instance.state || 'unknown'),
      tenantId: String(instance.tenantId || ''),
      creator: String(instance.creator || ''),
      enterpriseUserId: String(instance.enterpriseUserId || ''),
      matrixRoomId: resolvedMatrixRoomId || null,
      runtimeEndpoint: instance.runtime && instance.runtime.endpoint ? instance.runtime.endpoint : null,
      capabilities: Array.isArray(profile.capabilities) ? profile.capabilities : [],
      knowledge: Array.isArray(profile.knowledge) ? profile.knowledge : [],
      linkedSkillIds: Array.isArray(linked) ? linked : [],
      childAgents,
      runtimeProfile: {
        agentId: String(profile.agentId || 'main'),
        policyId: String(profile.policyId || 'default'),
        toolScope: Array.isArray(profile.toolScope) ? profile.toolScope : ['matrix', 'runtime_proxy'],
        systemPrompt: String(profile.systemPrompt || ''),
        extraSystemPrompt: String(profile.extraSystemPrompt || '')
      },
      checks: {
        matrix: (
          instance.runtime && instance.runtime.matrixChannelCheck && typeof instance.runtime.matrixChannelCheck === 'object'
            ? safeJson(instance.runtime.matrixChannelCheck, {})
            : {}
        )
      },
      jobPolicy: safeJson(policy, buildDefaultJobPolicy(instance)),
      approvalPolicy: safeJson(approvalPolicy, buildDefaultApprovalPolicy()),
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    };
  }

  async function listEmployees() {
    await ensureSharedAgentsHydrated();
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

  async function getIdentityMappingByMatrixUserId(matrixUserId) {
    if (!context.repo || typeof context.repo.getPlatformConfig !== 'function') return null;
    const key = normalizeMatrixUserId(matrixUserId);
    if (!key) return null;
    const directory = await context.repo.getPlatformConfig('identityDirectory');
    const records = directory && typeof directory.records === 'object' ? directory.records : {};
    const row = records[key];
    if (!row || typeof row !== 'object') return null;
    return row;
  }
  // ── Auth helpers ──
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

  function resolveSessionPermissions(session) {
    const user = session && session.user ? session.user : {};
    const role = String(user.role || '').trim();
    const roleModel = role ? roleStore.get(role) : null;
    if (roleModel && Array.isArray(roleModel.permissions)) {
      return roleModel.permissions;
    }
    return Array.isArray(user.permissions) ? user.permissions : [];
  }

  function hasAdminConsoleAccess(permissions) {
    const list = Array.isArray(permissions) ? permissions : [];
    if (list.includes('*')) return true;
    return list.some((perm) => {
      const val = String(perm || '').trim().toLowerCase();
      return val.startsWith('admin.') || val.startsWith('control:');
    });
  }
  // ── Auth routes ──
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

  router.get('/api/auth/matrix-admin-entry', async (req, res) => {
    const existingSession = buildSession(req);
    if (existingSession) {
      const permissions = resolveSessionPermissions(existingSession);
      res.json({
        showAdminEntry: hasAdminConsoleAccess(permissions),
        adminUrl: '/admin/openclaw-statistics.html'
      });
      return;
    }

    const matrixUserId = normalizeMatrixUserId((req.query && req.query.matrixUserId) || '');
    if (!matrixUserId) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/openclaw-statistics.html' });
      return;
    }

    let username = '';
    if (context.repo && typeof context.repo.getPlatformConfig === 'function') {
      const directory = await context.repo.getPlatformConfig('identityDirectory');
      const records = directory && typeof directory.records === 'object' ? directory.records : {};
      const profile = records[matrixUserId] && typeof records[matrixUserId] === 'object' ? records[matrixUserId] : null;
      if (profile) {
        username = String(profile.username || profile.enterpriseUserId || profile.employeeId || '').trim();
      }
    }
    if (!username) {
      const mx = String(matrixUserId || '');
      if (mx.startsWith('@') && mx.includes(':')) {
        username = mx.slice(1, mx.indexOf(':')).trim();
      }
    }
    if (!username) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/openclaw-statistics.html' });
      return;
    }

    const row = userStore.get(username);
    if (!row || row.disabled) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/openclaw-statistics.html' });
      return;
    }

    const role = String(row.role || '').trim();
    const roleModel = roleStore.get(role);
    const permissions = roleModel && Array.isArray(roleModel.permissions)
      ? roleModel.permissions
      : (Array.isArray(row.permissions) ? row.permissions : []);
    res.json({
      showAdminEntry: hasAdminConsoleAccess(permissions),
      adminUrl: '/admin/openclaw-statistics.html'
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
    const enabled = Boolean(context.config.ssoEnabled);
    const provider = String(context.config.ssoProvider || 'oidc');
    const bridgeLoginEnabled = enabled && Boolean(context.config.ssoBridgeLoginEnabled !== false);
    const authorizeConfigured = enabled && Boolean(String(context.config.ssoAuthorizeUrl || '').trim());
    res.json({ enabled, provider, bridgeLoginEnabled, authorizeConfigured });
  });

  router.get('/api/auth/sso/authorize', (req, res) => {
    if (!context.config.ssoEnabled || !String(context.config.ssoAuthorizeUrl || '').trim()) {
      res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
      return;
    }
    const authorizeUrl = new URL(String(context.config.ssoAuthorizeUrl));
    const state = String((req.query && req.query.state) || '');
    const next = String((req.query && req.query.next) || '');
    if (state) authorizeUrl.searchParams.set('state', state);
    if (next) authorizeUrl.searchParams.set('next', next);
    if (String(context.config.ssoCallbackUrl || '').trim()) {
      authorizeUrl.searchParams.set('redirect_uri', String(context.config.ssoCallbackUrl));
    }
    res.json({ authorizeUrl: authorizeUrl.toString() });
  });

  router.post('/api/auth/sso/bridge-login', async (req, res) => {
    if (!context.config.ssoEnabled || context.config.ssoBridgeLoginEnabled === false) {
      res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
      return;
    }
    const profile = req.body && typeof req.body === 'object' ? req.body : {};
    const mapping = context.config.ssoProfileMapping || {};
    const username = String(
      profile.username
      || profile[mapping.username]
      || profile.sub
      || ''
    ).trim();
    if (!username) {
      res.status(400).json({ error: 'SSO_USERNAME_REQUIRED' });
      return;
    }
    const displayName = String(profile.displayName || profile[mapping.displayName] || username).trim();
    const role = String(profile.role || profile[mapping.role] || 'ops_admin').trim();
    const email = String(profile.email || profile[mapping.email] || '').trim();
    const matrixUserId = normalizeMatrixUserId(
      profile.matrixUserId
      || profile.matrix_user_id
      || profile.mxid
      || ''
    );
    const jobCode = String(profile.jobCode || profile.job_code || profile.job || '').trim();
    const jobTitle = String(profile.jobTitle || profile.job_title || '').trim();
    const department = String(profile.department || profile.dept || '').trim();
    const employeeNo = String(profile.employeeNo || profile.employee_no || '').trim();
    const employeeId = String(profile.employeeId || profile.employee_id || '').trim();
    const enterpriseUserId = String(profile.enterpriseUserId || profile.enterprise_user_id || username).trim();
    const permissions = Array.isArray(ROLE_PERMISSIONS[role]) ? Array.from(new Set(ROLE_PERMISSIONS[role])) : ['control:instance:read'];

    if (matrixUserId && context.repo && typeof context.repo.getPlatformConfig === 'function' && typeof context.repo.setPlatformConfig === 'function') {
      const directory = await context.repo.getPlatformConfig('identityDirectory');
      const records = directory && typeof directory.records === 'object' ? { ...directory.records } : {};
      records[matrixUserId] = {
        username,
        email,
        role,
        matrixUserId,
        enterpriseUserId,
        employeeId: employeeId || '',
        employeeNo: employeeNo || '',
        jobCode: jobCode || '',
        jobTitle: jobTitle || '',
        department: department || '',
        updatedAt: nowIso()
      };
      await context.repo.setPlatformConfig('identityDirectory', {
        records,
        updatedAt: nowIso(),
        updatedBy: username
      });
    }

    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, {
      token: `sso:${sid}`,
      user: { username, displayName, role, permissions },
      expiresAt: Date.now() + (sessionTtlSec * 1000)
    });
    setSessionCookie(res, sid, sessionTtlSec);
    await context.auditService.log('auth.sso.bridge_login.succeeded', {
      username,
      role,
      provider: String(context.config.ssoProvider || 'oidc'),
      matrixUserId: matrixUserId || null
    });
    res.json({
      authenticated: true,
      user: { username, displayName, role, permissions },
      expiresInSec: sessionTtlSec
    });
  });
  // ── Public routes ──
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
  // ── Admin middleware ──
  router.use('/api/admin', requireSession);
  router.use('/api/admin', (req, res, next) => {
    const path = String(req.path || '');
    const allowed = /^\/(overview|instances|employees|agents|matrix|skills|assets|runtime|notifications|logs|tools|auth|ai-gateway|tasks|oss-(findings|cases)|push-channels|bootstrap-status)(\/|$)/.test(path);
    if (!allowed) {
      res.status(404).json({ error: 'endpoint disabled in pure admin mode' });
      return;
    }
    next();
  });
  // ── Register sub-module routes ──
  registerAdminCompatRuntimeRoutes(router, context, {
    listInstances,
    listSharedAssets,
    listSharedAgents,
    openclawConfigState,
    configSnapshots,
    MAX_SNAPSHOTS,
    ensureOpenclawConfigHydrated,
    buildOpenclawConfigView,
    syncContextWithOpenclawConfig,
    applyPersistedOpenclawConfig,
    userStore,
    roleStore
  });

  registerAdminCompatInstanceRoutes(router, context, { listEmployees, filterInstanceRows, getEmployeeById });
  registerAdminCompatAssetRoutes(router, context, {
    listSharedAssets,
    listAssetReportsByType,
    toolServiceStore,
    hydrateToolServices,
    ossCaseState
  });

  registerAdminCompatAIGatewayRoutes(router, context, { requireSession });

  registerAdminCompatNotificationRoutes(router, context, {
    listInstances,
    matrixRoomOverrideByInstance
  });

  registerAdminCompatEmployeeRoutes(router, context, {
    listEmployees,
    getEmployeeById,
    filterInstanceRows,
    employeeProfileOverrides,
    employeePolicyOverrides,
    employeeApprovalOverrides,
    getIdentityMappingByMatrixUserId
  });

  registerAdminCompatSkillRoutes(router, context, {
    listSharedAssets,
    listEmployees,
    deletedSkillIds,
    employeeSkillLinks,
    skillPolicyState
  });

  registerAdminCompatLogRoutes(router, context, { listInstances });

  registerAdminCompatToolRoutes(router, context, {
    toolServiceStore,
    hydrateToolServices,
    normalizeToolRow
  });

  registerAdminCompatKnowledgeRoutes(router, context, {
    listSharedAssets,
    listAssetReportsByType,
    ossCaseState
  });

  registerAdminCompatAuthMgmtRoutes(router, context, {
    userStore,
    roleStore,
    rolePayload,
    userPayload
  });

  registerAdminCompatSharedAgentRoutes(router, context, {
    listSharedAgents,
    ensureSharedAgentsHydrated,
    parseRuntimeSharedAgentEvent,
    upsertSharedAgentBySignature,
    persistSharedAgents
  });
  // ── Fallback ──
  router.use('/api/admin', (req, res) => {
    const compatPath = String(req.path || '').trim();
    if (compatPath === '/auth/identity-mappings' || compatPath.startsWith('/auth/identity-mappings/')) {
      res.status(410).json({
        error: 'manual identity mapping maintenance is disabled',
        reason: 'sso_managed_identity_only'
      });
      return;
    }
    res.json(Array.isArray(req.body) ? [] : { success: true, path: req.path, method: req.method, note: 'compat noop' });
  });

  return router;
}

module.exports = { buildAdminCompatRouter };
