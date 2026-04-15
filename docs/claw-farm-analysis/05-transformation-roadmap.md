# Claw Farm 改造路线图 — 可执行规格书

> 版本 1.0 | 2026-04-15
> 目标读者：dcf-light-bot 项目开发者（无需 claw-farm 上下文）
> 前置文档：01-project-audit.md, 02-feature-abstraction.md, 03-admin-console-plan.md, 04-multi-tenant-architecture.md

本文档定义 claw-farm 配置外部化和多租户改造的分阶段实施计划。每个阶段包含：
- 具体交付物（表、API、UI 页面）
- 涉及的 dcf-light-bot 文件（新增 / 修改）
- 涉及的 claw-farm 文件（改造点）
- 依赖关系和验收标准

---

## 阶段总览

| 阶段 | 名称 | 核心目标 | 预估工作量 | 依赖 |
|------|------|---------|----------|------|
| **P0** | 数据模型基础 | 新增数据库表 + 默认数据 | 3-5 天 | 无 |
| **P1** | 管理后台 MVP | 模型/模板/Skill/消息管理 UI + API | 3-4 周 | P0 |
| **P2** | 配置分发对接 | claw-farm 从 API 拉取配置替代硬编码 | 2-3 周 | P1 |
| **P3** | 多租户基础 | 租户配置表 + 租户管理 API | 3-4 周 | P1 |
| **P4** | 租户运营平台 | 租户自助管理 UI + Webhook 路由多租户改造 | 3-4 周 | P3 |

```
P0 ──▶ P1 ──▶ P2 ──▶ (上线，单租户可管理)
              │
              └──▶ P3 ──▶ P4 ──▶ (多租户上线)
```

---

## P0: 数据模型基础（3-5 天）

### 目标

在 dcf-light-bot 数据库中创建所有需要的表和默认数据，不涉及 UI 或 API。

### 交付物

#### 新增数据库表（8 张）

| 表名 | 用途 | 定义文档位置 |
|------|------|------------|
| `llm_model_capabilities` | 模型能力参数 | 03-admin-console-plan.md §2.2 |
| `llm_model_routes` | 模型路由规则 | 03-admin-console-plan.md §2.2 |
| `content_templates` | 内容模板 | 03-admin-console-plan.md §3.2 |
| `content_template_versions` | 模板版本历史 | 03-admin-console-plan.md §3.2 |
| `instance_skills` | 预装/白名单 Skill | 03-admin-console-plan.md §4.2 |
| `system_messages` | 系统消息文案 | 03-admin-console-plan.md §5.2 |
| `im_whitelist` | IM 用户白名单 | 03-admin-console-plan.md §7.2 |
| `system_admins` | 系统管理员 | 03-admin-console-plan.md §7.2 |

#### dcf-light-bot 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `src/infrastructure/persistence/DatabaseSchema.js` | 在 `ALL_TABLES_SQL` 中追加 8 张表 DDL；新增 DEFAULT_MODEL_CAPABILITIES / DEFAULT_MODEL_ROUTES / DEFAULT_CONTENT_TEMPLATES / DEFAULT_INSTANCE_SKILLS / DEFAULT_SYSTEM_MESSAGES 默认数据 |
| **修改** | `src/infrastructure/persistence/SqliteStore.js` | 在 `initialize()` 中执行新表创建和默认数据插入 |

#### 默认数据（完整值见 03-admin-console-plan.md）

- 10 个模型的能力参数（从 claw-farm resources.go:256-270 提取）
- 4 条路由规则（mcs→litellm-am, mco→litellm-am, mch→litellm-am, *→litellm-oc）
- 4 个内容模板（AGENTS.md, TOOLS.md, BOOTSTRAP.md, read-cloud-doc）
- 17 个 Skill 配置（4 预装 + 13 白名单）
- 10 条系统消息文案
- claw-farm 运行参数写入 `system_configs` 表

#### 验收标准

- [ ] `npm test` 全量通过（50 suites / 185 tests）
- [ ] 数据库启动后 8 张新表存在且有默认数据
- [ ] 现有功能不受影响（无破坏性变更）

---

## P1: 管理后台 MVP（3-4 周）

### 目标

管理员通过 Web 界面管理模型、模板、Skill、消息文案，替代 claw-farm 中的硬编码修改。

### P1-W1: 模型管理（第 1 周）

#### 交付物

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `src/interfaces/http/routes/adminCompatAIGateway.js` | 扩展现有 AI Gateway 路由，增加模型能力参数 CRUD、路由规则 CRUD、默认模型设置 |
| **修改** | `src/interfaces/http/admin-ui/ai-gateway.js` | 在现有 AI Gateway 页面增加"模型能力"编辑区域和"路由规则"管理 Tab |
| **新增** | `src/interfaces/http/routes/controlConfig.js` | 配置导出 API：`GET /api/control/config/models`，输出 claw-farm 可消费的 JSON |
| **修改** | `src/interfaces/http/router.js` | 注册 controlConfig 路由 |

#### API 端点（详见 03-admin-console-plan.md §2.4）

```
GET/POST   /api/admin/models                   模型 CRUD
GET/POST   /api/admin/models/:id               模型详情/更新
POST       /api/admin/models/:id/toggle        启用/禁用
GET/POST   /api/admin/models/defaults           默认模型
GET/POST   /api/admin/model-routes              路由规则 CRUD
GET        /api/control/config/models           配置导出
```

#### 验收标准

- [ ] 管理界面可 CRUD 模型（增删改查 + 启用禁用）
- [ ] 可编辑模型能力参数（contextWindow, maxTokens, inputModalities）
- [ ] 可管理路由规则（前缀匹配 → provider 映射）
- [ ] 可设置 3 个默认模型（chat/image/vlm）
- [ ] `/api/control/config/models` 返回完整的 providers JSON
- [ ] 导出的 JSON 结构与 claw-farm resources.go:272-281 中的 providers 格式一致

### P1-W2: 模板管理（第 2 周）

#### 交付物

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/interfaces/http/routes/adminCompatTemplates.js` | 模板管理路由：列表、详情、更新、版本历史、回滚 |
| **新增** | `src/interfaces/http/admin-ui/templates.js` | 模板管理 UI 页面：Markdown 编辑器 + 预览 + 版本对比 |
| **修改** | `src/interfaces/http/routes/adminCompat.js` | 注册模板管理路由 |
| **修改** | `src/interfaces/http/routes/controlConfig.js` | 增加 `GET /api/control/config/templates` 和 `GET /api/control/config/templates/:key` |

#### API 端点（详见 03-admin-console-plan.md §3.5）

```
GET        /api/admin/templates                     模板列表
GET        /api/admin/templates/:key                模板详情
POST       /api/admin/templates/:key                更新模板
GET        /api/admin/templates/:key/versions       版本历史
POST       /api/admin/templates/:key/rollback       回滚
GET        /api/control/config/templates             导出全部模板
GET        /api/control/config/templates/:key        导出单个模板
```

#### 验收标准

- [ ] 管理界面可编辑 4 个模板内容
- [ ] 每次编辑自动保存版本历史
- [ ] 可回滚到历史版本
- [ ] 模板内容支持变量占位符 `{{FARM_API_URL}}`
- [ ] 模板的导出内容与 claw-farm manager.go 中的 heredoc 格式一致

### P1-W3: Skill 配置 + 系统消息管理（第 3 周）

#### 交付物

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/interfaces/http/routes/adminCompatSkillConfig.js` | Skill 配置管理路由 |
| **新增** | `src/interfaces/http/admin-ui/instance-skills.js` | Skill 管理 UI（列表 + 启用禁用 + 预装/白名单勾选） |
| **新增** | `src/interfaces/http/routes/adminCompatMessages.js` | 系统消息管理路由 |
| **新增** | `src/interfaces/http/admin-ui/system-messages.js` | 系统消息管理 UI（列表 + 内联编辑） |
| **修改** | `src/interfaces/http/routes/adminCompat.js` | 注册两个新路由模块 |
| **修改** | `src/interfaces/http/routes/controlConfig.js` | 增加 `GET /api/control/config/skills` 和 `GET /api/control/config/messages` |

#### 验收标准

- [ ] 管理界面可管理预装 Skill（增删 + 排序）
- [ ] 管理界面可管理白名单 Skill（勾选 + 取消）
- [ ] 管理界面可编辑所有系统消息文案
- [ ] Skill 导出格式与 claw-farm 的 `pluginScript` for 循环和 `allowBundled` 数组一致
- [ ] 消息导出为 key→content 映射

### P1-W4: 白名单 + 管理员 + 运行参数 + 统一导出（第 4 周）

#### 交付物

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/interfaces/http/routes/adminCompatWhitelist.js` | 白名单管理路由（含批量导入） |
| **新增** | `src/interfaces/http/routes/adminCompatSystemAdmins.js` | 管理员管理路由 |
| **修改** | `src/interfaces/http/routes/controlConfig.js` | 增加 `GET /api/control/config/full`（统一导出全部配置） |
| **修改** | `src/interfaces/http/admin-ui/auth-members.js` | 扩展成员管理，增加白名单和管理员管理 Tab |

#### 统一导出 API

```
GET /api/control/config/full
```

响应包含完整的配置树（详见 03-admin-console-plan.md §9.1）：models + templates + skills + messages + openclawDefaults + runtime + whitelist + admins。

#### 验收标准

- [ ] `/api/control/config/full` 返回完整配置
- [ ] 白名单支持 CSV 批量导入
- [ ] 管理员列表可 Web 管理（不再依赖环境变量）
- [ ] 运行参数（MAX_INSTANCES, IDLE_TIMEOUT 等）可在 Web 界面调整

---

## P2: 配置分发对接（2-3 周）

### 目标

claw-farm 改造为从 dcf-light-bot API 拉取配置，替代硬编码。此阶段主要改 claw-farm Go 代码。

### P2-W1: 配置客户端（第 1 周）

#### claw-farm 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `internal/configapi/client.go` | HTTP 客户端，调用 dcf-light-bot 的 `/api/control/config/*` API |
| **新增** | `internal/configapi/types.go` | API 响应类型定义 |
| **新增** | `internal/configapi/cache.go` | 内存缓存（TTL 5 分钟） |
| **修改** | `cmd/farm/main.go` | 启动时初始化 configapi client |
| **修改** | `internal/config/config.go` | 新增 `CONTROL_PLANE_URL` 和 `CONTROL_PLANE_TOKEN` 环境变量 |

#### 配置拉取逻辑

```go
// 新文件: internal/configapi/client.go
type Client struct {
    baseURL string
    token   string
    cache   *sync.Map  // key -> cachedEntry
    ttl     time.Duration
}

type FullConfig struct {
    Models          ModelsConfig          `json:"models"`
    Templates       map[string]Template   `json:"templates"`
    Skills          SkillsConfig          `json:"skills"`
    Messages        map[string]string     `json:"messages"`
    OpenClawDefaults map[string]interface{} `json:"openclawDefaults"`
    Runtime         map[string]string     `json:"runtime"`
    Whitelist       []string              `json:"whitelist"`
    Admins          []string              `json:"admins"`
}

func (c *Client) GetFullConfig() (*FullConfig, error) {
    // 1. 检查缓存
    // 2. 缓存命中且未过期 → 返回
    // 3. 缓存 miss → HTTP GET /api/control/config/full
    // 4. 更新缓存
    // 5. API 失败 → 返回上一份有效缓存（降级）
}
```

### P2-W2: 模型配置替换（第 2 周）

#### claw-farm 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `internal/instance/resources.go` | `OpenClawConfig()` 从 API 获取模型列表，替代硬编码的 amModels/ocModels |
| **修改** | `internal/instance/resources.go` | `resolveModelRef()` 从 API 获取路由规则，替代硬编码的前缀匹配 |
| **修改** | `internal/config/config.go` | `Load()` 中的 extraModels 数组改为从 API 获取，保留 fallback |

**改造前后对比 — resources.go OpenClawConfig()：**

```go
// ===== 改造前（resources.go:256-281）=====
amModels := []modelEntry{
    {ID: "mcs-5", ContextWindow: 60000, MaxTokens: 8192, Input: []string{"text"}},
    // ... 硬编码
}
providers := map[string]interface{}{
    "litellm-am": mergeMap(providerBase, map[string]interface{}{
        "api":    "anthropic-messages",
        "models": mapModels(amModels),
    }),
    // ...
}

// ===== 改造后 =====
func OpenClawConfig(cfg *config.Config, userID string, override *ModelOverride, apiCfg *configapi.FullConfig) ([]byte, error) {
    providers := apiCfg.Models.Providers  // 直接使用 API 返回的 providers
    if providers == nil {
        // fallback: 使用当前硬编码（向后兼容）
        providers = buildHardcodedProviders(cfg, override)
    }
    // ...
}
```

### P2-W3: 模板 + Skill + 消息替换（第 3 周）

#### claw-farm 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `internal/instance/manager.go` | `buildPodWithInit()` 中的 heredoc 模板改为从 API 获取 |
| **修改** | `internal/instance/manager.go` | `pluginScript` 中的 Skill 安装列表改为从 API 获取 |
| **修改** | `internal/router/router.go` | 系统消息文案改为从 API 获取 |
| **修改** | `internal/whitelist/store.go` | 白名单查询增加 API 数据源 |
| **修改** | `internal/config/config.go` | 管理员列表改为从 API 获取 |

**改造前后对比 — manager.go 模板写入：**

```go
// ===== 改造前（manager.go:634-725）=====
configScript := fmt.Sprintf(`
cat > /config/workspace/AGENTS.md << 'AGENTSEOF'
# AGENTS.md - Your Workspace
... 90 行硬编码 Markdown ...
AGENTSEOF
`, ...)

// ===== 改造后 =====
agentsMD := m.apiConfig.Templates["agents_md"].Content
if agentsMD == "" {
    agentsMD = defaultAgentsMD  // fallback 到硬编码
}
configScript := fmt.Sprintf(`
cat > /config/workspace/AGENTS.md << 'AGENTSEOF'
%s
AGENTSEOF
`, agentsMD, ...)
```

**改造前后对比 — router.go 系统消息：**

```go
// ===== 改造前（router.go:128）=====
go r.wps.SendText(msg.ChatID, "暂未开放，请联系管理员开通。")

// ===== 改造后 =====
text := r.getMessage("whitelist_rejected")  // 从 API 配置获取，fallback 到硬编码
go r.wps.SendText(msg.ChatID, text)

func (r *Router) getMessage(key string) string {
    if r.apiConfig != nil {
        if msg, ok := r.apiConfig.Messages[key]; ok {
            return msg
        }
    }
    return defaultMessages[key]  // 硬编码 fallback
}
```

#### 验收标准

- [ ] claw-farm 启动时成功拉取 dcf-light-bot 配置
- [ ] 在管理后台修改模型列表后，新创建的实例使用新配置
- [ ] 在管理后台修改模板后，新创建的实例使用新模板
- [ ] API 不可用时 claw-farm 使用缓存/硬编码 fallback 正常运行
- [ ] 现有用户的实例不受影响

---

## P3: 多租户基础（3-4 周）

### 目标

dcf-light-bot 支持按租户隔离配置，提供租户配置管理 API。

### P3-W1: 多租户数据表（第 1 周）

#### dcf-light-bot 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `src/infrastructure/persistence/DatabaseSchema.js` | 新增 7 张租户配置表（详见 04-multi-tenant-architecture.md §2） |
| **修改** | `src/infrastructure/persistence/SqliteStore.js` | 执行新表创建 |

#### 新增表汇总

| 表名 | 用途 | 定义文档 |
|------|------|---------|
| `tenant_channels` | 租户 Channel 凭证 | 04 §2.1 |
| `tenant_model_quotas` | 租户模型配额 | 04 §2.2 |
| `tenant_instance_profiles` | 租户实例资源 Profile | 04 §2.3 |
| `tenant_templates` | 租户模板覆写 | 04 §2.4 |
| `tenant_skills` | 租户 Skill 绑定 | 04 §2.5 |
| `tenant_whitelist` | 租户白名单 | 04 §2.6 |
| `tenant_messages` | 租户消息覆写 | 04 §2.7 |

### P3-W2: 配置解析引擎（第 2 周）

#### dcf-light-bot 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/contexts/tenant-management/application/TenantConfigResolver.js` | 配置覆写继承逻辑（租户→系统→fallback） |

核心逻辑（详见 04-multi-tenant-architecture.md §4）：
- 模型配置：租户模型白名单 + 系统模型列表 → 交集
- 模板：租户覆写 → 系统默认 → 空
- 消息：租户覆写 → 系统默认 → 空
- Skill：租户绑定 → 系统默认
- 白名单：租户独立

### P3-W3: 租户管理 API（第 3 周）

#### dcf-light-bot 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/interfaces/http/routes/tenantChannels.js` | 租户 Channel CRUD |
| **新增** | `src/interfaces/http/routes/tenantModelQuotas.js` | 租户模型配额 CRUD |
| **新增** | `src/interfaces/http/routes/tenantInstanceProfiles.js` | 租户实例 Profile CRUD |
| **新增** | `src/interfaces/http/routes/tenantTemplates.js` | 租户模板覆写 CRUD |
| **新增** | `src/interfaces/http/routes/tenantSkills.js` | 租户 Skill 绑定 |
| **新增** | `src/interfaces/http/routes/tenantWhitelist.js` | 租户白名单 |
| **新增** | `src/interfaces/http/routes/tenantMessages.js` | 租户消息覆写 |
| **修改** | `src/interfaces/http/routes/controlConfig.js` | 增加 `GET /api/control/config/tenant/:tenantId/full` |
| **修改** | `src/interfaces/http/router.js` | 注册所有新路由 |

#### 验收标准

- [ ] 可为租户配置独立的 WPS Channel 凭证
- [ ] 可为租户设置独立的模型白名单和默认模型
- [ ] 可为租户设置独立的资源规格 Profile
- [ ] 可为租户覆写模板和消息文案
- [ ] `GET /api/control/config/tenant/:tenantId/full` 正确聚合覆写后的完整配置
- [ ] 不设置覆写时默认使用系统级配置

### P3-W4: 超管租户配置 UI（第 4 周）

#### dcf-light-bot 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/interfaces/http/super-admin-ui/tenant-config.js` | 超管租户配置管理页面 |
| **修改** | `src/interfaces/http/super-admin-ui/tenants.js` | 租户列表增加"配置"操作列 |

---

## P4: 租户运营平台（3-4 周）

### 目标

租户管理员可自助管理本租户的配置；claw-farm 支持按租户路由 Webhook。

### P4-W1: 租户自助管理 UI（第 1 周）

新增租户管理员入口，可管理本租户范围内的：
- 白名单（增删用户）
- 模板定制（覆写引导流程、AGENTS.md 等）
- 消息定制（自定义回复文案）
- Skill 选配（勾选需要的 Skill）

### P4-W2: Webhook 多租户路由（第 2 周）

#### claw-farm 变更

| 操作 | 文件 | 说明 |
|------|------|------|
| **修改** | `internal/webhook/handler.go` | 支持多组 WPS 凭证，按 appId 识别租户 |
| **新增** | `internal/tenant/resolver.go` | 租户配置解析器，缓存租户配置 |
| **修改** | `internal/router/router.go` | Route() 方法接受 tenantConfig 参数 |
| **修改** | `internal/instance/manager.go` | 实例创建使用租户级配置 |
| **修改** | `internal/instance/resources.go` | OpenClawConfig() 使用租户级配置 |

核心改造（详见 04-multi-tenant-architecture.md §5）：
- Webhook handler 按 appId 查找租户凭证
- Router 使用租户级白名单和消息文案
- Instance Manager 使用租户级资源规格
- OpenClawConfig 使用租户级模型列表和模板

### P4-W3-4: 集成测试 + 灰度发布（第 3-4 周）

- 单元测试：dcf-light-bot 新增路由和 resolver 测试
- 集成测试：claw-farm + dcf-light-bot 联调
- 灰度策略：先迁移一个内部租户，验证稳定后全量

---

## 风险与缓解措施

### 技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| API 不可用导致 claw-farm 无法创建实例 | 严重 | P2 中实现 fallback 机制，API 不可用时使用缓存/硬编码 |
| 配置变更后旧实例不一致 | 中等 | 配置变更只影响新创建的实例；已运行实例需 `/restart` 才更新 |
| WPS 多应用审批周期长 | 阻塞 P4 | P4 前提前申请测试应用；单租户阶段不受影响 |
| 数据库迁移失败 | 严重 | 所有新表 CREATE IF NOT EXISTS + 默认数据幂等插入 |

### 优先级建议

如果资源有限，推荐按以下顺序裁剪：

1. **必做**：P0 + P1-W1（模型管理）— 解决"新增模型必须改代码"这个最痛的点
2. **强烈建议**：P1-W2（模板管理）— 解决"改引导流程必须改代码"
3. **建议**：P1-W3/W4 + P2 — 完成管理后台 MVP 和配置分发
4. **后续**：P3 + P4 — 多租户是长期目标，不阻塞当前运营

---

## 附录：文件变更清单汇总

### dcf-light-bot 修改文件（共 8 个）

| 文件 | 阶段 | 变更类型 |
|------|------|---------|
| `src/infrastructure/persistence/DatabaseSchema.js` | P0, P3 | 新增表 DDL + 默认数据 |
| `src/infrastructure/persistence/SqliteStore.js` | P0, P3 | 初始化逻辑 |
| `src/interfaces/http/router.js` | P1, P3 | 注册新路由 |
| `src/interfaces/http/routes/adminCompat.js` | P1 | 注册新路由模块 |
| `src/interfaces/http/routes/adminCompatAIGateway.js` | P1 | 扩展模型能力/路由管理 |
| `src/interfaces/http/admin-ui/ai-gateway.js` | P1 | 增加模型能力编辑 UI |
| `src/interfaces/http/admin-ui/auth-members.js` | P1 | 增加白名单/管理员 Tab |
| `src/interfaces/http/super-admin-ui/tenants.js` | P3 | 增加配置操作列 |

### dcf-light-bot 新增文件（共 18 个）

| 文件 | 阶段 |
|------|------|
| `src/interfaces/http/routes/controlConfig.js` | P1 |
| `src/interfaces/http/routes/adminCompatTemplates.js` | P1 |
| `src/interfaces/http/routes/adminCompatSkillConfig.js` | P1 |
| `src/interfaces/http/routes/adminCompatMessages.js` | P1 |
| `src/interfaces/http/routes/adminCompatWhitelist.js` | P1 |
| `src/interfaces/http/routes/adminCompatSystemAdmins.js` | P1 |
| `src/interfaces/http/admin-ui/templates.js` | P1 |
| `src/interfaces/http/admin-ui/system-messages.js` | P1 |
| `src/interfaces/http/admin-ui/instance-skills.js` | P1 |
| `src/contexts/tenant-management/application/TenantConfigResolver.js` | P3 |
| `src/interfaces/http/routes/tenantChannels.js` | P3 |
| `src/interfaces/http/routes/tenantModelQuotas.js` | P3 |
| `src/interfaces/http/routes/tenantInstanceProfiles.js` | P3 |
| `src/interfaces/http/routes/tenantTemplates.js` | P3 |
| `src/interfaces/http/routes/tenantSkills.js` | P3 |
| `src/interfaces/http/routes/tenantWhitelist.js` | P3 |
| `src/interfaces/http/routes/tenantMessages.js` | P3 |
| `src/interfaces/http/super-admin-ui/tenant-config.js` | P3 |

### claw-farm 变更文件（P2+P4 阶段）

| 文件 | 阶段 | 变更类型 |
|------|------|---------|
| `internal/configapi/client.go` | P2 | 新增：配置 API 客户端 |
| `internal/configapi/types.go` | P2 | 新增：API 响应类型 |
| `internal/configapi/cache.go` | P2 | 新增：内存缓存 |
| `internal/config/config.go` | P2 | 修改：新增 CONTROL_PLANE_URL/TOKEN |
| `cmd/farm/main.go` | P2 | 修改：初始化 configapi |
| `internal/instance/resources.go` | P2 | 修改：OpenClawConfig 使用 API 配置 |
| `internal/instance/manager.go` | P2 | 修改：模板从 API 获取 |
| `internal/router/router.go` | P2 | 修改：消息文案从 API 获取 |
| `internal/webhook/handler.go` | P4 | 修改：多凭证支持 |
| `internal/tenant/resolver.go` | P4 | 新增：租户配置解析 |
