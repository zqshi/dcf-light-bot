/**
 * DatabaseSchema - 统一数据库表定义
 * 参考 ClawManager migrations 设计
 */

// ============================================
// 用户与权限相关表
// ============================================

const USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`;

const USER_ROLES_TABLE = `
  CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    permissions TEXT,  -- JSON 数组
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const USER_ROLE_ASSIGNMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_role_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    assigned_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES user_roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
  );
`;

// ============================================
// 配额管理表
// ============================================

const USER_QUOTAS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    max_instances INTEGER NOT NULL DEFAULT 10,
    max_cpu_cores INTEGER NOT NULL DEFAULT 16,
    max_memory_gb REAL NOT NULL DEFAULT 16.0,
    max_storage_gb REAL NOT NULL DEFAULT 100.0,
    max_gpu_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

// ============================================
// 实例管理表
// ============================================

const INSTANCES_TABLE = `
  CREATE TABLE IF NOT EXISTS instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'openclaw',
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, starting, running, stopping, stopped, error, deleting
    cpu_cores INTEGER NOT NULL,
    memory_gb REAL NOT NULL,
    disk_gb REAL NOT NULL,
    gpu_enabled INTEGER NOT NULL DEFAULT 0,
    gpu_count INTEGER NOT NULL DEFAULT 0,
    os_type TEXT NOT NULL DEFAULT 'linux',
    os_version TEXT NOT NULL,
    image_registry TEXT,
    image_tag TEXT,
    pod_name TEXT,
    pod_namespace TEXT,
    pod_ip TEXT,
    storage_class TEXT DEFAULT 'standard',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    stopped_at TEXT,
    last_sync_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_instances_user_id ON instances(user_id);
  CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
  CREATE INDEX IF NOT EXISTS idx_instances_type ON instances(type);
`;

// ============================================
// AI Gateway - 模型管理表
// ============================================

const LLM_MODELS_TABLE = `
  CREATE TABLE IF NOT EXISTS llm_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT UNIQUE NOT NULL,
    description TEXT,
    provider_type TEXT NOT NULL,  -- openai, anthropic, deepseek, etc.
    protocol_type TEXT NOT NULL,    -- openai, anthropic, openai-compatible
    base_url TEXT NOT NULL,
    provider_model_name TEXT,
    api_key TEXT,
    api_key_secret_ref TEXT,
    is_secure INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    input_price REAL NOT NULL DEFAULT 0.0,
    output_price REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'CNY',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON llm_models(provider_type);
  CREATE INDEX IF NOT EXISTS idx_llm_models_is_active ON llm_models(is_active);
  CREATE INDEX IF NOT EXISTS idx_llm_models_is_secure ON llm_models(is_secure);
`;

const DISCOVERED_MODELS_TABLE = `
  CREATE TABLE IF NOT EXISTS discovered_models (
    id TEXT PRIMARY KEY,           -- 唯一标识: provider_id:provider_model_name
    display_name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    provider_model_name TEXT NOT NULL,
    input_price REAL,
    output_price REAL,
    currency TEXT,
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,     -- 缓存过期时间（TTL 5分钟）
    provider_id INTEGER,            -- 关联的供应商模型配置ID
    FOREIGN KEY (provider_id) REFERENCES llm_models(id) ON DELETE SET NULL
  );
`;

// ============================================
// AI Gateway - 审计追踪表
// ============================================

const AI_TRACES_TABLE = `
  CREATE TABLE IF NOT EXISTS ai_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    user_id TEXT,
    instance_id INTEGER,
    requested_model TEXT NOT NULL DEFAULT 'auto',
    actual_model TEXT,
    provider_type TEXT,
    status TEXT NOT NULL,  -- completed, blocked, failed
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    input_cost REAL NOT NULL DEFAULT 0.0,
    output_cost REAL NOT NULL DEFAULT 0.0,
    estimated_cost REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ai_traces_trace_id ON ai_traces(trace_id);
  CREATE INDEX IF NOT EXISTS idx_ai_traces_user_id ON ai_traces(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_traces_status ON ai_traces(status);
  CREATE INDEX IF NOT EXISTS idx_ai_traces_created_at ON ai_traces(created_at DESC);
`;

const AI_FLOW_NODES_TABLE = `
  CREATE TABLE IF NOT EXISTS ai_flow_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    node_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,         -- user_message, llm_call, tool_call, assistant_response, risk_check, error
    title TEXT,
    model TEXT,
    status TEXT,
    summary TEXT,
    input_payload TEXT,           -- JSON
    output_payload TEXT,          -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trace_id) REFERENCES ai_traces(trace_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ai_flow_nodes_trace_id ON ai_flow_nodes(trace_id);
  CREATE INDEX IF NOT EXISTS idx_ai_flow_nodes_created_at ON ai_flow_nodes(created_at);
`;

const AI_RISK_HITS_TABLE = `
  CREATE TABLE IF NOT EXISTS ai_risk_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    action TEXT NOT NULL,
    match_summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trace_id) REFERENCES ai_traces(trace_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ai_risk_hits_trace_id ON ai_risk_hits(trace_id);
  CREATE INDEX IF NOT EXISTS idx_ai_risk_hits_rule_id ON ai_risk_hits(rule_id);
`;

// ============================================
// AI Gateway - 风控规则表
// ============================================

const RISK_RULES_TABLE = `
  CREATE TABLE IF NOT EXISTS risk_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    pattern TEXT NOT NULL,
    severity TEXT NOT NULL,           -- low, medium, high
    action TEXT NOT NULL,              -- allow, route_secure_model, block
    category TEXT NOT NULL DEFAULT 'custom',  -- privacy, company, customer, security, financeLegal, political, custom
    is_enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_risk_rules_category ON risk_rules(category);
  CREATE INDEX IF NOT EXISTS idx_risk_rules_is_enabled ON risk_rules(is_enabled);
  CREATE INDEX IF NOT EXISTS idx_risk_rules_sort_order ON risk_rules(sort_order);
`;

// ============================================
// 成本核算表
// ============================================

const COST_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    user_id TEXT,
    model TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    input_price REAL NOT NULL DEFAULT 0.0,
    output_price REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'CNY',
    exchange_rate REAL NOT NULL DEFAULT 1.0,
    cost_original REAL NOT NULL DEFAULT 0.0,  -- 原币种成本
    cost_cny REAL NOT NULL DEFAULT 0.0,           -- 折合 CNY 成本
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trace_id) REFERENCES ai_traces(trace_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cost_records_trace_id ON cost_records(trace_id);
  CREATE INDEX IF NOT EXISTS idx_cost_records_user_id ON cost_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_cost_records_created_at ON cost_records(created_at DESC);
`;

// ============================================
// 汇率表
// ============================================

const EXCHANGE_RATES_TABLE = `
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'CNY',
    rate REAL NOT NULL DEFAULT 1.0,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(from_currency, to_currency, date(fetched_at))
  );

  CREATE INDEX IF NOT EXISTS idx_exchange_rates_from_to ON exchange_rates(from_currency, to_currency);
  CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at DESC);
`;

// ============================================
// OpenClaw 配置表
// ============================================

const OPENCLAW_CONFIGS_TABLE = `
  CREATE TABLE IF NOT EXISTS openclaw_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    config_plan TEXT NOT NULL,      -- JSON 配置计划
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_openclaw_configs_user_id ON openclaw_configs(user_id);
`;

// ============================================
// 系统配置表
// ============================================

const SYSTEM_CONFIGS_TABLE = `
  CREATE TABLE IF NOT EXISTS system_configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// ============================================
// 审计日志表（通用）
// ============================================

const AUDIT_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,             -- admin, runtime, etc.
    module TEXT,                    -- users, instances, skills, tools, ai-gateway, etc.
    operation TEXT NOT NULL,          -- create, update, delete, login, etc.
    status TEXT,
    actor_id TEXT,
    actor_name TEXT,
    resource_id TEXT,
    resource_type TEXT,
    details TEXT,                   -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_scope ON audit_logs(scope);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
`;

// ============================================
// 全部初始化 SQL
// ============================================

const ALL_TABLES_SQL = `
  ${USERS_TABLE}

  ${USER_ROLES_TABLE}

  ${USER_ROLE_ASSIGNMENTS_TABLE}

  ${USER_QUOTAS_TABLE}

  ${INSTANCES_TABLE}

  ${LLM_MODELS_TABLE}

  ${DISCOVERED_MODELS_TABLE}

  ${AI_TRACES_TABLE}

  ${AI_FLOW_NODES_TABLE}

  ${AI_RISK_HITS_TABLE}

  ${RISK_RULES_TABLE}

  ${COST_RECORDS_TABLE}

  ${EXCHANGE_RATES_TABLE}

  ${OPENCLAW_CONFIGS_TABLE}

  ${OPENCLAW_CONFIGS_TABLE}

  ${SYSTEM_CONFIGS_TABLE}

  ${AUDIT_LOGS_TABLE}
`;

module.exports = {
  // 表定义
  USERS_TABLE,
  USER_ROLES_TABLE,
  USER_ROLE_ASSIGNMENTS_TABLE,
  USER_QUOTAS_TABLE,
  INSTANCES_TABLE,
  LLM_MODELS_TABLE,
  DISCOVERED_MODELS_TABLE,
  AI_TRACES_TABLE,
  AI_FLOW_NODES_TABLE,
  AI_RISK_HITS_TABLE,
  RISK_RULES_TABLE,
  COST_RECORDS_TABLE,
  EXCHANGE_RATES_TABLE,
  OPENCLAW_CONFIGS_TABLE,
  SYSTEM_CONFIGS_TABLE,
  AUDIT_LOGS_TABLE,
  ALL_TABLES_SQL,

  // 默认数据
  DEFAULT_USERS: [
    {
      username: 'admin',
      email: 'admin@dcf.local',
      password_hash: '$2a$10$rK8LQK7hZd4Zz5XqOzXKqZ5XqOzXKqZ5XqOzXKqZ5XqOzXKqZ5Xq', // admin123
      role: 'admin',
      is_active: 1
    }
  ],

  DEFAULT_ROLES: [
    { name: 'admin', display_name: '管理员', permissions: JSON.stringify(['*']) },
    { name: 'user', display_name: '普通用户', permissions: JSON.stringify(['runtime.page.*.read', 'runtime.page.*.write']) },
    { name: 'viewer', display_name: '访客', permissions: JSON.stringify(['runtime.page.*.read']) }
  ],

  DEFAULT_RISK_RULES: [
    {
      rule_id: 'private_key',
      display_name: '私钥检测',
      description: '检测 PEM 格式的私钥内容',
      pattern: '-----BEGIN.*PRIVATE KEY-----',
      severity: 'high',
      action: 'block',
      category: 'security',
      sort_order: 1
    },
    {
      rule_id: 'api_key',
      display_name: 'API Key 检测',
      description: '检测常见的 API Key 格式（sk-、ak_、AKIA 前缀）',
      pattern: '(sk-|ak_|AKIA)[A-Za-z0-9]{16,}',
      severity: 'high',
      action: 'route_secure_model',
      category: 'security',
      sort_order: 2
    },
    {
      rule_id: 'id_card',
      display_name: '身份证号检测',
      description: '检测 18 位身份证号码',
      pattern: '\\d{17}[\\dXx]',
      severity: 'medium',
      action: 'route_secure_model',
      category: 'privacy',
      sort_order: 3
    },
    {
      rule_id: 'phone_number',
      display_name: '手机号检测',
      description: '检测中国大陆手机号',
      pattern: '1[3-9]\\d{9}',
      severity: 'low',
      action: 'allow',
      category: 'privacy',
      sort_order: 4
    },
    {
      rule_id: 'email_address',
      display_name: '邮箱地址',
      description: '检测邮箱地址格式',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      severity: 'low',
      action: 'allow',
      category: 'privacy',
      sort_order: 5
    },
    {
      rule_id: 'private_ip',
      display_name: '内网 IP',
      description: '检测私有 IP 地址（10.x, 172.16-31.x, 192.168.x.x）',
      pattern: '\\b(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\d|192\\.168\\.)\\d{1,3}\\b',
      severity: 'medium',
      action: 'route_secure_model',
      category: 'company',
      sort_order: 6
    },
    {
      rule_id: 'sql_injection',
      display_name: 'SQL 注入检测',
      description: '检测破坏性 SQL 语句',
      pattern: '(DROP|DELETE|TRUNCATE)\\s+TABLE',
      severity: 'high',
      action: 'block',
      category: 'security',
      sort_order: 7
    }
  ],

  DEFAULT_SYSTEM_CONFIGS: {
    'exchange_rate.provider': 'manual',
    'exchange_rate.auto_update': 'true',
    'db.version': '1',
    'websocket.enabled': 'true'
  }
};
