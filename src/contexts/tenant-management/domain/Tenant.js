const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');

const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived'
};

const TENANT_PLAN = {
  FREE: 'free',
  STANDARD: 'standard',
  ENTERPRISE: 'enterprise'
};

/* ──────────────────────────────────────────────
 * 套餐默认配额
 *
 * 四维度：
 *   容量   — 实例/用户上限、并发控制
 *   实例资源 — 单实例 CPU/内存/存储（K8s 格式，直接用于 Pod spec）
 *   AI 用量 — Token 预算、API 调用、速率
 *   数据策略 — 存储、知识库、保留期、Webhook
 * ────────────────────────────────────────────── */
const DEFAULT_QUOTAS = {
  [TENANT_PLAN.FREE]: {
    maxInstances: 3,
    maxConcurrentInstances: 2,
    maxUsers: 5,
    instanceCpu: '250m',
    instanceMemory: '256Mi',
    instanceStorage: '1Gi',
    maxStorageMB: 1024,
    knowledgeBaseSizeMB: 256,
    tokenBudgetMonthly: 100000,
    tokenBudgetDaily: 5000,
    apiCallsDaily: 1000,
    rateLimitPerMinute: 20,
    dataRetentionDays: 30,
    maxWebhooks: 2
  },
  [TENANT_PLAN.STANDARD]: {
    maxInstances: 10,
    maxConcurrentInstances: 5,
    maxUsers: 50,
    instanceCpu: '500m',
    instanceMemory: '512Mi',
    instanceStorage: '2Gi',
    maxStorageMB: 10240,
    knowledgeBaseSizeMB: 1024,
    tokenBudgetMonthly: 1000000,
    tokenBudgetDaily: 50000,
    apiCallsDaily: 10000,
    rateLimitPerMinute: 60,
    dataRetentionDays: 90,
    maxWebhooks: 10
  },
  [TENANT_PLAN.ENTERPRISE]: {
    maxInstances: 100,
    maxConcurrentInstances: 50,
    maxUsers: 500,
    instanceCpu: '1000m',
    instanceMemory: '1Gi',
    instanceStorage: '5Gi',
    maxStorageMB: 102400,
    knowledgeBaseSizeMB: 10240,
    tokenBudgetMonthly: 10000000,
    tokenBudgetDaily: 500000,
    apiCallsDaily: 100000,
    rateLimitPerMinute: 300,
    dataRetentionDays: 365,
    maxWebhooks: 50
  }
};

const INDUSTRY_VALUES = ['fintech', 'ecommerce', 'healthcare', 'education', 'manufacturing', 'technology', 'other'];
const COMPANY_SIZE_VALUES = ['startup', 'small', 'medium', 'large', 'enterprise'];

const DEFAULT_FEATURES = {
  aiGateway: true,
  knowledgeBase: true,
  matrixIntegration: false,
  customTools: true
};

/* modelAccess 只管"能访问哪些模型"，用量限制归 quotas */
const DEFAULT_MODEL_ACCESS = {
  allowedProviders: []
};

/* ── 合法值集合（CPU/Memory/Storage 下拉选项） ── */
const CPU_OPTIONS = ['250m', '500m', '1000m', '2000m', '4000m'];
const MEMORY_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
const STORAGE_OPTIONS = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];

function validateSlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return { valid: false, reason: 'slug is required' };
  if (s.length < 2 || s.length > 48) return { valid: false, reason: 'slug must be 2-48 chars' };
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)) {
    return { valid: false, reason: 'slug must be lowercase alphanumeric with hyphens, cannot start/end with hyphen' };
  }
  return { valid: true, slug: s };
}

function parseFeatures(input) {
  if (!input || typeof input !== 'object') return { ...DEFAULT_FEATURES };
  return {
    aiGateway: input.aiGateway !== false,
    knowledgeBase: input.knowledgeBase !== false,
    matrixIntegration: input.matrixIntegration === true,
    customTools: input.customTools !== false
  };
}

function parseModelAccess(input) {
  if (!input || typeof input !== 'object') return { ...DEFAULT_MODEL_ACCESS };
  return {
    allowedProviders: Array.isArray(input.allowedProviders)
      ? input.allowedProviders.map((p) => String(p).trim()).filter(Boolean)
      : DEFAULT_MODEL_ACCESS.allowedProviders
  };
}

/**
 * 解析配额，兼容旧数据格式：
 * - 旧格式只有 maxInstances/maxUsers/maxStorageMB
 * - 旧 modelAccess 里的 tokenBudgetMonthly/rateLimitPerMinute 也迁移过来
 */
function parseQuotas(input, plan, legacyModelAccess) {
  const defaults = DEFAULT_QUOTAS[plan] || DEFAULT_QUOTAS[TENANT_PLAN.STANDARD];
  if (!input || typeof input !== 'object') return { ...defaults };

  const lma = legacyModelAccess && typeof legacyModelAccess === 'object' ? legacyModelAccess : {};

  return {
    maxInstances: posInt(input.maxInstances, defaults.maxInstances, 1),
    maxConcurrentInstances: posInt(input.maxConcurrentInstances, defaults.maxConcurrentInstances, 1),
    maxUsers: posInt(input.maxUsers, defaults.maxUsers, 1),
    instanceCpu: CPU_OPTIONS.includes(input.instanceCpu) ? input.instanceCpu : defaults.instanceCpu,
    instanceMemory: MEMORY_OPTIONS.includes(input.instanceMemory) ? input.instanceMemory : defaults.instanceMemory,
    instanceStorage: STORAGE_OPTIONS.includes(input.instanceStorage) ? input.instanceStorage : defaults.instanceStorage,
    maxStorageMB: posInt(input.maxStorageMB, defaults.maxStorageMB, 64),
    knowledgeBaseSizeMB: posInt(input.knowledgeBaseSizeMB, defaults.knowledgeBaseSizeMB, 0),
    tokenBudgetMonthly: posInt(
      input.tokenBudgetMonthly ?? lma.tokenBudgetMonthly,
      defaults.tokenBudgetMonthly, 0
    ),
    tokenBudgetDaily: posInt(input.tokenBudgetDaily, defaults.tokenBudgetDaily, 0),
    apiCallsDaily: posInt(input.apiCallsDaily, defaults.apiCallsDaily, 0),
    rateLimitPerMinute: posInt(
      input.rateLimitPerMinute ?? lma.rateLimitPerMinute,
      defaults.rateLimitPerMinute, 1
    ),
    dataRetentionDays: posInt(input.dataRetentionDays, defaults.dataRetentionDays, 1),
    maxWebhooks: posInt(input.maxWebhooks, defaults.maxWebhooks, 0)
  };
}

function posInt(val, fallback, min) {
  const n = Number(val);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

function createTenant(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('tenant name is required');

  const slugResult = validateSlug(input.slug);
  if (!slugResult.valid) throw new Error(slugResult.reason);

  const plan = Object.values(TENANT_PLAN).includes(input.plan) ? input.plan : TENANT_PLAN.STANDARD;
  const quotas = parseQuotas(input.quotas, plan, input.modelAccess);

  const now = nowIso();
  return {
    id: newId('tn'),
    name,
    slug: slugResult.slug,
    plan,
    quotas,
    status: TENANT_STATUS.ACTIVE,
    contactEmail: String(input.contactEmail || '').trim() || null,
    contactName: String(input.contactName || '').trim() || null,
    contactPhone: String(input.contactPhone || '').trim() || null,
    industry: INDUSTRY_VALUES.includes(input.industry) ? input.industry : 'other',
    companySize: COMPANY_SIZE_VALUES.includes(input.companySize) ? input.companySize : 'small',
    description: String(input.description || '').trim() || null,
    features: parseFeatures(input.features),
    modelAccess: parseModelAccess(input.modelAccess),
    createdAt: now,
    updatedAt: now
  };
}

function updateTenant(tenant, patch) {
  const updated = { ...tenant, updatedAt: nowIso() };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) throw new Error('tenant name cannot be empty');
    updated.name = name;
  }
  if (patch.plan !== undefined) {
    if (!Object.values(TENANT_PLAN).includes(patch.plan)) throw new Error(`invalid plan: ${patch.plan}`);
    updated.plan = patch.plan;
  }
  if (patch.quotas && typeof patch.quotas === 'object') {
    updated.quotas = parseQuotas(
      { ...(updated.quotas || {}), ...patch.quotas },
      updated.plan,
      patch.modelAccess || updated.modelAccess
    );
  }
  if (patch.contactEmail !== undefined) {
    updated.contactEmail = String(patch.contactEmail || '').trim() || null;
  }
  if (patch.contactName !== undefined) {
    updated.contactName = String(patch.contactName || '').trim() || null;
  }
  if (patch.contactPhone !== undefined) {
    updated.contactPhone = String(patch.contactPhone || '').trim() || null;
  }
  if (patch.industry !== undefined && INDUSTRY_VALUES.includes(patch.industry)) {
    updated.industry = patch.industry;
  }
  if (patch.companySize !== undefined && COMPANY_SIZE_VALUES.includes(patch.companySize)) {
    updated.companySize = patch.companySize;
  }
  if (patch.description !== undefined) {
    updated.description = String(patch.description || '').trim() || null;
  }
  if (patch.features !== undefined) {
    updated.features = parseFeatures({ ...(updated.features || DEFAULT_FEATURES), ...patch.features });
  }
  if (patch.modelAccess !== undefined) {
    updated.modelAccess = parseModelAccess({ ...(updated.modelAccess || DEFAULT_MODEL_ACCESS), ...patch.modelAccess });
  }
  return updated;
}

function suspendTenant(tenant) {
  if (tenant.status === TENANT_STATUS.ARCHIVED) throw new Error('cannot suspend archived tenant');
  return { ...tenant, status: TENANT_STATUS.SUSPENDED, updatedAt: nowIso() };
}

function activateTenant(tenant) {
  if (tenant.status === TENANT_STATUS.ARCHIVED) throw new Error('cannot activate archived tenant');
  return { ...tenant, status: TENANT_STATUS.ACTIVE, updatedAt: nowIso() };
}

function archiveTenant(tenant) {
  return { ...tenant, status: TENANT_STATUS.ARCHIVED, updatedAt: nowIso() };
}

module.exports = {
  TENANT_STATUS,
  TENANT_PLAN,
  DEFAULT_QUOTAS,
  DEFAULT_FEATURES,
  DEFAULT_MODEL_ACCESS,
  CPU_OPTIONS,
  MEMORY_OPTIONS,
  STORAGE_OPTIONS,
  INDUSTRY_VALUES,
  COMPANY_SIZE_VALUES,
  validateSlug,
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  archiveTenant
};
