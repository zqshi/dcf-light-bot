# Claw Farm 多租户架构规划 — 可执行规格书

> 版本 1.0 | 2026-04-15
> 目标读者：dcf-light-bot 项目开发者（无需 claw-farm 上下文）
> 数据来源：claw-farm 源码逐行审查 + dcf-light-bot 现有租户模型分析

本文档定义 claw-farm 从**单租户硬编码**向**多租户可配置**演进时，dcf-light-bot 需要提供的数据模型、API、以及 claw-farm 需要的改造点。

---

## 1. 当前架构与多租户差距分析

### 1.1 claw-farm 当前架构（单租户）

```
                    全局单一 WPS 应用凭证
                           │
WPS IM ──webhook──▶ claw-farm Go 服务 ──K8S──▶ OpenClaw Pod
                     │  全局统一配置:
                     │  - 一套模型列表
                     │  - 一套资源规格
                     │  - 一套白名单
                     │  - 一套 Skill 列表
                     │  - 一套消息模板
                     │  - 一套引导流程
                     └── MySQL (clawhub DB, 6 张 Farm 表，无 tenant_id 字段)
```

**核心单点**：
- **WPS 凭证**：全局一组 `WPS_APP_ID` + `WPS_APP_SECRET`（config.go:81-83）
- **资源规格**：全局一组 CPU/Memory/Storage（config.go:91-96）
- **白名单**：全局一张 FarmWhitelist 表（无 tenant 归属）
- **模型列表**：全局硬编码（config.go:140-157, resources.go:256-270）
- **实例上限**：全局 `MAX_INSTANCES`（config.go:112）
- **空闲回收**：全局 `IDLE_TIMEOUT`（config.go:113）
- **消息模板**：全局硬编码中文文案（router.go 散布 20+ 处）

### 1.2 dcf-light-bot 现有多租户基础

dcf-light-bot **已经**具备多租户数据模型基础：

#### 租户域模型（Tenant.js）

```javascript
// 文件: dcf-light-bot/src/contexts/tenant-management/domain/Tenant.js
// 已有完整的租户创建/更新/挂起/激活/归档生命周期
// 已有 3 个套餐等级: free / standard / enterprise

// 已有 4 维度配额:
DEFAULT_QUOTAS = {
  free: {
    maxInstances: 3, maxConcurrentInstances: 2, maxUsers: 5,
    instanceCpu: '250m', instanceMemory: '256Mi', instanceStorage: '1Gi',
    tokenBudgetMonthly: 100000, tokenBudgetDaily: 5000,
    rateLimitPerMinute: 20, dataRetentionDays: 30, maxWebhooks: 2
  },
  standard: { maxInstances: 10, ... },
  enterprise: { maxInstances: 100, instanceCpu: '1000m', instanceMemory: '1Gi', ... }
};
```

#### 实例域模型（Instance.js）

```javascript
// 文件: dcf-light-bot/src/contexts/tenant-instance/domain/Instance.js
// 实例创建已关联 tenantId
function createInstance(input, cfg) {
  const tenantId = String(input.tenantId || '').trim();
  if (!tenantId) throw new Error('tenantId is required to create an instance');
  // ...
  return {
    id: newId('inst'),
    tenantId,           // ✅ 已有租户隔离
    name, source, creator, employeeNo, jobTitle, department,
    state: STATE.REQUESTED,
    runtime: { namespace: '', podName: '', ... },
    resources: { cpu: cfg.tenantDefaultCpu, memory: cfg.tenantDefaultMemory, storage: cfg.tenantDefaultStorage },
    // ...
  };
}
```

### 1.3 差距汇总

| 维度 | dcf-light-bot 现有 | claw-farm 需要 | 差距 |
|------|-------------------|---------------|------|
| 租户模型 | ✅ Tenant 实体 + 配额 | 租户级配置分发 | 需新增配置分发 API |
| 实例创建 | ✅ tenantId 关联 | 按租户配额创建 Pod | 需适配 K8S 资源规格 |
| 模型列表 | ✅ llm_models 表 | 按租户模型白名单 | 需新增租户模型绑定 |
| WPS 凭证 | ❌ 不涉及 | 按租户独立凭证 | 需新增 Channel 凭证表 |
| 消息模板 | ❌ 系统级 | 按租户定制模板 | 需扩展模板表 |
| 白名单 | ❌ 系统级 | 按租户白名单 | 需扩展白名单表 |
| Skill 列表 | ❌ 系统级 | 按租户 Skill 配置 | 需新增租户 Skill 绑定 |

---

## 2. 多租户数据模型设计

### 2.1 租户 Channel 凭证表

claw-farm 当前使用全局 WPS 应用凭证（config.go:81-84）。多租户下，每个租户应有独立的 IM Channel 凭证。

```sql
-- 新增表：租户 Channel 凭证
CREATE TABLE IF NOT EXISTS tenant_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,                 -- FK -> 租户 ID
    channel_type TEXT NOT NULL DEFAULT 'wps', -- wps / feishu / dingtalk / slack
    display_name TEXT NOT NULL,
    -- WPS 凭证字段
    app_id TEXT,                              -- WPS_APP_ID
    app_secret TEXT,                          -- WPS_APP_SECRET (加密存储)
    encrypt_key TEXT,                         -- WPS_ENCRYPT_KEY (加密存储)
    api_url TEXT DEFAULT 'https://openapi.wps.cn',
    -- OAuth 配置
    oauth_callback_url TEXT,
    oauth_scopes TEXT DEFAULT 'kso.file.read,kso.file_link.readwrite',
    -- 状态
    is_active INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT,                         -- 回调 URL（用于配置 WPS 应用）
    last_verified_at TEXT,                    -- 最后一次凭证验证时间
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_channels_tenant_type ON tenant_channels(tenant_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_tenant_channels_active ON tenant_channels(is_active);
```

**与 claw-farm 的对应关系：**

| tenant_channels 字段 | claw-farm 来源 | 位置 |
|---------------------|---------------|------|
| app_id | `cfg.AppID` | config.go:81, `os.Getenv("WPS_APP_ID")` |
| app_secret | `cfg.SecretKey` | config.go:82, `os.Getenv("WPS_APP_SECRET")` |
| encrypt_key | `cfg.EncryptKey` | config.go:83, `os.Getenv("WPS_ENCRYPT_KEY")` |
| api_url | `cfg.APIURL` | config.go:84, 默认 `"https://openapi.wps.cn"` |
| oauth_callback_url | `cfg.OAuthCallbackURL` | config.go:119, `os.Getenv("OAUTH_CALLBACK_URL")` |
| oauth_scopes | `cfg.OAuthScopes` | config.go:120, 默认 `"kso.file.read,kso.file_link.readwrite"` |

### 2.2 租户模型配额表

控制每个租户可使用的模型列表和配额。

```sql
-- 新增表：租户模型配额
CREATE TABLE IF NOT EXISTS tenant_model_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    model_id INTEGER NOT NULL,               -- FK -> llm_models.id
    is_allowed INTEGER NOT NULL DEFAULT 1,   -- 是否允许使用
    is_default_chat INTEGER NOT NULL DEFAULT 0,
    is_default_image INTEGER NOT NULL DEFAULT 0,
    is_default_vlm INTEGER NOT NULL DEFAULT 0,
    daily_token_limit INTEGER,               -- 每日 token 限额（NULL=不限）
    monthly_token_limit INTEGER,             -- 每月 token 限额
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES llm_models(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_model_quotas_tenant_model ON tenant_model_quotas(tenant_id, model_id);
CREATE INDEX IF NOT EXISTS idx_tenant_model_quotas_tenant ON tenant_model_quotas(tenant_id);
```

### 2.3 租户实例 Profile 表

控制每个租户的实例资源规格，替代 claw-farm 的全局 ENV 配置。

```sql
-- 新增表：租户实例资源 Profile
CREATE TABLE IF NOT EXISTS tenant_instance_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    profile_name TEXT NOT NULL DEFAULT 'default', -- default / power / lite
    -- Pod 资源规格（对应 claw-farm config.go:91-96）
    pod_cpu_request TEXT NOT NULL DEFAULT '1000m',
    pod_cpu_limit TEXT NOT NULL DEFAULT '2000m',
    pod_memory_request TEXT NOT NULL DEFAULT '2Gi',
    pod_memory_limit TEXT NOT NULL DEFAULT '2Gi',
    pvc_storage_size TEXT NOT NULL DEFAULT '1Gi',
    storage_class TEXT NOT NULL DEFAULT 'dcf-juicefs-sc',
    -- 实例管理参数（对应 claw-farm config.go:112-114）
    max_instances INTEGER NOT NULL DEFAULT 100,
    idle_timeout INTEGER NOT NULL DEFAULT 7200,   -- 秒
    msg_queue_timeout INTEGER NOT NULL DEFAULT 300, -- 秒
    -- OpenClaw 镜像
    openclaw_image TEXT,                          -- NULL=使用系统默认
    -- 状态
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_profiles_tenant_name ON tenant_instance_profiles(tenant_id, profile_name);
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_tenant ON tenant_instance_profiles(tenant_id);
```

**与 claw-farm 环境变量的对应关系：**

| profile 字段 | claw-farm ENV | 默认值 | 位置 |
|-------------|--------------|--------|------|
| pod_cpu_request | POD_CPU_REQUEST | 1000m | config.go:93 |
| pod_cpu_limit | POD_CPU_LIMIT | 2000m | config.go:94 |
| pod_memory_request | POD_MEMORY_REQUEST | 2Gi | config.go:95 |
| pod_memory_limit | POD_MEMORY_LIMIT | 2Gi | config.go:96 |
| pvc_storage_size | PVC_STORAGE_SIZE | 1Gi | config.go:92 |
| storage_class | STORAGE_CLASS | dcf-juicefs-sc | config.go:91 |
| max_instances | MAX_INSTANCES | 100 | config.go:112 |
| idle_timeout | IDLE_TIMEOUT | 7200 | config.go:113 |
| msg_queue_timeout | MSG_QUEUE_TIMEOUT | 300 | config.go:114 |
| openclaw_image | OPENCLAW_IMAGE | hub-vpc-cn-beijing-6.kce.ksyun.com/dcf_dev/openclaw:dcf-2026.3.8 | config.go:87 |

### 2.4 租户模板覆写表

允许租户覆写系统级模板（AGENTS.md、BOOTSTRAP.md 等），实现品牌定制。

```sql
-- 新增表：租户模板覆写
CREATE TABLE IF NOT EXISTS tenant_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    template_key TEXT NOT NULL,               -- 对应 content_templates.template_key
    content TEXT NOT NULL,                     -- 覆写的模板内容
    variables TEXT,                            -- JSON: 覆写的变量值
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_templates_tenant_key ON tenant_templates(tenant_id, template_key);
CREATE INDEX IF NOT EXISTS idx_tenant_templates_tenant ON tenant_templates(tenant_id);
```

模板解析优先级：**租户覆写 > 系统默认**。

### 2.5 租户 Skill 绑定表

控制每个租户的预装 Skill 和白名单 Skill。

```sql
-- 新增表：租户 Skill 绑定
CREATE TABLE IF NOT EXISTS tenant_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    skill_id INTEGER NOT NULL,                -- FK -> instance_skills.id
    is_pre_installed INTEGER NOT NULL DEFAULT 0,
    is_whitelisted INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (skill_id) REFERENCES instance_skills(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_skills_tenant_skill ON tenant_skills(tenant_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_tenant_skills_tenant ON tenant_skills(tenant_id);
```

### 2.6 租户白名单表

```sql
-- 新增表：租户白名单
CREATE TABLE IF NOT EXISTS tenant_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    email_prefix TEXT NOT NULL,
    display_name TEXT,
    department TEXT,
    added_by TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_whitelist_tenant_prefix ON tenant_whitelist(tenant_id, email_prefix);
CREATE INDEX IF NOT EXISTS idx_tenant_whitelist_tenant ON tenant_whitelist(tenant_id);
```

### 2.7 租户系统消息覆写表

```sql
-- 新增表：租户系统消息覆写
CREATE TABLE IF NOT EXISTS tenant_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    message_key TEXT NOT NULL,               -- 对应 system_messages.message_key
    content TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'zh-CN',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_messages_tenant_key ON tenant_messages(tenant_id, message_key, locale);
CREATE INDEX IF NOT EXISTS idx_tenant_messages_tenant ON tenant_messages(tenant_id);
```

---

## 3. 多租户配置分发 API

### 3.1 租户完整配置导出

claw-farm 在创建实例时，根据用户所属租户拉取完整配置。

```
GET /api/control/config/tenant/:tenantId/full
```

**响应：**
```json
{
  "tenantId": "tn_abc123",
  "version": "2026-04-15T10:00:00Z",

  "channel": {
    "type": "wps",
    "appId": "ks_xxx",
    "secretKey": "***",
    "encryptKey": "***",
    "apiUrl": "https://openapi.wps.cn",
    "oauthCallbackUrl": "https://xxx/oauth/callback",
    "oauthScopes": "kso.file.read,kso.file_link.readwrite"
  },

  "instanceProfile": {
    "podCpuRequest": "1000m",
    "podCpuLimit": "2000m",
    "podMemoryRequest": "2Gi",
    "podMemoryLimit": "2Gi",
    "pvcStorageSize": "1Gi",
    "storageClass": "dcf-juicefs-sc",
    "maxInstances": 100,
    "idleTimeout": 7200,
    "msgQueueTimeout": 300,
    "openclawImage": "hub-vpc-cn-beijing-6.kce.ksyun.com/dcf_dev/openclaw:dcf-2026.3.8"
  },

  "models": {
    "providers": {
      "litellm-am": {
        "api": "anthropic-messages",
        "baseUrl": "https://kspmas.ksyun.com",
        "apiKey": "***",
        "models": [
          { "id": "mcs-5", "contextWindow": 60000, "maxTokens": 8192, "input": ["text"] }
        ]
      },
      "litellm-oc": {
        "api": "openai-completions",
        "baseUrl": "https://kspmas.ksyun.com",
        "apiKey": "***",
        "models": [...]
      }
    },
    "defaults": {
      "chat": "litellm-am/mcs-5",
      "image": "litellm-oc/mgg-5",
      "vlm": "litellm-oc/qwen-vl-max-latest"
    },
    "allowedModels": ["mcs-5", "mco-4", ...],
    "routes": [...]
  },

  "skills": {
    "preInstalled": ["wps-cli", "ezone-cli", "clawhub-cli", "image-gen"],
    "allowBundled": ["healthcheck", "skill-creator", "mcporter", ...]
  },

  "templates": {
    "agents_md": { "content": "# AGENTS.md ...", "version": 3 },
    "tools_md": { "content": "# TOOLS.md ...", "version": 2 },
    "bootstrap_md": { "content": "# BOOTSTRAP.md ...", "version": 1 }
  },

  "messages": {
    "whitelist_rejected": "暂未开放，请联系管理员开通。",
    "instance_starting": "正在启动中，请稍候...",
    "instance_restarting": "正在重启，下次发消息时自动启动..."
  },

  "openclawDefaults": {
    "contextPruning": { ... },
    "openviking": { ... },
    "tools": { "deny": ["group:web"] },
    "logging": { ... },
    "compaction": { ... }
  },

  "whitelist": ["alice", "bob", "charlie"]
}
```

### 3.2 租户身份识别（Webhook 路由）

**关键问题**：claw-farm 收到 WPS IM Webhook 时，如何知道消息属于哪个租户？

#### 当前流程（单租户，无需识别）

```
WPS IM ──POST /open/receive-msg──▶ webhook.Handler
  → 解密事件
  → 提取 sender.id, chat.id
  → router.Route(msg)  // 直接路由，无租户概念
```

#### 多租户流程

**方案：按 WPS APP_ID 路由**

每个租户创建独立的 WPS 应用，拥有独立的 `APP_ID`。Webhook 回调的事件数据中包含 `appId` 字段，claw-farm 根据 `appId` 查找所属租户。

```
WPS IM ──POST /open/receive-msg──▶ webhook.Handler
  → 从事件中提取 appId
  → 查询 tenant_channels 表: SELECT tenant_id FROM tenant_channels WHERE app_id = ? AND is_active = 1
  → 用 tenant_id 加载租户配置
  → router.Route(msg, tenantConfig)
```

**claw-farm 改造点（webhook/handler.go）：**

```go
// 当前: handler.go 直接使用全局 cfg.AppID 验证签名
// 改造后: 支持多组凭证
// 1. 从事件 header/body 中提取 appId
// 2. 从 dcf-light-bot API 获取对应的凭证
// 3. 用该凭证验证签名和解密

// 需要在 claw-farm 中新增:
type TenantConfig struct {
    TenantID        string
    Channel         ChannelConfig
    InstanceProfile InstanceProfileConfig
    Models          ModelConfig
    // ...
}

// 在 Router 中替换全局 cfg 为按租户配置
func (r *Router) Route(ctx context.Context, msg *webhook.WPSMessage, tenantCfg *TenantConfig)
```

### 3.3 租户管理 API

#### 租户 Channel 管理

```
GET    /api/admin/tenants/:tenantId/channels           Channel 列表
POST   /api/admin/tenants/:tenantId/channels           新增 Channel
POST   /api/admin/tenants/:tenantId/channels/:id       更新 Channel
POST   /api/admin/tenants/:tenantId/channels/:id/delete 删除 Channel
POST   /api/admin/tenants/:tenantId/channels/:id/verify 验证凭证有效性
```

#### 租户模型配额管理

```
GET    /api/admin/tenants/:tenantId/model-quotas        模型配额列表
POST   /api/admin/tenants/:tenantId/model-quotas        批量设置模型配额
```

#### 租户实例 Profile 管理

```
GET    /api/admin/tenants/:tenantId/instance-profiles   Profile 列表
POST   /api/admin/tenants/:tenantId/instance-profiles   新增 Profile
POST   /api/admin/tenants/:tenantId/instance-profiles/:id 更新 Profile
```

#### 租户模板覆写

```
GET    /api/admin/tenants/:tenantId/templates           模板覆写列表
POST   /api/admin/tenants/:tenantId/templates/:key      设置模板覆写
POST   /api/admin/tenants/:tenantId/templates/:key/delete 删除覆写（回退到系统默认）
```

#### 租户 Skill 绑定

```
GET    /api/admin/tenants/:tenantId/skills              Skill 绑定列表
POST   /api/admin/tenants/:tenantId/skills              批量设置 Skill 绑定
```

#### 租户白名单

```
GET    /api/admin/tenants/:tenantId/whitelist           白名单列表
POST   /api/admin/tenants/:tenantId/whitelist           批量添加
POST   /api/admin/tenants/:tenantId/whitelist/:id/delete 删除
POST   /api/admin/tenants/:tenantId/whitelist/import    CSV 导入
```

#### 租户消息覆写

```
GET    /api/admin/tenants/:tenantId/messages            消息覆写列表
POST   /api/admin/tenants/:tenantId/messages/:key       设置消息覆写
POST   /api/admin/tenants/:tenantId/messages/:key/delete 删除覆写
```

---

## 4. 配置解析优先级

多租户下，配置采用**覆写继承**机制：

```
租户级覆写 → 系统级默认 → 代码硬编码 fallback
```

### 4.1 模型配置解析

```javascript
// 伪代码: 获取租户的模型配置
async function resolveModelsForTenant(tenantId) {
  // 1. 获取系统级所有活跃模型
  const allModels = await db.query('SELECT * FROM llm_models WHERE is_active = 1');
  
  // 2. 获取租户模型配额（如果有）
  const tenantQuotas = await db.query(
    'SELECT * FROM tenant_model_quotas WHERE tenant_id = ? AND is_allowed = 1',
    [tenantId]
  );
  
  // 3. 如果租户有配额设置，使用租户白名单；否则使用全部系统模型
  const allowedModels = tenantQuotas.length > 0
    ? allModels.filter(m => tenantQuotas.some(q => q.model_id === m.id))
    : allModels;
    
  // 4. 获取模型能力参数
  const capabilities = await db.query(
    'SELECT * FROM llm_model_capabilities WHERE model_id IN (?)',
    [allowedModels.map(m => m.id)]
  );
  
  // 5. 确定默认模型
  const defaults = resolveDefaults(tenantQuotas, capabilities);
  
  // 6. 获取路由规则
  const routes = await db.query('SELECT * FROM llm_model_routes WHERE is_active = 1 ORDER BY priority');
  
  return { providers: buildProviders(allowedModels, capabilities, routes), defaults, routes };
}
```

### 4.2 模板配置解析

```javascript
// 伪代码: 获取租户的模板内容
async function resolveTemplateForTenant(tenantId, templateKey) {
  // 1. 查找租户覆写
  const override = await db.query(
    'SELECT * FROM tenant_templates WHERE tenant_id = ? AND template_key = ? AND is_active = 1',
    [tenantId, templateKey]
  );
  if (override) return { content: override.content, version: override.version, source: 'tenant' };
  
  // 2. 回退到系统默认
  const system = await db.query(
    'SELECT * FROM content_templates WHERE template_key = ? AND is_active = 1',
    [templateKey]
  );
  if (system) return { content: system.content, version: system.version, source: 'system' };
  
  // 3. 最终 fallback: 返回空
  return null;
}
```

### 4.3 消息文案解析

```javascript
// 伪代码: 获取租户的消息文案
async function resolveMessageForTenant(tenantId, messageKey, locale = 'zh-CN') {
  // 1. 查找租户覆写
  const override = await db.query(
    'SELECT content FROM tenant_messages WHERE tenant_id = ? AND message_key = ? AND locale = ? AND is_active = 1',
    [tenantId, messageKey, locale]
  );
  if (override) return override.content;
  
  // 2. 回退到系统默认
  const system = await db.query(
    'SELECT content FROM system_messages WHERE message_key = ? AND locale = ? AND is_active = 1',
    [messageKey, locale]
  );
  return system ? system.content : null;
}
```

---

## 5. claw-farm 侧改造要点

### 5.1 Webhook 路由改造

**当前**（单租户）：
```go
// webhook/handler.go - 当前使用全局 cfg
func (h *Handler) handleEvent(w http.ResponseWriter, r *http.Request) {
    // 使用 h.cfg.SecretKey 验证签名
    // 使用 h.cfg.EncryptKey 解密事件
}
```

**目标**（多租户）：
```go
// webhook/handler.go - 多租户改造后
func (h *Handler) handleEvent(w http.ResponseWriter, r *http.Request) {
    // 1. 从事件中提取 appId（challenge 请求中包含）
    // 2. 从租户配置缓存中查找 appId 对应的凭证
    //    tenantCfg := h.tenantResolver.ResolveByAppID(appId)
    // 3. 使用租户凭证验证签名和解密
    // 4. 将 tenantCfg 传递给 Router
}
```

### 5.2 实例创建改造

**当前**（resources.go:228-402）：
```go
// OpenClawConfig 使用全局 cfg 生成配置
func OpenClawConfig(cfg *config.Config, userID string, override *ModelOverride) ([]byte, error) {
    // 硬编码模型列表、contextPruning、Skill 白名单等
}
```

**目标**：
```go
// OpenClawConfig 使用租户配置生成配置
func OpenClawConfig(tenantCfg *TenantConfig, userID string, override *ModelOverride) ([]byte, error) {
    // 从 tenantCfg 中读取模型列表、Skill 白名单等
    // tenantCfg 来自 dcf-light-bot API: GET /api/control/config/tenant/:tenantId/full
}
```

### 5.3 模板写入改造

**当前**（manager.go:634-1006）：
```go
// buildPodWithInit 使用硬编码 heredoc
cat > /config/workspace/AGENTS.md << 'AGENTSEOF'
# 硬编码的 ~90 行 Markdown
AGENTSEOF
```

**目标**：
```go
// buildPodWithInit 从 API 获取模板
agentsMD := tenantCfg.Templates["agents_md"].Content
cat > /config/workspace/AGENTS.md << 'AGENTSEOF'
` + agentsMD + `
AGENTSEOF
```

### 5.4 配置缓存策略

claw-farm 不应每次创建实例都调用 dcf-light-bot API。建议：

1. **启动时全量拉取**：`GET /api/control/config/full` 获取所有租户配置
2. **内存缓存**：按 tenantId 缓存配置，TTL 5 分钟
3. **Webhook 通知**：dcf-light-bot 配置变更时通过 Webhook 通知 claw-farm 刷新缓存
4. **降级策略**：API 不可用时使用缓存的上一份有效配置

---

## 6. 与 dcf-light-bot 现有代码的集成点

### 6.1 需修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/infrastructure/persistence/DatabaseSchema.js` | 新增 7 张租户配置表 DDL |
| `src/contexts/tenant-management/domain/Tenant.js` | 扩展 Tenant 实体，关联 Channel/Profile/Skills |
| `src/contexts/tenant-management/application/TenantService.js` | 新增租户配置管理方法 |
| `src/interfaces/http/routes/platformTenants.js` | 新增租户配置管理路由 |
| `src/interfaces/http/routes/controlConfig.js` | 新增租户配置导出 API |

### 6.2 需新增的文件

| 文件 | 职责 |
|------|------|
| `src/contexts/tenant-management/application/TenantConfigResolver.js` | 配置解析（覆写继承逻辑） |
| `src/interfaces/http/routes/tenantChannels.js` | 租户 Channel 管理路由 |
| `src/interfaces/http/routes/tenantModelQuotas.js` | 租户模型配额路由 |
| `src/interfaces/http/routes/tenantInstanceProfiles.js` | 租户实例 Profile 路由 |
| `src/interfaces/http/routes/tenantTemplates.js` | 租户模板覆写路由 |
| `src/interfaces/http/routes/tenantSkills.js` | 租户 Skill 绑定路由 |
| `src/interfaces/http/routes/tenantWhitelist.js` | 租户白名单路由 |
| `src/interfaces/http/routes/tenantMessages.js` | 租户消息覆写路由 |
| `src/interfaces/http/super-admin-ui/tenant-config.js` | 超管租户配置管理 UI |

### 6.3 现有 Tenant 模型与新表的关系

```
Tenant (已有)
├── tenant_channels (新增) — 1:N, 每个租户可有多个 Channel
├── tenant_model_quotas (新增) — 1:N, 每个租户对多个模型设配额
├── tenant_instance_profiles (新增) — 1:N, 每个租户可有多个资源 Profile
├── tenant_templates (新增) — 1:N, 每个租户可覆写多个模板
├── tenant_skills (新增) — 1:N, 每个租户绑定多个 Skill
├── tenant_whitelist (新增) — 1:N, 每个租户独立白名单
└── tenant_messages (新增) — 1:N, 每个租户覆写多条消息
```

---

## 7. 数据隔离与安全

### 7.1 API 层隔离

所有租户级 API 遵循路径约定 `/api/admin/tenants/:tenantId/...`，中间件自动校验：
1. 当前用户是否有权访问该租户
2. 超级管理员可访问所有租户
3. 租户管理员仅可访问本租户

### 7.2 凭证加密

`tenant_channels` 表中的 `app_secret` 和 `encrypt_key` 字段必须加密存储。建议：
- 使用 AES-256-GCM 加密
- 加密密钥从环境变量 `CREDENTIAL_ENCRYPTION_KEY` 读取
- 导出 API 中返回明文（仅 control plane 内部通信）

### 7.3 配额强制

```javascript
// 在 InstanceService.createFromMatrix 中增加配额检查
async createFromMatrix(input) {
  const tenant = await this.repo.getTenant(input.tenantId);
  const currentCount = await this.repo.countActiveInstances(input.tenantId);
  
  if (currentCount >= tenant.quotas.maxInstances) {
    throw new AppError(
      `租户 ${tenant.name} 实例数量已达上限 (${tenant.quotas.maxInstances})`,
      429, 'TENANT_INSTANCE_LIMIT_REACHED'
    );
  }
  // ...继续创建
}
```
