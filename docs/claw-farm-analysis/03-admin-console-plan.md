# Claw Farm 管理后台功能规划 — 可执行规格书

> 版本 1.0 | 2026-04-15
> 目标读者：dcf-light-bot 项目开发者（无需 claw-farm 上下文）
> 数据来源：claw-farm 源码逐行审查

本文档是 **可执行规格书**：包含 claw-farm 中所有需要 DB 化管理的功能点的完整业务逻辑、当前硬编码值、数据模型设计、API 契约、以及代码生成参考。开发者读完本文档后，应能直接在 dcf-light-bot 中实现对应的管理能力，无需再查阅 claw-farm 源码。

---

## 1. 总体设计思路

### 1.1 问题定义

claw-farm 是 WPS IM 与 OpenClaw AI Agent 实例之间的中间层，Go 编写，~8350 行。其核心问题：**32 个业务功能点中有 18 个硬编码在 Go 源码中**，任何运营调整都需要改代码、构建镜像、重新部署。

dcf-light-bot 作为管理后台（Node.js + SQLite/PostgreSQL），需要将这些硬编码配置 **DB 化**，并通过 API 暴露给管理界面，使 claw-farm 能在运行时从 dcf-light-bot 拉取配置。

### 1.2 架构关系

```
dcf-light-bot (管理后台)          claw-farm (运行时)
┌──────────────────────┐        ┌──────────────────────┐
│ Admin UI (MPA)       │        │ Go 主服务            │
│ ├─ 模型管理页面      │        │ ├─ config.go         │
│ ├─ 模板管理页面      │ ──API──│ ├─ resources.go      │
│ ├─ 实例管理页面      │        │ ├─ manager.go        │
│ └─ 消息文案管理      │        │ └─ router.go         │
│                      │        │                      │
│ Control Plane API    │        │ 运行时配置加载:       │
│ ├─ /api/admin/models │◀───────│   启动时 HTTP 拉取    │
│ ├─ /api/admin/tpl    │        │   OR 定时轮询         │
│ └─ /api/admin/msg    │        │   OR 环境变量注入     │
│                      │        │                      │
│ SQLite / PostgreSQL  │        │ K8S Pod 编排          │
└──────────────────────┘        └──────────────────────┘
```

### 1.3 改造策略

不改 claw-farm 架构，而是：
1. dcf-light-bot 提供 **配置读取 API**（JSON 格式）
2. claw-farm 在实例创建时调用 API 获取最新配置，替代硬编码
3. 过渡期支持 fallback：API 不可用时使用当前硬编码默认值

---

## 2. 模型管理模块

### 2.1 当前硬编码分析

claw-farm 中模型相关信息分散在 3 个位置：

#### 位置 1：可用模型列表（config.go:140-157）

```go
// 文件: claw-farm/internal/config/config.go
// 行号: 140-157
// 函数: Load()
extraModels := []string{
    "mcs-5", "mco-4", "mcs-1", "mch-1",
    "mgg-9",
    "qwen-plus-latest", "qwen-max-latest",
    "qwen3-235b-a22b", "qwen-vl-max-latest",
    "text-embedding-v3",
}
```

这些模型 ID 会被展开为 3 种前缀形式（bare + litellm-am/ + litellm-oc/ + provider/）注入到 LiteLLM 虚拟 Key 的 allowed_models 中。

#### 位置 2：模型元信息定义（resources.go:256-270）

```go
// 文件: claw-farm/internal/instance/resources.go
// 行号: 256-270
// 函数: OpenClawConfig()

// litellm-am: Anthropic Messages 格式 (Claude 系列)
amModels := []modelEntry{
    {ID: "mcs-5", ContextWindow: 60000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "mco-4", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "mcs-1", ContextWindow: 60000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "mch-1", ContextWindow: 60000, MaxTokens: 8192, Input: []string{"text"}},
}

// litellm-oc: OpenAI Completions 格式 (Qwen, Gemini 等)
ocModels := []modelEntry{
    {ID: "qwen-plus-latest", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "qwen-max-latest", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "qwen3-235b-a22b", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
    {ID: "qwen-vl-max-latest", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text", "image"}},
    {ID: "mgg-9", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text", "image"}},
}
```

每个 modelEntry 包含 4 个字段：`ID`（模型标识）、`ContextWindow`（上下文窗口大小）、`MaxTokens`（最大输出 token）、`Input`（输入模态：text/image）。

这些元信息会被 `makeModelDef()` 函数（resources.go:178-190）转换为 openclaw.json 中的 models.providers 配置。

#### 位置 3：模型路由规则（resources.go:214-224）

```go
// 文件: claw-farm/internal/instance/resources.go
// 行号: 214-224
// 函数: resolveModelRef()
func resolveModelRef(modelID string) string {
    switch {
    case strings.HasPrefix(modelID, "mcs"),
         strings.HasPrefix(modelID, "mco"),
         strings.HasPrefix(modelID, "mch"):
        return "litellm-am/" + modelID
    default:
        return "litellm-oc/" + modelID
    }
}
```

路由逻辑：以 `mcs`/`mco`/`mch` 开头的模型走 `litellm-am`（Anthropic Messages API 格式），其余走 `litellm-oc`（OpenAI Completions 格式）。

#### 位置 4：默认模型选择（config.go:108-110）

```go
// 文件: claw-farm/internal/config/config.go
// 行号: 108-110
DefaultChatModel:  getEnv("DEFAULT_CHAT_MODEL", "mcs-5"),
DefaultImageModel: getEnv("DEFAULT_IMAGE_MODEL", "mgg-5"),
DefaultVLMModel:   getEnv("DEFAULT_VLM_MODEL", "qwen-vl-max-latest"),
```

3 个默认模型：对话用 mcs-5、图片生成用 mgg-5、视觉语言用 qwen-vl-max-latest。

#### 位置 5：Provider 端点配置（resources.go:250-281）

```go
// 文件: claw-farm/internal/instance/resources.go
// 行号: 250-281
providerBase := map[string]interface{}{
    "baseUrl": modelBaseURL,   // 来自环境变量 ANTHROPIC_BASE_URL，默认 "https://kspmas.ksyun.com"
    "apiKey":  modelAPIKey,    // 来自环境变量 ANTHROPIC_API_KEY
}
providers := map[string]interface{}{
    "litellm-am": mergeMap(providerBase, map[string]interface{}{
        "api":    "anthropic-messages",
        "models": mapModels(amModels),
    }),
    "litellm-oc": mergeMap(providerBase, map[string]interface{}{
        "api":    "openai-completions",
        "models": mapModels(ocModels),
    }),
}
```

两个 Provider：`litellm-am`（anthropic-messages 格式）和 `litellm-oc`（openai-completions 格式），共享同一个 baseUrl 和 apiKey。

### 2.2 数据模型设计

dcf-light-bot **已有** `llm_models` 表（DatabaseSchema.js:110-133），但其结构偏向通用 LLM 网关场景。需要扩展以覆盖 claw-farm 的 Provider 分组概念。

#### 现有表（可复用）

```sql
-- 文件: dcf-light-bot/src/infrastructure/persistence/DatabaseSchema.js:110-133
-- 已存在，字段足够覆盖模型元信息
CREATE TABLE IF NOT EXISTS llm_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT UNIQUE NOT NULL,         -- 对应 claw-farm modelEntry.ID，如 "mcs-5"
    description TEXT,
    provider_type TEXT NOT NULL,               -- 对应 claw-farm provider 前缀，如 "anthropic", "qwen"
    protocol_type TEXT NOT NULL,               -- 对应 "anthropic-messages" 或 "openai-completions"
    base_url TEXT NOT NULL,                    -- 对应 providerBase.baseUrl
    provider_model_name TEXT,                  -- provider 侧的模型名，可选
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
```

#### 需新增表：模型能力定义

```sql
-- 新增表：模型能力参数（claw-farm 中的 modelEntry 结构体）
CREATE TABLE IF NOT EXISTS llm_model_capabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,                -- FK -> llm_models.id
    context_window INTEGER NOT NULL DEFAULT 60000,   -- 上下文窗口 token 数
    max_tokens INTEGER NOT NULL DEFAULT 8192,         -- 最大输出 token 数
    input_modalities TEXT NOT NULL DEFAULT '["text"]', -- JSON 数组，如 ["text"] 或 ["text","image"]
    is_default_chat INTEGER NOT NULL DEFAULT 0,        -- 是否默认对话模型
    is_default_image INTEGER NOT NULL DEFAULT 0,       -- 是否默认图片模型
    is_default_vlm INTEGER NOT NULL DEFAULT 0,         -- 是否默认视觉语言模型
    is_embedding INTEGER NOT NULL DEFAULT 0,           -- 是否嵌入模型
    embedding_dimension INTEGER,                        -- 嵌入维度（仅嵌入模型）
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (model_id) REFERENCES llm_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_model_caps_model_id ON llm_model_capabilities(model_id);
CREATE INDEX IF NOT EXISTS idx_model_caps_defaults ON llm_model_capabilities(is_default_chat, is_default_image, is_default_vlm);
```

#### 需新增表：模型路由规则

```sql
-- 新增表：模型到 Provider 的路由规则（替代 claw-farm resolveModelRef 硬编码）
CREATE TABLE IF NOT EXISTS llm_model_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_pattern TEXT NOT NULL,              -- 前缀匹配模式，如 "mcs", "mco", "mch"
    match_type TEXT NOT NULL DEFAULT 'prefix', -- prefix | exact | regex
    provider_name TEXT NOT NULL,              -- 目标 provider 名，如 "litellm-am"
    api_format TEXT NOT NULL,                 -- API 格式，如 "anthropic-messages"
    priority INTEGER NOT NULL DEFAULT 100,    -- 优先级，数字越小越优先
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_model_routes_active ON llm_model_routes(is_active, priority);
```

### 2.3 初始化数据（对应 claw-farm 硬编码值）

```javascript
// 应写入 dcf-light-bot/src/infrastructure/persistence/DatabaseSchema.js 的默认数据

const DEFAULT_LLM_MODELS = [
  // litellm-am Provider 下的模型（Anthropic Messages 格式）
  { display_name: 'mcs-5',  provider_type: 'anthropic', protocol_type: 'anthropic-messages',
    base_url: 'https://kspmas.ksyun.com', description: 'Claude Sonnet 5' },
  { display_name: 'mco-4',  provider_type: 'anthropic', protocol_type: 'anthropic-messages',
    base_url: 'https://kspmas.ksyun.com', description: 'Claude Opus 4' },
  { display_name: 'mcs-1',  provider_type: 'anthropic', protocol_type: 'anthropic-messages',
    base_url: 'https://kspmas.ksyun.com', description: 'Claude Sonnet 1' },
  { display_name: 'mch-1',  provider_type: 'anthropic', protocol_type: 'anthropic-messages',
    base_url: 'https://kspmas.ksyun.com', description: 'Claude Haiku 1' },

  // litellm-oc Provider 下的模型（OpenAI Completions 格式）
  { display_name: 'qwen-plus-latest',    provider_type: 'qwen',    protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'Qwen Plus Latest' },
  { display_name: 'qwen-max-latest',     provider_type: 'qwen',    protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'Qwen Max Latest' },
  { display_name: 'qwen3-235b-a22b',     provider_type: 'qwen',    protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'Qwen3 235B A22B' },
  { display_name: 'qwen-vl-max-latest',  provider_type: 'qwen',    protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'Qwen VL Max Latest (多模态)' },
  { display_name: 'mgg-9',               provider_type: 'google',   protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'Gemini 9' },
  { display_name: 'text-embedding-v3',    provider_type: 'dashscope', protocol_type: 'openai-completions',
    base_url: 'https://kspmas.ksyun.com', description: 'DashScope 文本嵌入 v3' },
];

const DEFAULT_MODEL_CAPABILITIES = [
  // Anthropic 系列
  { display_name: 'mcs-5',  context_window: 60000,  max_tokens: 8192, input_modalities: '["text"]',
    is_default_chat: 1 },
  { display_name: 'mco-4',  context_window: 200000, max_tokens: 8192, input_modalities: '["text"]' },
  { display_name: 'mcs-1',  context_window: 60000,  max_tokens: 8192, input_modalities: '["text"]' },
  { display_name: 'mch-1',  context_window: 60000,  max_tokens: 8192, input_modalities: '["text"]' },
  // Qwen / Google 系列
  { display_name: 'qwen-plus-latest',   context_window: 128000, max_tokens: 8192, input_modalities: '["text"]' },
  { display_name: 'qwen-max-latest',    context_window: 128000, max_tokens: 8192, input_modalities: '["text"]' },
  { display_name: 'qwen3-235b-a22b',    context_window: 128000, max_tokens: 8192, input_modalities: '["text"]' },
  { display_name: 'qwen-vl-max-latest', context_window: 128000, max_tokens: 8192, input_modalities: '["text","image"]',
    is_default_vlm: 1 },
  { display_name: 'mgg-9',              context_window: 128000, max_tokens: 8192, input_modalities: '["text","image"]' },
  // 嵌入模型
  { display_name: 'text-embedding-v3',  context_window: 8192, max_tokens: 0, input_modalities: '["text"]',
    is_embedding: 1, embedding_dimension: 1024 },
];

const DEFAULT_MODEL_ROUTES = [
  { match_pattern: 'mcs', match_type: 'prefix', provider_name: 'litellm-am', api_format: 'anthropic-messages', priority: 10 },
  { match_pattern: 'mco', match_type: 'prefix', provider_name: 'litellm-am', api_format: 'anthropic-messages', priority: 10 },
  { match_pattern: 'mch', match_type: 'prefix', provider_name: 'litellm-am', api_format: 'anthropic-messages', priority: 10 },
  // 默认路由（所有其他模型走 openai-completions）
  { match_pattern: '*',   match_type: 'prefix', provider_name: 'litellm-oc', api_format: 'openai-completions', priority: 999 },
];
```

### 2.4 管理 API 契约

#### 模型 CRUD

```
GET    /api/admin/models                   模型列表（含能力参数）
POST   /api/admin/models                   新增模型
GET    /api/admin/models/:id               模型详情
POST   /api/admin/models/:id               更新模型
POST   /api/admin/models/:id/delete        删除模型
POST   /api/admin/models/:id/toggle        启用/禁用

GET    /api/admin/models/defaults           查看 3 个默认模型
POST   /api/admin/models/defaults           设置默认模型（chat/image/vlm）
```

**请求示例 — 新增模型：**
```json
POST /api/admin/models
{
  "display_name": "deepseek-v3",
  "description": "DeepSeek V3",
  "provider_type": "deepseek",
  "protocol_type": "openai-completions",
  "base_url": "https://kspmas.ksyun.com",
  "context_window": 128000,
  "max_tokens": 8192,
  "input_modalities": ["text"],
  "is_active": true
}
```

**响应示例 — 模型列表：**
```json
GET /api/admin/models
{
  "models": [
    {
      "id": 1,
      "display_name": "mcs-5",
      "description": "Claude Sonnet 5",
      "provider_type": "anthropic",
      "protocol_type": "anthropic-messages",
      "base_url": "https://kspmas.ksyun.com",
      "is_active": true,
      "capabilities": {
        "context_window": 60000,
        "max_tokens": 8192,
        "input_modalities": ["text"],
        "is_default_chat": true,
        "is_default_image": false,
        "is_default_vlm": false
      }
    }
  ],
  "total": 10
}
```

#### 路由规则 CRUD

```
GET    /api/admin/model-routes              路由规则列表
POST   /api/admin/model-routes              新增路由规则
POST   /api/admin/model-routes/:id          更新
POST   /api/admin/model-routes/:id/delete   删除
```

#### 配置导出 API（供 claw-farm 消费）

```
GET    /api/control/config/models           导出完整模型配置（claw-farm 调用）
```

**响应格式（直接生成 openclaw.json 的 models.providers 段）：**
```json
{
  "providers": {
    "litellm-am": {
      "api": "anthropic-messages",
      "models": [
        { "id": "mcs-5", "name": "mcs-5", "contextWindow": 60000, "maxTokens": 8192, "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 } }
      ]
    },
    "litellm-oc": {
      "api": "openai-completions",
      "models": [...]
    }
  },
  "defaults": {
    "chat": "litellm-am/mcs-5",
    "image": "litellm-oc/mgg-5",
    "vlm": "litellm-oc/qwen-vl-max-latest"
  },
  "allowedModels": ["mcs-5", "mco-4", "mcs-1", "mch-1", "mgg-9", "qwen-plus-latest", ...],
  "routes": [
    { "pattern": "mcs", "type": "prefix", "provider": "litellm-am" },
    { "pattern": "mco", "type": "prefix", "provider": "litellm-am" },
    { "pattern": "mch", "type": "prefix", "provider": "litellm-am" },
    { "pattern": "*",   "type": "prefix", "provider": "litellm-oc" }
  ]
}
```

### 2.5 实现要点

1. **模型管理页面**：dcf-light-bot 已有 `ai-gateway.js`（admin-ui）和 `adminCompatAIGateway.js`（路由），需在现有页面增加"模型能力参数"编辑表单
2. **配置导出逻辑**：新增 route handler，聚合 `llm_models` + `llm_model_capabilities` + `llm_model_routes` 三表数据，输出 claw-farm 可直接消费的 JSON
3. **resolveModelRef 替代**：导出 API 中根据 `llm_model_routes` 表的规则动态计算模型→provider 映射，替代硬编码的前缀匹配

---

## 3. 内容模板管理模块

### 3.1 当前硬编码分析

claw-farm 中有 4 个大型 Markdown heredoc 模板，全部内嵌在 Go 代码的 `buildPodWithInit()` 方法中：

| 模板 | 位置 | 行数 | 用途 |
|------|------|------|------|
| AGENTS.md | manager.go:634-725 | ~90 行 | Agent 行为规范：Session 启动流程、记忆系统、文件发送、安全规范 |
| TOOLS.md | manager.go:727-843 | ~115 行 | 工具文档：运行时环境、消息发送指南、Skill 用法表、会议室速查表 |
| BOOTSTRAP.md | manager.go:845-1006 | ~160 行 | 新用户引导流程：7 个步骤的完整对话脚本 |
| read-cloud-doc SKILL.md | manager.go:1008-1029 | ~20 行 | 云文档读取技能描述 |

#### AGENTS.md 关键结构

```markdown
# AGENTS.md - Your Workspace
## Every Session
### Bootstrap Check
  - 检测 IDENTITY.md 是否存在
  - 不存在 → 读 BOOTSTRAP.md 执行引导
  - 存在 → Normal Session Start
### Normal Session Start
  1. Read SOUL.md
  2. Read USER.md
  3. Read memory/YYYY-MM-DD.md
  4. If MAIN SESSION: Read MEMORY.md
## Memory（4 层记忆系统）
  - MEMORY.md（索引）
  - memory/projects.md（项目）
  - memory/lessons.md（经验教训）
  - memory/YYYY-MM-DD.md（日志）
## Sending Files & Media
## Safety
## Group Chats
## Tools
```

#### TOOLS.md 关键结构

```markdown
# TOOLS.md
## Runtime（K8s Pod 环境信息）
## Sending Messages（消息发送方法）
## Pre-installed Skills（5 个预装 Skill 的用法表）
  - wps-cli: 日历/会议/邮件/文档/待办
  - ezone-cli: CI/CD/K8s/代码仓库
  - image-gen: 文生图
  - read-cloud-doc: 云文档读取
  - clawhub-cli: Skill 管理
## Meeting Rooms（北京小米科技园 6-11 层会议室速查表）
  - 每层 level_id + 会议室名/容量/主题
  - 预订流程（一键 + 手动）
  - 避坑点（参数格式差异、B 开头房间跳过等）
## Time Formats（WPS API 时间格式约定）
```

#### BOOTSTRAP.md 关键结构（7 步引导流程）

```markdown
# BOOTSTRAP.md
## Step 1: 打招呼 + 收集信息
  - 获取工号 → 自我介绍 → 请用户起名字 + 告知称谓
## Step 2: 建立身份
  - 写 IDENTITY.md（Name/Emoji/Creature/Vibe/Avatar）
  - 写 USER.md（Name/Timezone）
## Step 3: WPS 授权
  - 验证授权状态 → 发授权链接 → 重试 3 次
  - 授权平台 URL: https://neo.ksyun.com/authorization
  - 用户手册: https://365.kdocs.cn/l/cpm3t4WLVCqj
## Step 4: 认领完成
  - 发送能力介绍消息
## Step 5: 写 SOUL.md
## Step 6: 次日主动问候（cron，可选）
## Step 7: 标记完成
  - 覆写 BOOTSTRAP.md 为 "BOOTSTRAP_COMPLETE"
## 重要提醒
  - 禁止向用户提及内部文件名
  - 尽量 3 轮对话内完成
```

### 3.2 数据模型设计

```sql
-- 新增表：内容模板
CREATE TABLE IF NOT EXISTS content_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_key TEXT UNIQUE NOT NULL,     -- 模板标识符，如 "agents_md", "tools_md", "bootstrap_md", "skill_read_cloud_doc"
    display_name TEXT NOT NULL,            -- 显示名称，如 "Agent 行为规范"
    description TEXT,                       -- 模板说明
    category TEXT NOT NULL DEFAULT 'instance_config', -- 分类: instance_config / skill / notification
    content TEXT NOT NULL,                 -- 模板内容（Markdown 文本）
    content_type TEXT NOT NULL DEFAULT 'markdown', -- markdown / json / shell
    variables TEXT,                         -- JSON: 模板中的变量占位符及其说明
    version INTEGER NOT NULL DEFAULT 1,    -- 版本号
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_templates_key ON content_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category);

-- 新增表：模板版本历史（可选，支持回滚）
CREATE TABLE IF NOT EXISTS content_template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changed_by TEXT,
    change_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (template_id) REFERENCES content_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tpl_versions_template ON content_template_versions(template_id, version DESC);
```

### 3.3 模板变量系统

模板中使用 `{{变量名}}` 占位符，claw-farm 在生成配置时替换为实际值。

| 模板 | 可用变量 | 来源 |
|------|---------|------|
| AGENTS.md | 无变量 | 静态模板 |
| TOOLS.md | `{{FARM_API_URL}}` | claw-farm 环境变量 FARM_API_URL |
| BOOTSTRAP.md | 无变量 | 静态模板（工号在运行时通过 exec 工具获取） |
| read-cloud-doc | `{{FARM_API_URL}}` | claw-farm 环境变量 FARM_API_URL |

`variables` 字段示例：
```json
{
  "FARM_API_URL": {
    "description": "Farm 服务 HTTP 地址，实例通过此地址调用 doc-content/doc-download API",
    "default": "http://claw-farm.claw-farm.svc:8080",
    "source": "env:FARM_API_URL"
  }
}
```

### 3.4 初始化数据

每个模板的完整内容应从 claw-farm manager.go 中的 heredoc 原样提取。由于篇幅限制，此处给出关键信息：

```javascript
const DEFAULT_CONTENT_TEMPLATES = [
  {
    template_key: 'agents_md',
    display_name: 'Agent 行为规范 (AGENTS.md)',
    description: '每个 OpenClaw 实例的核心行为规范，定义 Session 启动流程、记忆系统、文件发送指南和安全规范',
    category: 'instance_config',
    content: `/* 完整内容见 claw-farm/internal/instance/manager.go:634-725 */`,
    content_type: 'markdown',
    variables: '{}',
  },
  {
    template_key: 'tools_md',
    display_name: '工具文档 (TOOLS.md)',
    description: '运行时环境说明、消息发送指南、预装 Skill 用法表、会议室速查表',
    category: 'instance_config',
    content: `/* 完整内容见 claw-farm/internal/instance/manager.go:727-843 */`,
    content_type: 'markdown',
    variables: '{"FARM_API_URL":{"description":"Farm HTTP 地址","default":"http://claw-farm.claw-farm.svc:8080"}}',
  },
  {
    template_key: 'bootstrap_md',
    display_name: '新用户引导流程 (BOOTSTRAP.md)',
    description: '首次认领引导的 7 步对话脚本，含 WPS 授权、身份建立、能力介绍',
    category: 'instance_config',
    content: `/* 完整内容见 claw-farm/internal/instance/manager.go:845-1006 */`,
    content_type: 'markdown',
    variables: '{}',
  },
  {
    template_key: 'skill_read_cloud_doc',
    display_name: '云文档读取技能 (SKILL.md + shell)',
    description: '读取 WPS 云文档内容的技能描述和执行脚本',
    category: 'skill',
    content: `/* 完整内容见 claw-farm/internal/instance/manager.go:1008-1084 */`,
    content_type: 'markdown',
    variables: '{"FARM_API_URL":{"description":"Farm HTTP 地址","default":"http://claw-farm.claw-farm.svc:8080"}}',
  },
];
```

### 3.5 管理 API 契约

```
GET    /api/admin/templates                     模板列表
GET    /api/admin/templates/:key                模板详情（按 template_key）
POST   /api/admin/templates/:key                更新模板内容
GET    /api/admin/templates/:key/versions       版本历史
POST   /api/admin/templates/:key/rollback       回滚到指定版本

GET    /api/control/config/templates            导出全部活跃模板（claw-farm 调用）
GET    /api/control/config/templates/:key       导出单个模板（claw-farm 调用）
```

**导出响应格式：**
```json
GET /api/control/config/templates/agents_md
{
  "template_key": "agents_md",
  "content": "# AGENTS.md - Your Workspace\n\nThis folder is home...",
  "content_type": "markdown",
  "version": 3,
  "variables": {}
}
```

---

## 4. Skill 管理模块

### 4.1 当前硬编码分析

claw-farm 有两个硬编码的 Skill 配置：

#### 预装 Skill 列表（manager.go:611-617）

```bash
# 文件: claw-farm/internal/instance/manager.go
# 行号: 611-617（pluginScript 中的 for 循环）
for slug in wps-cli ezone-cli clawhub-cli image-gen; do
  echo "  installing $slug ..."
  npx clawhub install "$slug" 2>/dev/null || echo "  $slug already installed, skipping"
done
```

4 个预装 Skill：`wps-cli`、`ezone-cli`、`clawhub-cli`、`image-gen`。

#### Skill 白名单（resources.go:350-364）

```go
// 文件: claw-farm/internal/instance/resources.go
// 行号: 350-364
"skills": map[string]interface{}{
    "allowBundled": []string{
        "healthcheck",
        "skill-creator",
        "mcporter",
        "weather",
        "summarize",
        "session-logs",
        "model-usage",
        "clawhub",
        "coding-agent",
        "github",
        "gh-issues",
        "blogwatcher",
        "trello",
    },
},
```

13 个白名单 Skill（这些是 OpenClaw 内置 Skill，允许在实例中使用）。

### 4.2 数据模型设计

```sql
-- 新增表：预装 Skill 列表
CREATE TABLE IF NOT EXISTS instance_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,          -- clawhub 上的 skill slug，如 "wps-cli"
    display_name TEXT NOT NULL,
    description TEXT,
    install_type TEXT NOT NULL DEFAULT 'clawhub', -- clawhub | bundled | custom
    is_pre_installed INTEGER NOT NULL DEFAULT 0,  -- 是否在实例创建时自动安装
    is_whitelisted INTEGER NOT NULL DEFAULT 0,    -- 是否在 openclaw.json allowBundled 白名单中
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instance_skills_type ON instance_skills(install_type);
```

### 4.3 初始化数据

```javascript
const DEFAULT_INSTANCE_SKILLS = [
  // 预装 Skill（clawhub install）
  { slug: 'wps-cli',      display_name: 'WPS 办公套件',  install_type: 'clawhub', is_pre_installed: 1, is_whitelisted: 0, sort_order: 1 },
  { slug: 'ezone-cli',    display_name: 'eZone CI/CD',   install_type: 'clawhub', is_pre_installed: 1, is_whitelisted: 0, sort_order: 2 },
  { slug: 'clawhub-cli',  display_name: 'ClawHub 管理',  install_type: 'clawhub', is_pre_installed: 1, is_whitelisted: 0, sort_order: 3 },
  { slug: 'image-gen',    display_name: '图片生成',       install_type: 'clawhub', is_pre_installed: 1, is_whitelisted: 0, sort_order: 4 },

  // 白名单内置 Skill（openclaw.json allowBundled）
  { slug: 'healthcheck',    display_name: '健康检查',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 10 },
  { slug: 'skill-creator',  display_name: 'Skill 创建器', install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 11 },
  { slug: 'mcporter',       display_name: 'MCP 工具桥',   install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 12 },
  { slug: 'weather',        display_name: '天气查询',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 13 },
  { slug: 'summarize',      display_name: '内容摘要',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 14 },
  { slug: 'session-logs',   display_name: '会话日志',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 15 },
  { slug: 'model-usage',    display_name: '模型用量',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 16 },
  { slug: 'clawhub',        display_name: 'ClawHub',      install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 17 },
  { slug: 'coding-agent',   display_name: '编码助手',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 18 },
  { slug: 'github',         display_name: 'GitHub',       install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 19 },
  { slug: 'gh-issues',      display_name: 'GitHub Issues', install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 20 },
  { slug: 'blogwatcher',    display_name: '博客监控',     install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 21 },
  { slug: 'trello',         display_name: 'Trello',       install_type: 'bundled', is_pre_installed: 0, is_whitelisted: 1, sort_order: 22 },
];
```

### 4.4 管理 API 契约

```
GET    /api/admin/instance-skills               Skill 列表
POST   /api/admin/instance-skills               新增 Skill
POST   /api/admin/instance-skills/:id           更新 Skill
POST   /api/admin/instance-skills/:id/delete    删除 Skill
POST   /api/admin/instance-skills/:id/toggle    启用/禁用

GET    /api/control/config/skills               导出 Skill 配置（claw-farm 调用）
```

**导出响应：**
```json
{
  "preInstalled": ["wps-cli", "ezone-cli", "clawhub-cli", "image-gen"],
  "allowBundled": ["healthcheck", "skill-creator", "mcporter", "weather", ...]
}
```

---

## 5. 系统消息文案管理模块

### 5.1 当前硬编码分析

claw-farm router.go 中散布 20+ 处中文硬编码文案，全量清单如下：

| 编号 | 位置 | 场景 | 当前文案 |
|------|------|------|---------|
| M-01 | router.go:128 | 白名单拒绝 | `"暂未开放，请联系管理员开通。"` |
| M-02 | router.go:230 | 实例启动中 | `"正在启动中，请稍候..."` |
| M-03 | router.go:354 | 重启成功 | `"正在重启，下次发消息时自动启动..."` |
| M-04 | router.go:362 | 无权限操作 | `"无权限：仅管理员可执行此操作。"` |
| M-05 | router.go:337 | 日志获取失败 | `"获取日志失败: " + err.Error()` |
| M-06 | manager.go:293 | 无实例日志 | `"实例未运行，无日志可查。"` |
| M-07 | manager.go:324 | 日志为空 | `"(日志为空)"` |
| M-08 | manager.go OnBeforeReap | 空闲回收 | `"长时间未使用，实例已休眠。下次发消息时会自动唤醒。"` |
| M-09 | router.go cmdHelp | 帮助信息 | 完整 /help 文案 |
| M-10 | router.go sendClawhubLoginLink | 未注册提示 | `"您尚未注册平台账号..."` |

### 5.2 数据模型设计

```sql
-- 新增表：系统消息文案
CREATE TABLE IF NOT EXISTS system_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_key TEXT UNIQUE NOT NULL,    -- 消息标识符，如 "whitelist_rejected", "instance_starting"
    display_name TEXT NOT NULL,          -- 管理界面显示名
    category TEXT NOT NULL DEFAULT 'system', -- 分类: system / error / notification / help
    content TEXT NOT NULL,               -- 消息内容（支持简单变量替换 {error}）
    locale TEXT NOT NULL DEFAULT 'zh-CN', -- 语言代码
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_messages_key ON system_messages(message_key);
CREATE INDEX IF NOT EXISTS idx_system_messages_locale ON system_messages(locale);
```

### 5.3 初始化数据

```javascript
const DEFAULT_SYSTEM_MESSAGES = [
  { message_key: 'whitelist_rejected',   display_name: '白名单拒绝', category: 'system',
    content: '暂未开放，请联系管理员开通。' },
  { message_key: 'instance_starting',    display_name: '实例启动中', category: 'system',
    content: '正在启动中，请稍候...' },
  { message_key: 'instance_restarting',  display_name: '实例重启中', category: 'system',
    content: '正在重启，下次发消息时自动启动...' },
  { message_key: 'no_permission',        display_name: '无权限',     category: 'system',
    content: '无权限：仅管理员可执行此操作。' },
  { message_key: 'log_fetch_failed',     display_name: '日志获取失败', category: 'error',
    content: '获取日志失败: {error}' },
  { message_key: 'no_instance_logs',     display_name: '无实例日志', category: 'system',
    content: '实例未运行，无日志可查。' },
  { message_key: 'empty_logs',           display_name: '日志为空',   category: 'system',
    content: '(日志为空)' },
  { message_key: 'idle_reaped',          display_name: '空闲回收',   category: 'notification',
    content: '长时间未使用，实例已休眠。下次发消息时会自动唤醒。' },
  { message_key: 'not_registered',       display_name: '未注册提示', category: 'system',
    content: '您尚未注册平台账号，请先完成注册。' },
  { message_key: 'restart_all_result',   display_name: '批量重启结果', category: 'system',
    content: '已重启 {count} 个实例。' },
];
```

### 5.4 管理 API 契约

```
GET    /api/admin/system-messages               文案列表
POST   /api/admin/system-messages/:key          更新文案
GET    /api/control/config/messages              导出全部文案（claw-farm 调用）
GET    /api/control/config/messages/:key         导出单条文案
```

---

## 6. 实例配置参数管理模块

### 6.1 当前硬编码分析

#### contextPruning 参数（resources.go:314-328）

```go
"contextPruning": map[string]interface{}{
    "mode":                  "cache-ttl",
    "ttl":                   "5m",
    "minPrunableToolChars":   2000,
    "keepLastAssistants":     10,
    "softTrim": map[string]interface{}{
        "maxChars":  2000,
        "headChars": 500,
        "tailChars": 500,
    },
    "hardClear": map[string]interface{}{
        "enabled":     true,
        "placeholder": "[Old tool result content cleared]",
    },
},
```

#### OpenViking 配置（resources.go:425-463）

```go
ovConf := map[string]interface{}{
    "storage": map[string]interface{}{
        "workspace": "/home/node/.openclaw/openviking-data",
    },
    "log": map[string]interface{}{
        "level":  "DEBUG",
        "output": "file",
    },
    "embedding": map[string]interface{}{
        "dense": map[string]interface{}{
            "provider":  "openai",
            "model":     "text-embedding-v3",
            "api_base":  modelBaseURL,
            "api_key":   modelAPIKey,
            "dimension": 1024,
        },
    },
    "vlm": map[string]interface{}{
        "provider": "openai",
        "model":    cfg.DefaultVLMModel,
        "api_base": modelBaseURL,
        "api_key":  modelAPIKey,
    },
}
```

#### 工具黑名单（resources.go:341-348）

```go
"tools": map[string]interface{}{
    "deny": []string{"group:web"},
    "web": map[string]interface{}{
        "fetch": map[string]interface{}{
            "enabled": false,
        },
    },
},
```

### 6.2 数据模型设计

使用已有的 `openclaw_configs` 表（DatabaseSchema.js:298-312）存储结构化 JSON 配置：

```sql
-- 已存在，config_plan 字段为 JSON 格式
CREATE TABLE IF NOT EXISTS openclaw_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    config_plan TEXT NOT NULL,      -- JSON 配置
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

默认配置的 `config_plan` JSON 结构：

```json
{
  "contextPruning": {
    "mode": "cache-ttl",
    "ttl": "5m",
    "minPrunableToolChars": 2000,
    "keepLastAssistants": 10,
    "softTrim": { "maxChars": 2000, "headChars": 500, "tailChars": 500 },
    "hardClear": { "enabled": true, "placeholder": "[Old tool result content cleared]" }
  },
  "openviking": {
    "mode": "local",
    "embeddingModel": "text-embedding-v3",
    "embeddingDimension": 1024,
    "autoCapture": true,
    "autoRecall": true,
    "captureMode": "semantic",
    "recallLimit": 6,
    "recallScoreThreshold": 0.15,
    "logLevel": "DEBUG"
  },
  "tools": {
    "deny": ["group:web"],
    "web": { "fetch": { "enabled": false } }
  },
  "logging": {
    "level": "debug",
    "consoleLevel": "debug",
    "consoleStyle": "json",
    "redactSensitive": "tools"
  },
  "compaction": {
    "reserveTokensFloor": 4000,
    "memoryFlush": { "enabled": true, "softThresholdTokens": 4000 }
  },
  "blockStreamingDefault": "on"
}
```

### 6.3 管理 API 契约

```
GET    /api/admin/openclaw-configs               配置列表
GET    /api/admin/openclaw-configs/default        默认配置
POST   /api/admin/openclaw-configs/default        更新默认配置
GET    /api/admin/openclaw-configs/:id            指定配置详情

GET    /api/control/config/openclaw-defaults      导出默认配置（claw-farm 调用）
```

---

## 7. 白名单与管理员管理模块

### 7.1 当前实现分析

#### 白名单（whitelist/store.go，99 行）

```sql
-- claw-farm MySQL 表
FarmWhitelist (emailPrefix VARCHAR(255) UNIQUE, addedBy VARCHAR(255), createdAt DATETIME)
```

当前通过 IM `/whitelist add/remove/list` 命令管理。管理后台应提供 Web 界面。

#### 管理员名单（config.go:63, 135, 183-190）

```go
// 当前: 环境变量 ADMIN_USER_IDS，逗号分隔
AdminUserIDs []string
// 加载: parseCSV(os.Getenv("ADMIN_USER_IDS"))
// 鉴权: IsAdmin() 遍历比较
```

**核心问题**：改管理员需要修改环境变量并重新部署。

### 7.2 数据模型设计

dcf-light-bot 已有 `users` + `user_roles` + `user_role_assignments` 表体系。白名单需新增表：

```sql
-- 新增表：IM 用户白名单（对应 claw-farm FarmWhitelist）
CREATE TABLE IF NOT EXISTS im_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_prefix TEXT UNIQUE NOT NULL,
    display_name TEXT,
    department TEXT,
    added_by TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_im_whitelist_prefix ON im_whitelist(email_prefix);
CREATE INDEX IF NOT EXISTS idx_im_whitelist_active ON im_whitelist(is_active);

-- 新增表：系统管理员（替代 ADMIN_USER_IDS 环境变量）
CREATE TABLE IF NOT EXISTS system_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_prefix TEXT UNIQUE NOT NULL,
    admin_level TEXT NOT NULL DEFAULT 'admin',  -- super_admin / admin
    display_name TEXT,
    added_by TEXT NOT NULL DEFAULT 'system',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_admins_prefix ON system_admins(email_prefix);
```

### 7.3 管理 API 契约

```
GET    /api/admin/whitelist                      白名单列表（支持分页、搜索）
POST   /api/admin/whitelist                      批量添加
POST   /api/admin/whitelist/:id/delete           删除
POST   /api/admin/whitelist/import               CSV 批量导入

GET    /api/admin/system-admins                  管理员列表
POST   /api/admin/system-admins                  新增管理员
POST   /api/admin/system-admins/:id/delete       删除管理员

GET    /api/control/config/whitelist             导出白名单（claw-farm 调用）
GET    /api/control/config/admins                导出管理员列表（claw-farm 调用）
```

---

## 8. 实例运行参数管理模块

### 8.1 当前环境变量分析

以下参数当前通过环境变量配置，应迁移到管理后台：

| 参数 | 环境变量 | 默认值 | 位置 |
|------|---------|--------|------|
| 最大实例数 | MAX_INSTANCES | 100 | config.go:112 |
| 空闲超时 | IDLE_TIMEOUT | 7200 | config.go:113 |
| 消息队列超时 | MSG_QUEUE_TIMEOUT | 300 | config.go:114 |
| Pod CPU Request | POD_CPU_REQUEST | 1000m | config.go:93 |
| Pod CPU Limit | POD_CPU_LIMIT | 2000m | config.go:94 |
| Pod Memory Request | POD_MEMORY_REQUEST | 2Gi | config.go:95 |
| Pod Memory Limit | POD_MEMORY_LIMIT | 2Gi | config.go:96 |
| PVC 存储大小 | PVC_STORAGE_SIZE | 1Gi | config.go:92 |
| StorageClass | STORAGE_CLASS | dcf-juicefs-sc | config.go:91 |
| OpenClaw 镜像 | OPENCLAW_IMAGE | hub-vpc-cn-beijing-6.kce.ksyun.com/dcf_dev/openclaw:dcf-2026.3.8 | config.go:87 |

### 8.2 使用 system_configs 表

dcf-light-bot 已有 `system_configs` 表（key-value 结构），适合存储这些运行参数：

```javascript
const CLAW_FARM_RUNTIME_CONFIGS = {
  'claw_farm.max_instances': '100',
  'claw_farm.idle_timeout': '7200',
  'claw_farm.msg_queue_timeout': '300',
  'claw_farm.pod_cpu_request': '1000m',
  'claw_farm.pod_cpu_limit': '2000m',
  'claw_farm.pod_memory_request': '2Gi',
  'claw_farm.pod_memory_limit': '2Gi',
  'claw_farm.pvc_storage_size': '1Gi',
  'claw_farm.storage_class': 'dcf-juicefs-sc',
  'claw_farm.openclaw_image': 'hub-vpc-cn-beijing-6.kce.ksyun.com/dcf_dev/openclaw:dcf-2026.3.8',
};
```

### 8.3 管理 API 契约

```
GET    /api/admin/runtime-config                 运行参数列表
POST   /api/admin/runtime-config                 批量更新参数
GET    /api/control/config/runtime               导出运行参数（claw-farm 调用）
```

---

## 9. 配置导出统一入口

### 9.1 总览 API

claw-farm 需要一个统一的配置拉取入口：

```
GET    /api/control/config/full                  导出完整配置（一次拉取全部）
```

**响应结构：**
```json
{
  "version": "2026-04-15T10:00:00Z",
  "models": { /* 模型配置，同 /api/control/config/models */ },
  "templates": { /* 模板配置，同 /api/control/config/templates */ },
  "skills": { /* Skill 配置，同 /api/control/config/skills */ },
  "messages": { /* 系统消息，同 /api/control/config/messages */ },
  "openclawDefaults": { /* OpenClaw 默认配置 */ },
  "runtime": { /* 运行参数 */ },
  "whitelist": { /* 白名单 */ },
  "admins": { /* 管理员列表 */ }
}
```

### 9.2 认证方式

Control Plane API 使用 `Authorization: Bearer <JWT>` 认证，与现有 dcf-light-bot 认证体系一致。claw-farm 使用一个 service account JWT 长期令牌调用。

---

## 10. 与现有 dcf-light-bot 代码的集成点

### 10.1 需修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/infrastructure/persistence/DatabaseSchema.js` | 新增 4 张表 DDL + 默认数据 |
| `src/interfaces/http/routes/adminCompat.js` | 注册新的 admin 路由 |
| `src/interfaces/http/routes/adminCompatAIGateway.js` | 扩展模型管理路由 |
| `src/interfaces/http/router.js` | 注册 control config 导出路由 |
| `src/interfaces/http/admin-ui/ai-gateway.js` | 增加模型能力参数编辑 UI |

### 10.2 需新增的文件

| 文件 | 职责 |
|------|------|
| `src/interfaces/http/routes/controlConfig.js` | 配置导出 API（供 claw-farm 消费） |
| `src/interfaces/http/routes/adminCompatTemplates.js` | 模板管理路由 |
| `src/interfaces/http/routes/adminCompatSkillConfig.js` | Skill 配置管理路由 |
| `src/interfaces/http/routes/adminCompatMessages.js` | 系统消息管理路由 |
| `src/interfaces/http/admin-ui/templates.js` | 模板管理 UI 页面 |
| `src/interfaces/http/admin-ui/system-messages.js` | 系统消息管理 UI 页面 |
| `src/interfaces/http/admin-ui/instance-skills.js` | Skill 配置管理 UI 页面 |

---

## 11. 管理页面 UI 规范

所有新增页面遵循 dcf-light-bot admin-console 现有架构规范：

- **MPA + IIFE 模式**：每个页面一个独立 JS 文件
- **无构建步骤**：原生 JS + CSS，直接由 Express 静态服务
- **卡片风格**：`border-radius: 14px; border: 1px solid #ededf2; background: #fff; padding: 20px 24px;`
- **列表布局**：`section.card > div.section-head + div.filter-toolbar + div.table-wrap > table`
- **权限门控**：通过 `adminAuth` 中间件 + RBAC 权限检查
- **文件上限**：单文件不超过 1000 行

参考现有实现：
- 列表页参考 `admin-ui/employees.js`
- 表单渲染参考 `admin-ui/employee-form-renderer.js`
- 抽屉交互参考 `admin-ui/employee-detail-renderer.js`
