# DCF — 企业决策指挥运行时

> Enterprise Runtime for Human-Agent Collaborative Decision Making

DCF（Digital Crew Factory）是面向中小企业管理层的**决策指挥运行时（Enterprise Runtime）**。它不是 IM，不是 Agent 框架，不是项目管理工具——而是坐在这些之上的**中间层操作系统**：聚合多渠道消息、AI 智能分拣、人机协同决策、命令下达到执行闭环追踪。

### 核心设计原则

| 原则 | 说明 |
|------|------|
| **Agent 框架不绑定** | 当前默认集成 OpenClaw，但通过 `AgentRuntimeAdapter` 标准接口可替换为 Dify、Coze、LangChain 或任何自研框架 |
| **渠道不绑定** | Matrix、钉钉、飞书、企微、邮箱等均为平级的 `ChannelAdapter` 实现。Matrix 是默认通道（开放协议·自托管·E2EE），但无特殊绑定 |
| **运行时即价值** | Agent 可以换，渠道可以换，但消息归一化、决策引擎、执行编排、回执追踪等运行时能力不可替代 |

### 三层解耦架构

```
上层（可插拔）   Agent 框架：OpenClaw │ Dify │ Coze │ 自研 │ ...
                       ↕ AgentRuntimeAdapter 标准接口
中层（核心）     DCF Enterprise Runtime
                 消息总线 · 决策引擎 · 编排引擎 · 洞察引擎
                       ↕ ChannelAdapter 标准接口
下层（可插拔）   渠道：Matrix │ 钉钉 │ 飞书 │ 企微 │ 邮箱 │ Slack │ ...
```

> 产品战略详见 [产品战略白皮书](docs/product-strategy-command-center.md)

---

## 快速开始

```bash
npm install
cp .env.example .env   # 编辑配置（至少填写 OPENAI_API_KEY）
npm start
```

启动后访问：

| 角色 | 入口 | URL | 说明 |
|------|------|-----|------|
| 终端用户 | 渠道客户端 | http://127.0.0.1:8081 (Element) | 通过 Matrix 渠道与数字员工对话（需先 `npm run openclaw:up`） |
| 租户管理员 | 租户管理后台 | http://localhost:3010/admin/login.html | 员工/技能/工具/AI Gateway/日志/权限管理 |
| 平台运营方 | 租户运营平台 | http://localhost:3010/super-admin/login.html | 跨租户配额/监控/用户/配置/审计 |
| 运维 / 开发 | 健康检查 | http://localhost:3010/health | 分级健康状态 |
| 运维 / 开发 | Prometheus 指标 | http://localhost:3010/metrics | 平台指标采集端点 |
| 运维 / 开发 | OpenClaw Gateway | http://127.0.0.1:18789 | 默认 Agent 框架原生 UI（需先 `npm run openclaw:up`） |

> 终端用户通过渠道客户端（当前默认 Matrix）与数字员工对话协作。管理员通过管理后台配置员工的技能、工具和 AI 模型。渠道和 Agent 框架均可通过标准接口替换。

---

## 系统架构

### 运行时三面体

```
Control Plane ─── 实例生命周期、认证、审计、租户管理
Runtime Plane ─── Agent 框架适配层（默认 OpenClaw，可替换）
Asset Plane   ─── 共享技能/工具/知识库注册 + 跨租户绑定
Channel Plane ─── 渠道适配层（Matrix/钉钉/飞书/企微/邮箱/...）
```

### DDD 限界上下文

```
src/contexts/
  tenant-management/     # 租户实体、套餐、14 字段四维度配额
  tenant-instance/       # 实例生命周期（创建/启动/停止/调和）
  identity-access/       # 双域认证（platform/tenant）+ RBAC
  shared-assets/         # 技能/工具/知识库上报 → 审核 → 共享 → 绑定
  audit-observability/   # 审计日志 + Prometheus 指标 + 保留策略
  release-management/    # 发布预检（Release Preflight）
  document/              # 知识库文档管理 + 分类 + 存储
```

### 多租户模型

- **双域角色体系**：`platform`（平台管理员/运维）与 `tenant`（租户管理员/运维/审计员）完全隔离
- **JWT scope 隔离**：平台 JWT 不能访问租户 API，反之亦然
- **数据隔离**：所有查询按 `tenantId` 强制过滤，Platform API 可跨租户
- **配额四维度**：容量（实例/并发/用户）、实例资源（CPU/内存/存储）、AI 用量（Token/调用/速率）、数据策略（保留期/Webhook/知识库）

---

## 项目结构

```
dcf-light-bot/
  src/
    app/                        # 启动入口、服务器创建
    config/                     # 配置加载（env → config 对象）
    contexts/                   # DDD 限界上下文（见上）
    infrastructure/
      persistence/              # 存储适配（SQLite/File/Postgres）
      k8s/                      # K8s provisioner + reconciler
    integrations/
      matrix/                   # Matrix 渠道适配（Bot + Relay 桥接）
      weknora/                  # WeKnora RAG 集成
    interfaces/http/
      routes/                   # API 路由（薄层）
      middleware/               # 认证 + 权限中间件
      admin-ui/                 # 租户管理后台（Vanilla HTML/CSS/JS）
      super-admin-ui/           # 租户运营平台（Vanilla HTML/CSS/JS）
    shared/                     # ID 生成、时间、通用工具
  client-suite/
    apps/web/
      src/
        domain/                 # 纯业务逻辑（决策引擎、协作链、Agent 模型）
        infrastructure/
          channels/             # ChannelAdapter 接口 + 适配器注册
          matrix/               # Matrix 客户端适配
          api/                  # 后端 API 适配
        application/            # 用例编排 + zustand stores
        presentation/           # React 组件 + 路由
    packages/ui-tokens/         # 设计 Token（Tailwind preset）
  deploy/
    k8s/                        # K8s 原生 manifests
    helm/                       # Helm Chart
    local/                      # 本地 docker-compose 编排
    observability/              # Prometheus + Grafana + Alertmanager
  docs/                         # 文档（含产品战略白皮书）
  scripts/                      # 运维/检查/E2E 脚本
  tests/                        # 后端测试（vitest）
```

---

## 管理控制台

### 租户管理后台（/admin）

面向单个租户的管理员，管理本租户内的数字员工、技能、工具和资产。

| 页面 | 路径 | 功能 |
|------|------|------|
| 数据统计 | `/admin/openclaw-statistics.html` | 首页，运营数据概览 |
| 平台运营 | `/admin/openclaw-monitor.html` | 实例运行状态监控 |
| 员工管理 | `/admin/employees.html` | 数字员工 CRUD + Matrix 房间绑定 |
| 共享 Agent | `/admin/shared-agents.html` | 跨租户共享 Agent 注册/绑定 |
| 技能管理 | `/admin/skills.html` | 技能上报 → 审核 → 共享发布 |
| 工具管理 | `/admin/tools.html` | 工具资产 + 审批流 |
| AI Gateway | `/admin/ai-gateway.html` | 模型路由、调用链追踪、模板管理 |
| 通知中心 | `/admin/notifications.html` | 系统通知 |
| 行为日志 | `/admin/logs-service.html` | 按类型/操作人/实例筛选 + NDJSON 导出 |
| 账号权限 | `/admin/auth-members.html` | 租户内用户与角色管理 |

### 租户运营平台（/super-admin）

面向平台运营方，跨租户管理资源和配额。

| 页面 | 路径 | 功能 |
|------|------|------|
| 租户管理 | `/super-admin/tenants.html` | 创建/编辑/暂停/激活/归档 + 14 字段配额 + 初始管理员 |
| 平台用户 | `/super-admin/platform-users.html` | 平台域用户 CRUD（动态 + env 合并） |
| 全局配置 | `/super-admin/platform-config.html` | 运行时参数可编辑（审计策略/SLA/资源默认值） |
| 运营监控 | `/super-admin/platform-monitoring.html` | 资源总览 + 配额利用率进度条 + 健康状态 |
| 审计日志 | `/super-admin/platform-audit.html` | 跨租户操作审计 |

详细文档：[架构](docs/super-admin/architecture.md) | [PRD](docs/super-admin/prd.md) | [里程碑](docs/super-admin/milestones.md)

---

## OpenClaw 集成（默认 Agent 框架）

`client-suite/apps/web/` 是基于 React + TypeScript 的管理 SPA：

- **DDD 分层**：domain/ → infrastructure/ → application/ → presentation/
- **状态管理**：zustand（authStore / chatStore / openclawStore）
- **设计语言**：Apple HIG glass morphism，主色 `#007AFF`，Tailwind CSS 3.4
- **Matrix 集成**：MockMatrixClient 全 Demo 模式（7 个模拟房间 + Bot 自动回复）

> OpenClaw 是当前默认的 Agent 框架，但运行时层不依赖它。通过 `AgentRuntimeAdapter` 接口，企业可替换为 Dify、Coze 或自研框架。

---

## 渠道集成

DCF 通过标准化的 `ChannelAdapter` 接口接入各通信渠道。所有渠道平级，均可作为用户触达和人机协同的入口。

### 当前已实现

| 渠道 | 状态 | 说明 |
|------|------|------|
| **Matrix** | 默认通道 | 开放协议、自托管、E2EE；Factory DM 创建数字员工，Employee Room 人机协作 |
| **Mock** | 开发用 | `MockChannelAdapter` 全模拟模式，用于本地开发和演示 |

### 规划中

| 渠道 | 接入方式 |
|------|---------|
| 飞书 | 事件订阅 + 机器人消息 |
| 钉钉 | 事件订阅 + 机器人消息 |
| 企微 | 回调 + 应用消息 |
| 邮箱 | IMAP/SMTP |
| Slack | Events API + Bot |

### Matrix 本地环境

```bash
npm run openclaw:up          # 启动 Matrix Synapse + Element + OpenClaw
npm run openclaw:check       # 健康检查
npm run openclaw:smoke       # 冒烟测试
npm run openclaw:down        # 停止
```

本地端点：Synapse `http://127.0.0.1:8008` | Element `http://127.0.0.1:8081` | OpenClaw `http://127.0.0.1:18789`

---

## API 概览

### 控制面（/api/control）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/control/instances` | 创建实例 |
| GET | `/api/control/instances` | 实例列表（支持 state/name/tenantId 筛选） |
| POST | `/api/control/instances/batch-actions` | 批量启动/停止 |
| POST | `/api/control/assets/reports` | 上报资产 |
| POST | `/api/control/assets/reviews/batch` | 批量审核 |
| POST | `/api/control/assets/bindings/batch` | 批量绑定 |
| GET | `/api/control/audits` | 审计日志（游标分页） |
| POST | `/api/control/release/preflight/assert` | 发布预检 |

### 租户 BFF（/api/admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/agents/shared` | 共享 Agent 列表 |
| POST | `/api/admin/agents/shared/register` | 注册共享 Agent |
| POST | `/api/admin/agents/shared/auto-bind/{employeeId}` | 自动绑定 |
| POST | `/api/admin/employees/{id}/sync-identity` | 同步 Matrix 身份 |

### 平台 API（/api/platform）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/platform/auth/login` | 平台登录 |
| GET | `/api/platform/tenants` | 租户列表 |
| POST | `/api/platform/tenants` | 创建租户（含初始管理员） |
| POST | `/api/platform/tenants/:id/suspend` | 暂停租户 |
| GET | `/api/platform/users` | 平台用户列表 |
| GET | `/api/platform/monitoring/overview` | 运营总览 |
| GET | `/api/platform/monitoring/resources` | 配额利用率 |
| GET | `/api/platform/config` | 全局配置 |

### 基础设施

| 路径 | 说明 |
|------|------|
| `GET /health` | 分级健康状态（healthy/degraded/unhealthy） |
| `GET /status` | 应用状态摘要 |
| `GET /metrics` | Prometheus 指标 |

---

## 部署

### 本地开发

```bash
npm run start:app            # 仅启动 DCF 应用
npm run start:all            # 启动 Matrix + OpenClaw + DCF 全栈
npm run stop:all             # 停止全部
```

### Docker

```bash
npm run docker:build
npm run docker:run
```

### Kubernetes

```bash
npm run k8s:apply            # 部署 K8s manifests
npm run k8s:delete           # 清理
```

详见 [deploy/k8s/README.md](deploy/k8s/README.md)

### Helm

```bash
helm upgrade --install dcf-light-bot deploy/helm/dcf-light-bot \
  --namespace dcf-system --create-namespace \
  -f deploy/helm/dcf-light-bot/values-prod.yaml
```

详见 [deploy/helm/README.md](deploy/helm/README.md)

---

## 持久化后端

| 环境变量 | 后端 | 说明 |
|---------|------|------|
| `PERSISTENCE_BACKEND=sqlite` | SQLite | 默认，推荐生产环境 |
| `PERSISTENCE_BACKEND=file` | JSON File | 开发调试用 |
| `PERSISTENCE_BACKEND=postgres` | PostgreSQL | K8s 环境部署，需设置 `POSTGRES_URL` |

Postgres 迁移脚本：[001_control_plane_store.sql](scripts/migrations/001_control_plane_store.sql)

---

## 认证

```bash
# 控制面登录
POST /api/control/auth/login
# 请求头
Authorization: Bearer <jwt-or-admin-token>
```

平台登录与租户登录独立，JWT 中 `scope` 字段区分域（`platform` / `tenant`）。

---

## 质量门禁

```bash
npm run lint                         # ESLint
npm test                             # vitest
npm run verify:openclaw-lock         # OpenClaw 版本锁校验
```

## 运维检查

```bash
npm run check:platform-slo           # SLO 自检
npm run check:k8s-manifests          # K8s manifest 静态检查
npm run check:helm-chart             # Helm Chart 校验
npm run check:prod-config            # 生产 Helm guardrail
npm run check:release-preflight      # 发布预检矩阵
```

### 可观测性

```bash
npm run observability:up             # 启动 Prometheus + Grafana + Alertmanager
npm run observability:check          # 健康检查
npm run observability:down           # 停止
```

- Prometheus 告警规则：[prometheus-alert-rules.yaml](docs/shared/monitoring/prometheus-alert-rules.yaml)
- Grafana 仪表盘：[grafana-dashboard-dcf-light-bot.json](docs/shared/monitoring/grafana-dashboard-dcf-light-bot.json)
- 监控指南：[README.md](docs/shared/monitoring/README.md)

---

## E2E 测试

```bash
npm run matrix:e2e                   # Matrix 创建员工 E2E
npm run e2e:full                     # 全链路（Stack 健康 + Matrix + Admin API）
npm run e2e:user                     # 用户行为 E2E（Matrix 真实房间 + 浏览器断言）
npm run check:all                    # 全量检查（含 Matrix + browser-use）
```

---

## 文档索引

| 子系统 | 路径 | 内容 |
|--------|------|------|
| **产品战略** | [docs/product-strategy-command-center.md](docs/product-strategy-command-center.md) | 产品定义、架构、竞品分析、售卖策略、路线图 |
| 租户运营平台 | [docs/super-admin/](docs/super-admin/) | 架构、PRD、里程碑 |
| 租户管理后台 | [docs/admin-console/](docs/admin-console/) | 架构、PRD、里程碑 |
| 控制面 | [docs/control-plane/](docs/control-plane/) | 架构、API 契约、Runbooks |
| OpenClaw 客户端 | [docs/openclaw-client/](docs/openclaw-client/) | 架构、PRD、Manager Mode 设计 |
| 共享资源 | [docs/shared/](docs/shared/) | ADR、OpenAPI 契约、监控配置 |
| 审计报告 | [docs/audit-report.md](docs/audit-report.md) | 审计治理报告 |
