const crypto = require('crypto');
const { nowIso, toMs } = require('../../../shared/time');

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

function actorOf(req) {
  return (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
}

module.exports = {
  parseCookies,
  safeJson,
  pickInstanceRole,
  buildDefaultJobPolicy,
  buildDefaultApprovalPolicy,
  newId,
  normalizeMatrixUserId,
  normalizeTagList,
  normalizeSharedAgent,
  maskSecret,
  summarizeInstanceStates,
  summarizeAuditWindow,
  actorOf,
  nowIso,
  toMs
};
