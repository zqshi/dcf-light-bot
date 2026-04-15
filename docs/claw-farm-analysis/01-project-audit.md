# Claw Farm 项目审计报告

> 审计日期：2026-04-15 | 审计范围：架构设计 + 代码质量 + 安全风险 + 模块分析

---

## 1. 项目定位

Claw Farm 是 **WPS 协作 IM 与 OpenClaw AI Agent 实例之间的中间层服务**，核心职责：
1. 接收 WPS IM 消息，路由到用户专属的 OpenClaw 实例
2. 在 K8S 集群中管理 OpenClaw Pod/PVC/Service 的完整生命周期
3. 通过自研 Channel 插件（`claw-farm-channel`）实现双向消息收发

仓库地址：`github.com/tech-committee/claw-farm`

---

## 2. 架构概览

```
WPS IM (Webhook) --> Claw Farm Go 服务 --> WebSocket --> OpenClaw Pod (K8S)
                          |                                    |
                          +--- MySQL (clawhub DB)              +--- PVC 持久存储
                          +--- LiteLLM Proxy                   +--- claw-farm-channel 插件
                          +--- K8S API (client-go)             +--- portal-reader 插件
                                                               +--- OpenViking 记忆引擎
```

### 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 主服务 | Go 1.25 | 消息路由 + K8S 编排 + HTTP/WS 服务 |
| Channel 插件 | TypeScript (Node 22) | OpenClaw 插件生态，运行在实例 Pod 内 |
| Portal Reader 插件 | TypeScript | 文件监控 + 博客定时任务 |
| K8S 管理 | client-go v0.35 | Pod/PVC/Service/Watch |
| 数据库 | MySQL (共享 clawhub DB) | 6 张 Farm 表 + clawhub 原有表 |
| 模型代理 | LiteLLM | 多模型统一代理，per-user 虚拟 Key |
| 部署 | Helm Chart + Docker | 单副本，金山云 KCE |

---

## 3. 代码规模

| 组件 | 语言 | 行数 | 文件数 |
|------|------|------|--------|
| Farm 主服务（Go） | Go | ~8,350 | 20 |
| claw-farm-channel 插件 | TypeScript | ~1,364 | 6 |
| portal-reader-plugin | TypeScript | ~603 | 5 |
| **总计** | | **~10,300** | **31** |

### Go 模块清单（15 个 internal packages）

| Package | 行数 | 职责 |
|---------|------|------|
| `cmd/farm` | 291 | 主入口，服务组装和启动 |
| `webhook` | 307 | WPS 回调接收、签名验证、AES-256-CBC 解密 |
| `router` | 854 | 消息路由核心 + 斜杠命令处理 |
| `instance` | ~2,000 | K8S Pod/PVC/Service 全生命周期 + 配置生成 |
| `wsserver` | 273 | WebSocket Hub，Farm <-> 实例双向通信 |
| `wpsapi` | 661 | WPS API 客户端，OAuth + KSO-1 双重认证 |
| `config` | 206 | 环境变量加载（40+ 配置项） |
| `database` | 296 | MySQL schema 管理（6 表 + 自动迁移 + JSON 迁移） |
| `litellm` | 223 | LiteLLM Key 生成/更新/删除 + 持久化 |
| `activity` | 540 | Agent 活动状态追踪 + WPS 卡片构建 |
| `chatstore` | 162 | 用户<->聊天映射（MySQL + 内存缓存） |
| `whitelist` | 99 | 邮箱前缀白名单（MySQL + 内存缓存） |
| `notify` | 214 | 版本通知 + 广播推送 + 卡片构建 |
| `clawhub` | 236 | 平台账号对接（token 查询/OAuth/Lease） |
| `msgstore` | 73 | 对话消息持久化（write-only） |
| `oauth` | 269 | WPS OAuth 流程 + 云文档代理下载 |
| `portal` | 310 | Portal API（供 platform-be 调用） |
| `logging` | 89 | 结构化日志（slog JSON） |

### TypeScript 模块清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `channel.ts` | 709 | ChannelPlugin 完整实现（消息收发+解析） |
| `ws-client.ts` | 145 | WebSocket 客户端（注册/心跳/重连） |
| `wps-api.ts` | ~400 | WPS API 客户端 TS 版（OAuth+文件操作） |
| `activity-reporter.ts` | 80 | Agent 活动事件上报 |
| `config-schema.ts` | 17 | Zod 配置 Schema |
| `oauth-token.ts` | ~50 | OAuth Token 管理 |

---

## 4. 数据库 Schema（6 张 Farm 表）

| 表名 | 用途 | 索引 |
|------|------|------|
| `FarmWhitelist` | 邮箱前缀白名单 | UNIQUE(emailPrefix) |
| `FarmChat` | 用户<->聊天映射，支持广播 | UNIQUE(userId) |
| `FarmLitellmKey` | 用户 LiteLLM 虚拟 Key | UNIQUE(userId) |
| `FarmVersionState` | 版本状态追踪（单行表） | PK(id=1) |
| `FarmInstance` | 实例元数据（工号/资源名/状态） | UNIQUE(employeeNumber), INDEX(userId) |
| `FarmMessage` | 对话记录（入站+出站） | INDEX(userId, chatId, createdAt) |

---

## 5. 设计亮点

### 5.1 消息队列 + 延迟分发

```
用户发消息 → Router.enqueue() → 等待 Pod Ready
                                      ↓
Pod Ready → Manager.OnReady → Router.onInstanceReady → Hub.Dispatch()
```

实例未就绪时消息入队，Pod Ready + WS 连接建立后自动 flush，超时清理。避免消息丢失。

### 5.2 双索引缓存

```go
cache     map[string]*Instance // empKey → Instance (主索引)
userIndex map[string]string    // userID → empKey  (二级索引)
```

支持 workspace 模型解耦：一个用户可以有多个历史 workspace（不同 employeeNumber），但只有一个活跃。

### 5.3 WebSocket Token 认证

每个 Pod 启动时生成随机 32 字节 token，通过环境变量注入。连接时 `constant-time comparison` 防时序攻击。

### 5.4 Init Container 编排

```
init-plugin → 安装 claw-farm-channel + portal-reader
init-config → 写入 openclaw.json + AGENTS.md + BOOTSTRAP.md + TOOLS.md + read-cloud-doc skill
main        → 启动 openclaw gateway
```

分层初始化，插件先于配置安装，确保 `openclaw plugins install` 不覆盖自定义配置。

### 5.5 WPS 双重认证实现

Go 侧和 TS 侧都完整实现了 OAuth 2.0 + KSO-1 HMAC-SHA256 签名，包括：
- AES-256-CBC 事件解密
- 5 分钟防重放校验
- OAuth Token 自动续期（提前 5 分钟过期）

### 5.6 消息解析完整度

`channel.ts` 的 `parseMessage` + `parseRichText` 覆盖了 WPS 所有消息类型：
text / image / file(local+cloud) / audio / video / card / rich_text（递归解析）。

---

## 6. 风险与问题

### 6.1 严重问题

| 编号 | 问题 | 位置 | 影响 | 建议 |
|------|------|------|------|------|
| S-1 | **零测试覆盖** | 全项目 | 任何重构都是盲飞，回归无保障 | 优先补 webhook 解密、签名验证、消息路由测试 |
| S-2 | **`.env.example` 泄露真实凭证** | `.env.example:4-5` | 密钥已进入 Git 历史，无法撤回 | **立即轮换密钥** |
| S-3 | **TLS 证书验证关闭** | `wpsapi/client.go:41`, `clawhub/client.go:57`, `oauth/handler.go:22` | 3 处 `InsecureSkipVerify: true`，中间人攻击风险 | 配置自定义 CA 证书 |

### 6.2 架构问题

| 编号 | 问题 | 位置 | 影响 |
|------|------|------|------|
| A-1 | **单副本无高可用** | `values.yaml:3` `replicaCount: 1` | Farm 宕机 = 所有用户断联 |
| A-2 | **内存状态不持久** | Router.pending, Hub.pending, userNames 等 | 进程重启丢失排队消息和缓存 |
| A-3 | **Hub 双重消息队列** | Router.pending + Hub.pending | 职责重叠，增加理解成本 |

### 6.3 代码质量

| 编号 | 问题 | 位置 | 说明 |
|------|------|------|------|
| C-1 | **router.go 过度膨胀** | 854 行 | 混杂路由/命令/白名单/用户缓存/token 管理 5 个关注点 |
| C-2 | **channel.ts 过度膨胀** | 709 行 | 150 行 deliver 回调内嵌，可读性差 |
| C-3 | **大量 `any` 类型** | channel.ts 全文 | TypeScript 类型安全形同虚设 |
| C-4 | **错误处理不一致** | router.go 多处 `_ = r.wps.SendText(...)` | 消息投递失败静默吞掉 |
| C-5 | **日志打印用户明文** | router.go:109-115 | 合规风险 |

### 6.4 运维问题

| 编号 | 问题 | 说明 |
|------|------|------|
| O-1 | Helm Chart 与 deploy/ 目录并存 | 部署流程分散 |
| O-2 | 无 CI/CD pipeline 定义 | 无自动化测试和构建 |
| O-3 | 配置项散落在环境变量中 | 40+ 环境变量，无文档化管理 |

---

## 7. HTTP 路由清单

| 方法 | 路径 | 处理器 | 说明 |
|------|------|--------|------|
| POST | `/open/receive-msg` | webhook.Handler | WPS 事件回调（主入口） |
| POST | `/open/receive` | webhook.Handler | WPS 事件回调（备用） |
| GET/WS | `/ws` | wsserver.Server | OpenClaw 实例 WebSocket 连接 |
| GET | `/oauth/auth-url` | oauth.Handler | WPS OAuth 授权 URL |
| GET | `/oauth/callback` | oauth.Handler | OAuth 回调（已弃用） |
| GET | `/api/doc-content` | oauth.Handler | 云文档内容提取 |
| GET | `/api/doc-download` | oauth.Handler | 云文档代理下载 |
| GET | `/api/portal/provision-status` | portal.Handler | 用户开通状态查询 |
| GET | `/api/portal/runtime-status` | portal.Handler | 实例运行时状态查询 |
| POST | `/api/portal/reset-user` | portal.Handler | 重置用户（需管理员） |
| POST | `/api/portal/new-workspace` | portal.Handler | 新建工作空间（需管理员） |
| GET | `/health` | inline | 健康检查 |

---

## 8. IM 斜杠命令清单

| 命令 | 权限 | 处理函数 | 说明 |
|------|------|----------|------|
| `/help` | 所有用户 | cmdHelp | 显示帮助信息 |
| `/info` | 所有用户 | cmdInfo | 查看实例状态 |
| `/log [N]` | 所有用户 | cmdLog | 查看实例日志 |
| `/restart` | 所有用户 | cmdRestart | 重启实例 |
| `/auth` | 所有用户 | cmdAuth | 获取 OAuth 授权链接 |
| `/access-token` | 所有用户 | cmdAccessToken | 查看当前 Token |
| `/whitelist add/remove/list` | 管理员 | handleWhitelistCommand | 白名单管理 |
| `/restart-all` | 管理员 | cmdRestartAll | 重启所有实例 |
| `/notify <msg>` | 管理员 | cmdNotify | 广播消息 |
| `/new-workspace [email]` | 管理员 | cmdNewWorkspace | 创建全新工作空间 |

---

## 9. 依赖清单

### Go 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `k8s.io/client-go` | v0.35.2 | K8S API 操作 |
| `k8s.io/api` | v0.35.2 | K8S 资源类型定义 |
| `gorilla/websocket` | v1.5.4 | WebSocket 通信 |
| `go-sql-driver/mysql` | v1.9.3 | MySQL 连接 |

### TypeScript 核心依赖

| 依赖 | 用途 |
|------|------|
| `ws` | WebSocket 客户端 |
| `zod` | 配置 Schema 校验 |
| `image-size` | 图片尺寸检测 |
