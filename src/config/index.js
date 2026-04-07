const fs = require('fs');
const path = require('path');

let cached = null;

function parseBoolean(input, fallback) {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function parseProviders(env) {
  const providers = [];
  const minimaxKey = String(env.MINIMAX_API_KEY || env.ANTHROPIC_AUTH_TOKEN || '').trim();
  const table = [
    ['openai', env.OPENAI_API_KEY],
    ['anthropic', env.ANTHROPIC_API_KEY],
    ['deepseek', env.DEEPSEEK_API_KEY],
    ['minimax', minimaxKey]
  ];
  for (const [name, key] of table) {
    if (String(key || '').trim()) providers.push({ name, key: String(key).trim() });
  }
  return providers;
}

function defaultUsersJson() {
  return JSON.stringify([
    { username: 'admin', role: 'platform_admin', password: 'plain:admin123' },
    { username: 'reviewer', role: 'reviewer', password: 'plain:review123' },
    { username: 'ops', role: 'ops_admin', password: 'plain:ops123' },
    { username: 'auditor', role: 'auditor', password: 'plain:audit123' }
  ]);
}

function buildDefaultOpenclawPermissionTemplate() {
  return {
    commandAllowlist: ['/help', '/status', '/report'],
    approvalByRisk: {
      L1: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
      L2: { requiredApprovals: 1, requiredAnyRoles: ['ops_admin'], distinctRoles: false },
      L3: { requiredApprovals: 1, requiredAnyRoles: ['reviewer', 'ops_admin'], distinctRoles: false },
      L4: { requiredApprovals: 2, requiredAnyRoles: ['platform_admin', 'auditor'], distinctRoles: true }
    }
  };
}

function parseOpenclawPermissionTemplate(raw) {
  const fallback = buildDefaultOpenclawPermissionTemplate();
  const value = String(raw || '').trim();
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const commandAllowlist = Array.isArray(parsed.commandAllowlist)
      ? parsed.commandAllowlist.map((x) => String(x || '').trim()).filter(Boolean)
      : fallback.commandAllowlist;
    const approvalByRisk = parsed.approvalByRisk && typeof parsed.approvalByRisk === 'object'
      ? parsed.approvalByRisk
      : fallback.approvalByRisk;
    return { commandAllowlist, approvalByRisk };
  } catch {
    return fallback;
  }
}

function parseSsoProfileMapping(raw) {
  const fallback = {
    username: 'preferred_username',
    email: 'email',
    role: 'role',
    displayName: 'name'
  };
  const text = String(raw || '').trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      username: String(parsed.username || fallback.username),
      email: String(parsed.email || fallback.email),
      role: String(parsed.role || fallback.role),
      displayName: String(parsed.displayName || fallback.displayName)
    };
  } catch {
    return fallback;
  }
}

function parseUsers(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || defaultUsersJson()));
  } catch {
    throw new Error('CONTROL_PLANE_USERS_JSON must be valid JSON array');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('CONTROL_PLANE_USERS_JSON must be a non-empty array');
  }
  return parsed.map((u) => ({
    username: String(u.username || '').trim(),
    role: String(u.role || '').trim(),
    password: String(u.password || '').trim(),
    disabled: Boolean(u.disabled)
  }));
}

function loadConfig() {
  if (cached) return cached;
  require('dotenv').config();

  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  const logsDir = path.resolve(process.env.LOGS_DIR || './logs');
  const storeFile = path.resolve(process.env.CONTROL_PLANE_STORE || path.join(dataDir, 'control-plane.json'));
  const dbFile = path.resolve(process.env.DB_FILE || path.join(dataDir, 'dcf-light-bot.db'));
  const providers = parseProviders(process.env);
  const users = parseUsers(process.env.CONTROL_PLANE_USERS_JSON);

  const cfg = {
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3000),
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
    dataDir,
    logsDir,
    storeFile,
    persistenceBackend: String(process.env.PERSISTENCE_BACKEND || 'sqlite').toLowerCase(),
    dbFile,
    postgresUrl: String(process.env.POSTGRES_URL || '').trim(),
    postgresSchema: String(process.env.POSTGRES_SCHEMA || 'public').trim(),
    postgresTable: String(process.env.POSTGRES_TABLE || 'control_plane_store').trim(),
    postgresRowKey: String(process.env.POSTGRES_ROW_KEY || 'main').trim(),
    kubernetesSimulationMode: parseBoolean(process.env.KUBERNETES_SIMULATION_MODE, true),
    kubernetesReconcileEnabled: parseBoolean(process.env.KUBERNETES_RECONCILE_ENABLED, true),
    kubernetesRollbackOnProvisionFailure: parseBoolean(process.env.KUBERNETES_ROLLBACK_ON_PROVISION_FAILURE, true),
    kubernetesWaitForReady: parseBoolean(process.env.KUBERNETES_WAIT_FOR_READY, true),
    kubernetesReadyTimeoutMs: Number(process.env.KUBERNETES_READY_TIMEOUT_MS || 120_000),
    kubernetesReadyPollIntervalMs: Number(process.env.KUBERNETES_READY_POLL_INTERVAL_MS || 3_000),
    kubernetesNamespacePrefix: String(process.env.KUBERNETES_NAMESPACE_PREFIX || 'dcf'),
    openclawImage: String(process.env.OPENCLAW_IMAGE || 'openclaw/openclaw:2026.2.27'),
    openclawRuntimeVersion: String(process.env.OPENCLAW_RUNTIME_VERSION || '2026.2.27'),
    openclawSourcePath: String(process.env.OPENCLAW_SOURCE_PATH || '/Users/zqs/Downloads/project/dependencies/openclaw'),
    matrixHomeserver: String(process.env.MATRIX_HOMESERVER || 'https://matrix.org'),
    matrixUserId: String(process.env.MATRIX_USER_ID || '@dcf-light-bot:matrix.org'),
    matrixDeviceId: String(process.env.MATRIX_DEVICE_ID || '').trim(),
    matrixPassword: String(process.env.MATRIX_PASSWORD || '').trim(),
    matrixBotDisplayName: String(process.env.MATRIX_BOT_DISPLAY_NAME || '数字工厂bot'),
    matrixAccessToken: String(process.env.MATRIX_ACCESS_TOKEN || ''),
    matrixRelayEnabled: parseBoolean(process.env.MATRIX_RELAY_ENABLED, true),
    matrixE2eeEnabled: parseBoolean(process.env.MATRIX_E2EE_ENABLED, false),
    matrixRelayInitialSyncLimit: Number(process.env.MATRIX_RELAY_INITIAL_SYNC_LIMIT || 10),
    matrixConversationMode: String(process.env.MATRIX_CONVERSATION_MODE || 'openclaw_channel').trim().toLowerCase(),
    matrixWebhookSecret: String(process.env.MATRIX_WEBHOOK_SECRET || 'dev-matrix-secret'),
    deepseekApiBase: String(process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'),
    deepseekModel: String(process.env.DEEPSEEK_MODEL || 'deepseek-chat'),
    minimaxApiBase: String(process.env.MINIMAX_API_BASE || process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic'),
    minimaxModel: String(process.env.MINIMAX_MODEL || 'MiniMax-M2.5'),
    openclawPermissionTemplate: parseOpenclawPermissionTemplate(process.env.OPENCLAW_PERMISSION_TEMPLATE_JSON),
    ssoEnabled: parseBoolean(process.env.SSO_ENABLED, false),
    ssoProvider: String(process.env.SSO_PROVIDER || 'oidc').trim(),
    ssoBridgeLoginEnabled: parseBoolean(process.env.SSO_BRIDGE_LOGIN_ENABLED, true),
    ssoAuthorizeUrl: String(process.env.SSO_AUTHORIZE_URL || '').trim(),
    ssoCallbackUrl: String(process.env.SSO_CALLBACK_URL || '').trim(),
    ssoProfileMapping: parseSsoProfileMapping(process.env.SSO_PROFILE_MAPPING_JSON),
    controlPlaneAdminToken: String(process.env.CONTROL_PLANE_ADMIN_TOKEN || 'dev-admin-token'),
    controlPlaneJwtSecret: String(process.env.CONTROL_PLANE_JWT_SECRET || 'dev-jwt-secret'),
    controlPlaneJwtExpiresInSec: Number(process.env.CONTROL_PLANE_JWT_EXPIRES_SEC || 8 * 3600),
    controlPlaneUsers: users,
    platformBaseUrl: String(process.env.PLATFORM_BASE_URL || 'http://localhost:3000'),
    tenantDefaultCpu: String(process.env.TENANT_DEFAULT_CPU || '200m'),
    tenantDefaultMemory: String(process.env.TENANT_DEFAULT_MEMORY || '512Mi'),
    tenantDefaultStorage: String(process.env.TENANT_DEFAULT_STORAGE || '20Gi'),
    bootstrapIntervalMs: Number(process.env.BOOTSTRAP_INTERVAL_MS || 5000),
    bootstrapProvisioningTimeoutMs: Number(process.env.BOOTSTRAP_PROVISIONING_TIMEOUT_MS || 2 * 60 * 1000),
    auditRetentionEnabled: parseBoolean(process.env.AUDIT_RETENTION_ENABLED, true),
    auditRetentionIntervalMs: Number(process.env.AUDIT_RETENTION_INTERVAL_MS || 10 * 60 * 1000),
    auditRetentionTtlDays: Number(process.env.AUDIT_RETENTION_TTL_DAYS || 30),
    auditRetentionMaxRows: Number(process.env.AUDIT_RETENTION_MAX_ROWS || 5000),
    auditArchiveEnabled: parseBoolean(process.env.AUDIT_ARCHIVE_ENABLED, true),
    auditArchiveMaxRows: Number(process.env.AUDIT_ARCHIVE_MAX_ROWS || 20000),
    assetReviewSlaEnabled: parseBoolean(process.env.ASSET_REVIEW_SLA_ENABLED, true),
    assetReviewSlaIntervalMs: Number(process.env.ASSET_REVIEW_SLA_INTERVAL_MS || 5 * 60 * 1000),
    assetReviewSlaHours: Number(process.env.ASSET_REVIEW_SLA_HOURS || 24),
    assetReviewEscalationMaxLevel: Number(process.env.ASSET_REVIEW_ESCALATION_MAX_LEVEL || 3),
    assetReviewEscalationCooldownHours: Number(process.env.ASSET_REVIEW_ESCALATION_COOLDOWN_HOURS || 4),
    assetReviewEscalationRole: String(process.env.ASSET_REVIEW_ESCALATION_ROLE || 'platform_admin'),
    metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, true),
    metricsRefreshIntervalMs: Number(process.env.METRICS_REFRESH_INTERVAL_MS || 60_000),
    healthUnhealthyOverdueThreshold: Number(process.env.HEALTH_UNHEALTHY_OVERDUE_THRESHOLD || 20),
    healthUnhealthyDegradedEventThreshold: Number(process.env.HEALTH_UNHEALTHY_DEGRADED_EVENT_THRESHOLD || 20),
    healthUnhealthyFailedInstancesThreshold: Number(process.env.HEALTH_UNHEALTHY_FAILED_INSTANCES_THRESHOLD || 5),
    healthDegradedOverdueThreshold: Number(process.env.HEALTH_DEGRADED_OVERDUE_THRESHOLD || 1),
    healthDegradedEscalatedThreshold: Number(process.env.HEALTH_DEGRADED_ESCALATED_THRESHOLD || 1),
    healthDegradedEventThreshold: Number(process.env.HEALTH_DEGRADED_EVENT_THRESHOLD || 1),
    healthDegradedFailedInstancesThreshold: Number(process.env.HEALTH_DEGRADED_FAILED_INSTANCES_THRESHOLD || 1),
    runtimeProxyInvokePath: String(process.env.RUNTIME_PROXY_INVOKE_PATH || '/api/runtime/invoke'),
    runtimeProxyTimeoutMs: Number(process.env.RUNTIME_PROXY_TIMEOUT_MS || 10_000),
    runtimeProxyMaxRetries: Number(process.env.RUNTIME_PROXY_MAX_RETRIES || 2),
    runtimeProxyRetryBackoffMs: Number(process.env.RUNTIME_PROXY_RETRY_BACKOFF_MS || 200),
    runtimeProxyFailureThreshold: Number(process.env.RUNTIME_PROXY_FAILURE_THRESHOLD || 3),
    runtimeProxyBreakerCoolOffMs: Number(process.env.RUNTIME_PROXY_BREAKER_COOLOFF_MS || 30_000),
    runtimeProxySharedToken: String(process.env.RUNTIME_PROXY_SHARED_TOKEN || '').trim(),
    weKnoraEnabled: parseBoolean(process.env.WEKNORA_ENABLED, false),
    weKnoraApiUrl: String(process.env.WEKNORA_API_URL || 'http://weknora-app:8080').trim(),
    weKnoraJwtSecret: String(process.env.WEKNORA_JWT_SECRET || '').trim(),
    providers
  };

  if (!providers.length) {
    throw new Error('At least one provider key is required in platform config.');
  }

  if (cfg.persistenceBackend === 'postgres' && !cfg.postgresUrl) {
    throw new Error('POSTGRES_URL must be set when PERSISTENCE_BACKEND=postgres');
  }
  if (!['file', 'sqlite', 'postgres'].includes(cfg.persistenceBackend)) {
    throw new Error('PERSISTENCE_BACKEND must be one of: file, sqlite, postgres');
  }

  if (cfg.nodeEnv === 'production') {
    if (!cfg.controlPlaneAdminToken || cfg.controlPlaneAdminToken === 'dev-admin-token') {
      throw new Error('CONTROL_PLANE_ADMIN_TOKEN must be set in production.');
    }
    if (!cfg.matrixWebhookSecret || cfg.matrixWebhookSecret === 'dev-matrix-secret') {
      throw new Error('MATRIX_WEBHOOK_SECRET must be set in production.');
    }
    if (!cfg.controlPlaneJwtSecret || cfg.controlPlaneJwtSecret === 'dev-jwt-secret') {
      throw new Error('CONTROL_PLANE_JWT_SECRET must be set in production.');
    }
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  cached = cfg;
  return cfg;
}

module.exports = { loadConfig };
