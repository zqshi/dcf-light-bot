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

function normalizeMatrixUserId(input) {
  return String(input || '').trim().toLowerCase();
}

function normalizeTagList(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 30)
  ));
}

function normalizeSharedAgent(input = {}, seed = {}) {
  const now = nowIso();
  const merged = { ...seed, ...input };
  const source = String(merged.source || seed.source || 'runtime/openclaw').trim();
  const ownerEmployeeId = String(merged.ownerEmployeeId || seed.ownerEmployeeId || '').trim() || null;
  return {
    id: String(seed.id || input.id || newId('shared_agent')),
    name: String(merged.name || '').trim(),
    capabilitySignature: String(merged.capabilitySignature || '').trim(),
    ownerEmployeeId,
    ownerType: String(merged.ownerType || 'shared').trim(),
    source,
    spawnedBy: String(merged.spawnedBy || seed.spawnedBy || '').trim() || null,
    status: String(merged.status || 'active').trim(),
    tags: normalizeTagList(merged.tags),
    jobCodes: normalizeTagList(merged.jobCodes),
    description: String(merged.description || '').trim(),
    usageCount: Math.max(0, Number(merged.usageCount || 0)),
    createdAt: String(seed.createdAt || merged.createdAt || now),
    updatedAt: now
  };
}

function toMs(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function maskSecret(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function summarizeInstanceStates(instances = []) {
  const rows = Array.isArray(instances) ? instances : [];
  const byState = {};
  let running = 0;
  let abnormal = 0;
  let matrixBound = 0;
  for (const row of rows) {
    const state = String((row && row.state) || 'unknown').toLowerCase();
    byState[state] = (byState[state] || 0) + 1;
    if (state === 'running' || state === 'active') running += 1;
    if (['failed', 'error', 'degraded', 'unknown'].includes(state)) abnormal += 1;
    if (row && row.matrixRoomId) matrixBound += 1;
  }
  return {
    total: rows.length,
    running,
    abnormal,
    matrixBound,
    byState
  };
}

function summarizeAuditWindow(audits = [], sinceMs = 0) {
  const rows = Array.isArray(audits) ? audits : [];
  let total = 0;
  let admin = 0;
  let instance = 0;
  let asset = 0;
  let latestAt = '';
  for (const row of rows) {
    const atMs = toMs(row && row.at);
    if (sinceMs > 0 && atMs < sinceMs) continue;
    total += 1;
    const type = String((row && row.type) || '');
    if (atMs > toMs(latestAt)) latestAt = String((row && row.at) || latestAt);
    if (type.startsWith('admin.') || type.startsWith('auth.') || type.startsWith('audit.')) admin += 1;
    if (type.startsWith('instance.') || type.startsWith('admin.instance.')) instance += 1;
    if (type.startsWith('skill.') || type.startsWith('admin.asset.') || type.startsWith('admin.tools.')) asset += 1;
  }
  return {
    total,
    admin,
    instance,
    asset,
    latestAt
  };
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
    updatedBy: 'system'
  };
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

  function buildNavItems() {
    return [
      { path: '/admin/index.html', label: '总览', permission: 'admin.runtime.page.platform-overview.read' },
      { path: '/admin/employees.html', label: '员工管理', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/shared-agents.html', label: '共享Agent', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/openclaw-config.html', label: 'OpenClaw 配置', permission: 'admin.runtime.page.openclaw-config.read' },
      { path: '/admin/skills.html', label: '技能管理', permission: 'admin.skills.page.management.read' },
      { path: '/admin/tools.html', label: '工具管理', permission: 'admin.tools.page.assets.read' },
      { path: '/admin/notifications.html', label: '通知中心', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/logs.html', label: '行为日志', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/auth-members.html', label: '成员管理', permission: 'admin.auth.page.members.read' }
    ];
  }

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

  function actorOf(req) {
    return (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
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
        adminUrl: '/admin/index.html'
      });
      return;
    }

    const matrixUserId = normalizeMatrixUserId((req.query && req.query.matrixUserId) || '');
    if (!matrixUserId) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
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
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
      return;
    }

    const row = userStore.get(username);
    if (!row || row.disabled) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
      return;
    }

    const role = String(row.role || '').trim();
    const roleModel = roleStore.get(role);
    const permissions = roleModel && Array.isArray(roleModel.permissions)
      ? roleModel.permissions
      : (Array.isArray(row.permissions) ? row.permissions : []);
    res.json({
      showAdminEntry: hasAdminConsoleAccess(permissions),
      adminUrl: '/admin/index.html'
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
  router.use('/api/admin', (req, res, next) => {
    const path = String(req.path || '');
    const allowed = [
      /^\/overview$/,
      /^\/instances(\/|$)/,
      /^\/employees(\/|$)/,
      /^\/agents(\/|$)/,
      /^\/matrix(\/|$)/,
      /^\/skills(\/|$)/,
      /^\/assets(\/|$)/,
      /^\/runtime(\/|$)/,
      /^\/notifications$/,
      /^\/logs$/,
      /^\/tools(\/|$)/,
      /^\/auth(\/|$)/
    ].some((rule) => rule.test(path));
    if (!allowed) {
      res.status(404).json({ error: 'endpoint disabled in pure admin mode' });
      return;
    }
    next();
  });

  router.get('/api/admin/overview', async (_req, res) => {
    const [instances, dashboard, audits, sharedSkills, sharedTools, sharedKnowledge, skillBindings, toolBindings, knowledgeBindings, sharedAgents] = await Promise.all([
      listInstances(),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' }),
      context.auditService.list(1000),
      listSharedAssets('skill'),
      listSharedAssets('tool'),
      listSharedAssets('knowledge'),
      (context.assetService || context.skillService).listAssetBindings('skill'),
      (context.assetService || context.skillService).listAssetBindings('tool'),
      (context.assetService || context.skillService).listAssetBindings('knowledge'),
      listSharedAgents()
    ]);
    const instanceSummary = summarizeInstanceStates(instances);
    const totalTasks = audits.filter((x) => {
      const type = String(x.type || '');
      return type.startsWith('instance.') || type.startsWith('admin.instance.');
    }).length;
    const succeededTasks = audits.filter((x) => {
      const type = String(x.type || '');
      return type === 'instance.provisioned' || type === 'admin.instance.started';
    }).length;
    const failedTasks = audits.filter((x) => String(x.type).includes('failed')).length;
    const inProgressTasks = Math.max(0, totalTasks - succeededTasks - failedTasks);
    const successRate = totalTasks ? Math.round((succeededTasks / totalTasks) * 100) : 100;
    const now = Date.now();
    const window24h = summarizeAuditWindow(audits, now - (24 * 60 * 60 * 1000));
    const tenants = new Set(instances.map((x) => String((x && x.tenantId) || '').trim()).filter(Boolean));
    const bindingsTotal = (Array.isArray(skillBindings) ? skillBindings.length : 0)
      + (Array.isArray(toolBindings) ? toolBindings.length : 0)
      + (Array.isArray(knowledgeBindings) ? knowledgeBindings.length : 0);
    const disabledUsers = Array.from(userStore.values()).filter((x) => x && x.disabled).length;
    const pendingReviews = Number(dashboard.pendingTotal || 0);
    const overdueReviews = Number(dashboard.overdueTotal || 0);
    const healthLevel = instanceSummary.abnormal > 0 || overdueReviews > 0 ? 'degraded' : 'healthy';
    const sharedTotal = sharedSkills.length + sharedTools.length + sharedKnowledge.length + sharedAgents.length;
    res.json({
      overview: {
        platform: {
          instancesTotal: instanceSummary.total,
          runningInstances: instanceSummary.running,
          abnormalInstances: instanceSummary.abnormal,
          tenantsTotal: tenants.size,
          matrixBoundInstances: instanceSummary.matrixBound,
          stateBreakdown: instanceSummary.byState,
          healthLevel
        },
        assets: {
          sharedSkills: sharedSkills.length,
          sharedTools: sharedTools.length,
          sharedKnowledge: sharedKnowledge.length,
          sharedAgents: sharedAgents.length,
          sharedTotal,
          bindingsTotal,
          pendingReviews,
          overdueReviews
        },
        operations: {
          auditEvents24h: window24h.total,
          adminEvents24h: window24h.admin,
          instanceEvents24h: window24h.instance,
          assetEvents24h: window24h.asset,
          latestEventAt: window24h.latestAt || ''
        },
        security: {
          usersTotal: userStore.size,
          disabledUsers,
          rolesTotal: roleStore.size
        }
      },
      delivery: {
        employeesTotal: instanceSummary.total,
        totalTasks,
        succeededTasks,
        failedTasks,
        inProgressTasks,
        successRate
      },
      governance: {
        waitingApprovalTasks: pendingReviews,
        compensationPendingTasks: 0,
        rollbackTasks: 0,
        p1Incidents: 0
      },
      assets: {
        skillsTotal: sharedSkills.length,
        findingsTotal: sharedKnowledge.length,
        toolsTotal: sharedTools.length,
        sharedAgents: sharedAgents.length,
        sharedTotal,
        bindingsTotal,
        skillReused: 0,
        recurrenceErrors: 0
      },
      runtime: {
        runtimeEnabled: true,
        dialogueEnabled: true,
        queueQueued: 0,
        queueDone: 0,
        backlog: 0,
        phase: healthLevel,
        cycleCount: Math.max(1, Math.floor(totalTasks / 10)),
        manualReviewRequired: overdueReviews > 0
      },
      focus: [
        `当前运行实例 ${instanceSummary.running}/${instanceSummary.total}，异常 ${instanceSummary.abnormal}。`,
        `资产待审批 ${pendingReviews} 项，逾期 ${overdueReviews} 项，建议优先清理积压。`,
        `共享资产 ${sharedTotal} 项（含共享Agent ${sharedAgents.length}），已绑定 ${bindingsTotal} 次，建议持续推动高频能力复用。`
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

  router.get('/api/admin/runtime/openclaw-config', async (_req, res) => {
    await ensureOpenclawConfigHydrated();
    res.json(buildOpenclawConfigView());
  });

  router.post('/api/admin/runtime/openclaw-config', async (req, res) => {
    await ensureOpenclawConfigHydrated();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const runtime = body.runtime && typeof body.runtime === 'object' ? body.runtime : {};
    const providers = body.providers && typeof body.providers === 'object' ? body.providers : {};
    const deepseekInput = providers.deepseek && typeof providers.deepseek === 'object' ? providers.deepseek : {};
    const minimaxInput = providers.minimax && typeof providers.minimax === 'object' ? providers.minimax : {};
    const template = body.permissionTemplate && typeof body.permissionTemplate === 'object'
      ? body.permissionTemplate
      : {};

    openclawConfigState.runtime.openclawImage = String(runtime.openclawImage || openclawConfigState.runtime.openclawImage || '').trim();
    openclawConfigState.runtime.openclawRuntimeVersion = String(runtime.openclawRuntimeVersion || openclawConfigState.runtime.openclawRuntimeVersion || '').trim();
    openclawConfigState.runtime.openclawSourcePath = String(runtime.openclawSourcePath || openclawConfigState.runtime.openclawSourcePath || '').trim();

    openclawConfigState.providers.deepseek.enabled = Boolean(deepseekInput.enabled);
    openclawConfigState.providers.deepseek.apiBase = String(deepseekInput.apiBase || openclawConfigState.providers.deepseek.apiBase || '').trim();
    openclawConfigState.providers.deepseek.model = String(deepseekInput.model || openclawConfigState.providers.deepseek.model || '').trim();
    if (String(deepseekInput.apiKey || '').trim()) {
      openclawConfigState.providers.deepseek.apiKey = String(deepseekInput.apiKey || '').trim();
    }

    openclawConfigState.providers.minimax.enabled = Boolean(minimaxInput.enabled);
    openclawConfigState.providers.minimax.apiBase = String(minimaxInput.apiBase || openclawConfigState.providers.minimax.apiBase || '').trim();
    openclawConfigState.providers.minimax.model = String(minimaxInput.model || openclawConfigState.providers.minimax.model || '').trim();
    if (String(minimaxInput.apiKey || '').trim()) {
      openclawConfigState.providers.minimax.apiKey = String(minimaxInput.apiKey || '').trim();
    }

    if (Array.isArray(template.commandAllowlist)) {
      openclawConfigState.permissionTemplate.commandAllowlist = template.commandAllowlist
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 200);
    }
    if (template.approvalByRisk && typeof template.approvalByRisk === 'object') {
      openclawConfigState.permissionTemplate.approvalByRisk = safeJson(
        template.approvalByRisk,
        openclawConfigState.permissionTemplate.approvalByRisk
      );
    }

    openclawConfigState.updatedAt = nowIso();
    openclawConfigState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin');
    syncContextWithOpenclawConfig();
    if (context.repo && typeof context.repo.setPlatformConfig === 'function') {
      await context.repo.setPlatformConfig('openclawConfig', {
        runtime: safeJson(openclawConfigState.runtime, {}),
        providers: {
          deepseek: safeJson(openclawConfigState.providers.deepseek, {}),
          minimax: safeJson(openclawConfigState.providers.minimax, {})
        },
        permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {}),
        updatedAt: openclawConfigState.updatedAt,
        updatedBy: openclawConfigState.updatedBy
      });
    }
    await context.auditService.log('admin.runtime.openclaw_config.updated', {
      actor: openclawConfigState.updatedBy,
      runtime: safeJson(openclawConfigState.runtime, {}),
      providers: {
        deepseek: {
          enabled: openclawConfigState.providers.deepseek.enabled,
          apiBase: openclawConfigState.providers.deepseek.apiBase,
          model: openclawConfigState.providers.deepseek.model,
          hasKey: Boolean(String(openclawConfigState.providers.deepseek.apiKey || '').trim())
        },
        minimax: {
          enabled: openclawConfigState.providers.minimax.enabled,
          apiBase: openclawConfigState.providers.minimax.apiBase,
          model: openclawConfigState.providers.minimax.model,
          hasKey: Boolean(String(openclawConfigState.providers.minimax.apiKey || '').trim())
        }
      }
    });
    res.json(buildOpenclawConfigView());
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

  function resolveAuditRoomId(row) {
    const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
    return String(
      payload.roomId
      || payload.room_id
      || payload.matrixRoomId
      || payload.channelId
      || ''
    ).trim();
  }

  function mergeMatrixRoomSummary(base = {}, patch = {}) {
    return {
      roomId: patch.roomId || base.roomId || '',
      boundInstanceId: patch.boundInstanceId || base.boundInstanceId || '',
      instanceName: patch.instanceName || base.instanceName || '',
      tenantId: patch.tenantId || base.tenantId || '',
      instanceState: patch.instanceState || base.instanceState || 'unknown',
      auditEvents24h: Number(base.auditEvents24h || 0) + Number(patch.auditEvents24h || 0),
      lastEventType: patch.lastEventType || base.lastEventType || '',
      lastEventAt: toMs(patch.lastEventAt) >= toMs(base.lastEventAt) ? (patch.lastEventAt || base.lastEventAt || '') : (base.lastEventAt || '')
    };
  }

  function resolveInstanceRoomId(instance) {
    const id = String((instance && instance.id) || '');
    if (matrixRoomOverrideByInstance.has(id)) {
      return String(matrixRoomOverrideByInstance.get(id) || '').trim();
    }
    return String((instance && instance.matrixRoomId) || '').trim();
  }

  function buildMatrixOpsStatus(audits = []) {
    const rows = Array.isArray(audits) ? audits : [];
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    let relayStartedAt = '';
    let relayStoppedAt = '';
    let botStartedAt = '';
    let botStoppedAt = '';
    let inbound24h = 0;
    let deliverySucceeded24h = 0;
    let deliveryFailed24h = 0;
    let commandSucceeded24h = 0;
    let commandFailed24h = 0;
    for (const row of rows) {
      const type = String((row && row.type) || '');
      const at = String((row && row.at) || '');
      const atMs = toMs(at);
      if (type === 'matrix.relay.started' && atMs >= toMs(relayStartedAt)) relayStartedAt = at;
      if (type === 'matrix.relay.stopped' && atMs >= toMs(relayStoppedAt)) relayStoppedAt = at;
      if (type === 'matrix.bot.started' && atMs >= toMs(botStartedAt)) botStartedAt = at;
      if (type === 'matrix.bot.stopped' && atMs >= toMs(botStoppedAt)) botStoppedAt = at;
      if (atMs < dayAgo) continue;
      if (type === 'matrix.relay.inbound') inbound24h += 1;
      if (type === 'matrix.relay.delivery.succeeded') deliverySucceeded24h += 1;
      if (type === 'matrix.relay.delivery.failed') deliveryFailed24h += 1;
      if (type === 'matrix.command.handled') {
        const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
        const phase = String(payload.phase || '').toLowerCase();
        if (phase === 'succeeded') commandSucceeded24h += 1;
        if (phase === 'failed') commandFailed24h += 1;
      }
    }

    const relayOnline = toMs(relayStartedAt) >= toMs(relayStoppedAt);
    const botOnline = toMs(botStartedAt) >= toMs(botStoppedAt);
    const deliveryTotal24h = deliverySucceeded24h + deliveryFailed24h;
    const deliverySuccessRate24h = deliveryTotal24h
      ? Math.round((deliverySucceeded24h / deliveryTotal24h) * 100)
      : 100;
    return {
      relayOnline,
      botOnline,
      relayStartedAt,
      relayStoppedAt,
      botStartedAt,
      botStoppedAt,
      inbound24h,
      deliverySucceeded24h,
      deliveryFailed24h,
      deliverySuccessRate24h,
      commandSucceeded24h,
      commandFailed24h
    };
  }

  router.get('/api/admin/matrix/channels', async (req, res) => {
    const [instances, audits] = await Promise.all([
      listInstances(),
      context.auditService.list(1000)
    ]);
    const byRoom = new Map();
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    for (const instance of instances) {
      const roomId = resolveInstanceRoomId(instance);
      if (!roomId) continue;
      const current = byRoom.get(roomId) || {};
      byRoom.set(roomId, mergeMatrixRoomSummary(current, {
        roomId,
        boundInstanceId: String(instance.id || ''),
        instanceName: String(instance.name || instance.id || ''),
        tenantId: String(instance.tenantId || ''),
        instanceState: String(instance.state || 'unknown')
      }));
    }

    for (const row of audits) {
      const roomId = resolveAuditRoomId(row);
      if (!roomId) continue;
      const atMs = toMs(row && row.at);
      const in24h = atMs >= dayAgo ? 1 : 0;
      const current = byRoom.get(roomId) || {};
      byRoom.set(roomId, mergeMatrixRoomSummary(current, {
        roomId,
        auditEvents24h: in24h,
        lastEventType: String((row && row.type) || ''),
        lastEventAt: String((row && row.at) || '')
      }));
    }

    let rows = Array.from(byRoom.values()).map((x) => ({
      ...x,
      roomId: String(x.roomId || ''),
      bound: Boolean(x.boundInstanceId),
      boundInstanceId: String(x.boundInstanceId || ''),
      instanceName: String(x.instanceName || ''),
      tenantId: String(x.tenantId || ''),
      instanceState: String(x.instanceState || 'unknown'),
      auditEvents24h: Number(x.auditEvents24h || 0),
      lastEventType: String(x.lastEventType || ''),
      lastEventAt: String(x.lastEventAt || '')
    }));

    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    const queryStatus = String((req.query && req.query.status) || '').trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((x) => [
        x.roomId,
        x.boundInstanceId,
        x.instanceName,
        x.tenantId,
        x.lastEventType
      ].join(' ').toLowerCase().includes(keyword));
    }
    if (queryStatus === 'bound') rows = rows.filter((x) => x.bound);
    if (queryStatus === 'unbound') rows = rows.filter((x) => !x.bound);

    rows.sort((a, b) => toMs(b.lastEventAt) - toMs(a.lastEventAt));

    const summary = {
      channels: rows.length,
      bound: rows.filter((x) => x.bound).length,
      unbound: rows.filter((x) => !x.bound).length,
      auditEvents24h: rows.reduce((sum, row) => sum + Number(row.auditEvents24h || 0), 0)
    };
    const status = buildMatrixOpsStatus(audits);
    res.json({ rows, summary, status });
  });

  router.get('/api/admin/matrix/status', async (_req, res) => {
    const audits = await context.auditService.list(1000);
    res.json(buildMatrixOpsStatus(audits));
  });

  router.get('/api/admin/notifications', async (_req, res) => {
    const [instances, dashboard, audits] = await Promise.all([
      listInstances(),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' }),
      context.auditService.list(1000)
    ]);
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    const failedInstances = instances.filter((x) => {
      const state = String((x && x.state) || '').toLowerCase();
      return ['failed', 'error', 'degraded'].includes(state);
    });
    const deliveryFailed = audits.filter((x) => (
      String(x.type || '') === 'matrix.relay.delivery.failed' && toMs(x.at) >= dayAgo
    ));
    const instanceFailedEvents = audits.filter((x) => (
      String(x.type || '').includes('failed') && toMs(x.at) >= dayAgo
    ));

    const items = [];
    failedInstances.forEach((row) => {
      items.push({
        id: `inst-failed-${row.id}`,
        severity: 'high',
        source: 'instance',
        title: `实例异常：${row.name || row.id}`,
        detail: `实例 ${row.id} 当前状态 ${row.state || 'unknown'}，建议执行重建并查看日志。`,
        action: `POST /api/admin/instances/${row.id}/rebuild`,
        at: row.updatedAt || row.createdAt || ''
      });
    });
    if (Number(dashboard.pendingTotal || 0) > 0) {
      items.push({
        id: 'asset-pending',
        severity: Number(dashboard.overdueTotal || 0) > 0 ? 'high' : 'medium',
        source: 'asset-review',
        title: '资产审批待处理',
        detail: `待审批 ${Number(dashboard.pendingTotal || 0)}，逾期 ${Number(dashboard.overdueTotal || 0)}，升级 ${Number(dashboard.escalatedTotal || 0)}。`,
        action: '进入技能/工具管理执行审批',
        at: nowIso()
      });
    }
    if (deliveryFailed.length > 0) {
      items.push({
        id: 'matrix-delivery-failed',
        severity: 'medium',
        source: 'matrix-delivery',
        title: 'Matrix 消息投递失败',
        detail: `过去24小时投递失败 ${deliveryFailed.length} 次，请检查 relay 与网络连通性。`,
        action: '查看行为日志中 matrix.relay.delivery.failed 事件',
        at: String(deliveryFailed[0].at || '')
      });
    }
    if (instanceFailedEvents.length > 0) {
      items.push({
        id: 'instance-failed-events',
        severity: 'medium',
        source: 'instance-events',
        title: '实例失败事件增多',
        detail: `过去24小时实例失败相关事件 ${instanceFailedEvents.length} 次。`,
        action: '查看行为日志并定位失败根因',
        at: String(instanceFailedEvents[0].at || '')
      });
    }

    items.sort((a, b) => toMs(b.at) - toMs(a.at));
    res.json({
      items,
      summary: {
        total: items.length,
        high: items.filter((x) => x.severity === 'high').length,
        medium: items.filter((x) => x.severity === 'medium').length,
        low: items.filter((x) => x.severity === 'low').length
      }
    });
  });

  router.post('/api/admin/matrix/channels/:roomId/bind-instance', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    await context.auditService.log('admin.matrix.channel.bind_rejected', {
      actor: req.adminSession.user.username,
      roomId,
      reason: 'fixed_session_mapping'
    });
    res.status(410).json({
      error: 'manual room binding is disabled',
      reason: 'fixed_session_mapping',
      message: '会话映射由系统自动维护，已禁用手工绑定。'
    });
  });

  router.post('/api/admin/matrix/channels/:roomId/unbind', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    await context.auditService.log('admin.matrix.channel.unbind_rejected', {
      actor: req.adminSession.user.username,
      roomId,
      reason: 'fixed_session_mapping'
    });
    res.status(410).json({
      error: 'manual room unbind is disabled',
      reason: 'fixed_session_mapping',
      message: '会话映射由系统自动维护，已禁用手工解绑。'
    });
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
    const row = await getEmployeeById(id);
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
    const actor = actorOf(req);
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
