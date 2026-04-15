# Claw Farm 功能抽象分析 — 代码级功能清单

> 版本 1.0 | 2026-04-15
> 数据来源：`/Users/zqs/Downloads/project/claw-farm` 逐文件审查

本文档从 Claw Farm 源码中提取全部业务功能点，标注精确代码位置，为管理后台设计和多租户改造提供依据。

---

## 1. 功能域总览

共 **8 大功能域、32 个可独立管理的功能点**。

| 域编号 | 功能域 | 功能点数 | 核心文件 |
|--------|--------|---------|----------|
| D1 | 用户准入管理 | 4 | `whitelist/store.go`, `router.go`, `config.go` |
| D2 | 实例生命周期管理 | 6 | `instance/manager.go`, `instance/resources.go` |
| D3 | 模型与 AI 配置 | 5 | `config.go`, `instance/resources.go`, `litellm/` |
| D4 | OpenClaw 实例配置 | 8 | `instance/resources.go`, `instance/manager.go` |
| D5 | 消息路由与通知 | 4 | `router.go`, `notify/notify.go`, `msgstore/store.go` |
| D6 | 卡片消息系统 | 2 | `activity/card.go`, `notify/notify.go` |
| D7 | OAuth / 凭证管理 | 2 | `config.go`, `oauth/handler.go` |
| D8 | 监控与可观测 | 1 | `logging/logging.go` |

---

## 2. 逐域逐功能点详析

### D1: 用户准入管理

#### F-01 白名单管理

- **代码位置**：
  - 存储层：`internal/whitelist/store.go` (全文 99 行)
  - 命令处理：`internal/router/router.go:556-637`
  - 准入检查：`internal/router/router.go:547-552`
- **当前实现**：IM 斜杠命令 `/whitelist add/remove/list`，MySQL `FarmWhitelist` 表 + 内存缓存
- **数据模型**：
  ```sql
  FarmWhitelist (emailPrefix VARCHAR(255) UNIQUE, addedBy VARCHAR(255), createdAt DATETIME)
  ```
- **问题**：
  - 无批量导入能力
  - 无审批流程
  - 操作入口仅 IM，无 Web 界面
  - 白名单粒度仅支持邮箱前缀，不支持部门/组

#### F-02 管理员名单

- **代码位置**：
  - 加载：`internal/config/config.go:63` (`AdminUserIDs []string`)
  - 解析：`internal/config/config.go:135` (`parseCSV(os.Getenv("ADMIN_USER_IDS"))`)
  - 鉴权：`internal/config/config.go:183-190` (`IsAdmin` 方法)
- **当前实现**：环境变量 `ADMIN_USER_IDS`，逗号分隔的邮箱前缀列表
- **问题**：
  - **改管理员需要修改环境变量并重新部署**
  - 无层级（超管/普通管理员不分）
  - 硬编码在 Config 结构体中，无 DB 持久化

#### F-03 未注册用户拦截

- **代码位置**：`internal/router/router.go:148-170`
- **当前实现**：查询 clawhub DB 的 `User` + `UserApiToken` 表，未注册发送登录链接
- **问题**：拦截逻辑和跳转 URL 硬编码

#### F-04 访问拒绝文案

- **代码位置**：`internal/router/router.go:129`
- **当前值**：`"暂未开放，请联系管理员开通。"`
- **问题**：硬编码，不可配置，不支持多语言

---

### D2: 实例生命周期管理

#### F-05 实例创建策略

- **代码位置**：`internal/instance/manager.go:200-206`
- **当前实现**：
  ```go
  if m.RunningCount() >= m.cfg.MaxInstances {
      return StatusFailed, fmt.Errorf("max instances (%d) reached", m.cfg.MaxInstances)
  }
  ```
- **配置**：`MAX_INSTANCES` 环境变量，默认 100 (`config.go:112`)
- **问题**：
  - 全局统一上限，无按用户/组/租户限制
  - 无排队机制，超限直接报错
  - 无优先级概念

#### F-06 Pod 资源规格

- **代码位置**：
  - 配置加载：`internal/config/config.go:91-96`
  - Pod 生成：`internal/instance/resources.go:83-93`
- **环境变量**：
  ```
  POD_CPU_REQUEST=1000m, POD_CPU_LIMIT=2000m
  POD_MEMORY_REQUEST=2Gi, POD_MEMORY_LIMIT=2Gi
  ```
- **问题**：
  - 全局统一规格，不支持按用户差异化配额
  - 无资源 Profile（S/M/L）概念

#### F-07 PVC 存储配置

- **代码位置**：
  - 配置：`internal/config/config.go:90-91` (`STORAGE_CLASS`, `PVC_STORAGE_SIZE`)
  - 创建：`internal/instance/resources.go:17-35`
- **当前实现**：全局 `dcf-juicefs-sc` StorageClass，统一 1Gi
- **问题**：不支持按用户扩容

#### F-08 空闲回收 (Idle Reaper)

- **代码位置**：`internal/instance/manager.go:118-121`
- **配置**：`IDLE_TIMEOUT` 环境变量，默认 7200s
- **回收前通知**：`manager.go:170-174`（OnBeforeReap 回调，发 "长时间未使用，实例已休眠。"）
- **问题**：
  - 全局统一超时，不支持 VIP 用户"永不休眠"
  - 活跃判断基于 `activityStore.IsUserActive()` + `LastActivityTime()`，不考虑定时任务（cron）

#### F-09 实例重启

- **代码位置**：
  - 单实例：`internal/instance/manager.go:330-349`
  - 全部：`internal/instance/manager.go:439-459`
- **触发方式**：IM `/restart` 和 `/restart-all` 命令
- **问题**：无批量操作 UI、无定时重启、无滚动升级

#### F-10 工作空间轮转

- **代码位置**：`internal/instance/manager.go` NewWorkspace 方法（通过 Portal API 或 IM 命令触发）
- **当前实现**：旧 PVC 标记 `isActive=0`，新建 Pod + PVC
- **问题**：旧 PVC 永远保留，无清理策略，随时间累积存储浪费

---

### D3: 模型与 AI 配置

#### F-11 可用模型列表

- **代码位置**：`internal/config/config.go:140-158`
- **当前实现**：
  ```go
  extraModels := []string{
      "mcs-5", "mco-4", "mcs-1", "mch-1",
      "mgg-9",
      "qwen-plus-latest", "qwen-max-latest",
      "qwen3-235b-a22b", "qwen-vl-max-latest",
      "text-embedding-v3",
  }
  ```
- **问题**：**新增模型必须改代码、构建镜像、重新部署**。这是当前最大的运维痛点。

#### F-12 默认模型选择

- **代码位置**：`internal/config/config.go:108-110`
- **环境变量**：
  ```
  DEFAULT_CHAT_MODEL=mcs-5
  DEFAULT_IMAGE_MODEL=mgg-5
  DEFAULT_VLM_MODEL=qwen-vl-max-latest
  ```
- **问题**：全局统一，不支持按用户偏好

#### F-13 模型提供商配置

- **代码位置**：`internal/instance/resources.go:250-281`
- **当前实现**：
  ```go
  amModels := []modelEntry{
      {ID: "mcs-5", ContextWindow: 60000, MaxTokens: 8192, Input: []string{"text"}},
      // ...
  }
  ocModels := []modelEntry{
      {ID: "qwen-plus-latest", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
      // ...
  }
  ```
- **问题**：模型元信息（context window, capabilities, cost）全部硬编码在 Go 代码中

#### F-14 LiteLLM Key 管理

- **代码位置**：
  - 客户端：`internal/litellm/client.go` (全文 141 行)
  - 持久化：`internal/litellm/store.go` (全文 82 行)
  - 生成逻辑：`internal/instance/manager.go:498-539`
- **当前实现**：自动为每个用户生成 LiteLLM 虚拟 Key，存入 `FarmLitellmKey` 表
- **问题**：无查看/手动撤销界面，无用量统计

#### F-15 模型路由规则

- **代码位置**：`internal/instance/resources.go:214-224`
- **当前实现**：
  ```go
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
- **问题**：前缀→provider 映射硬编码，新增 provider 或命名规则变化要改代码

---

### D4: OpenClaw 实例配置

#### F-16 openclaw.json 生成

- **代码位置**：`internal/instance/resources.go:228-403`
- **当前实现**：Go 代码直接构建 `map[string]interface{}`，~180 行
- **涵盖内容**：
  - gateway 认证配置 (token)
  - agents.defaults（模型、compaction、contextPruning）
  - models.providers 定义
  - logging 配置
  - tools 黑名单（deny: group:web）
  - skills.allowBundled 白名单
  - diagnostics
  - channels.claw-farm 配置
  - plugins.openviking 配置
- **问题**：任何实例配置调整都需要改 Go 代码重新部署

#### F-17 Agent 模板 (AGENTS.md)

- **代码位置**：`internal/instance/manager.go:635-725`
- **内容**：~90 行 Markdown heredoc，定义了：
  - 每次会话的 Bootstrap Check 流程
  - IDENTITY.md / SOUL.md / USER.md / MEMORY.md 的读取规则
  - 记忆写入规则和日志格式
  - 文件/媒体发送指南
  - 安全规范
  - 群聊行为规范
- **问题**：修改 Agent 行为规范需要改 Go 代码

#### F-18 新用户引导流程 (BOOTSTRAP.md)

- **代码位置**：`internal/instance/manager.go:845-1006`
- **内容**：~160 行 Markdown heredoc，7 个引导步骤：
  1. 打招呼 + 收集信息（名字/称谓）
  2. 建立身份（写 IDENTITY.md）
  3. WPS 授权引导
  4. 认领完成
  5. 写 SOUL.md
  6. 次日主动问候（可选 cron）
  7. 标记完成
- **问题**：引导话术、步骤顺序、授权平台 URL (https://neo.ksyun.com/authorization) 全部硬编码

#### F-19 工具文档 (TOOLS.md)

- **代码位置**：`internal/instance/manager.go:727-843`
- **内容**：~115 行 Markdown heredoc，包含：
  - 运行时环境说明
  - 消息发送指南
  - 预装 Skill 用法表
  - mcporter 使用注意事项
  - 图片生成/云文档读取操作步骤
  - **物理会议室楼层速查表**（北京小米科技园 6-11 层，含 room_id/容量/主题）
- **问题**：会议室信息属于物理世界频繁变动的数据，写在代码里极不合理

#### F-20 预装 Skill 列表

- **代码位置**：`internal/instance/manager.go:611-617`
- **当前实现**：
  ```shell
  for slug in wps-cli ezone-cli clawhub-cli image-gen; do
    npx clawhub install "$slug"
  done
  ```
- **问题**：增减 Skill 需要改代码

#### F-21 Skill 白名单

- **代码位置**：`internal/instance/resources.go:350-364`
- **当前实现**：
  ```go
  "allowBundled": []string{
      "healthcheck", "skill-creator", "mcporter", "weather",
      "summarize", "session-logs", "model-usage", "clawhub",
      "coding-agent", "github", "gh-issues", "blogwatcher", "trello",
  },
  ```
- **问题**：硬编码数组，调整需改代码

#### F-22 contextPruning 参数

- **代码位置**：`internal/instance/resources.go:314-328`
- **当前值**：
  ```go
  "contextPruning": map[string]interface{}{
      "mode":                  "cache-ttl",
      "ttl":                   "5m",
      "minPrunableToolChars":   2000,
      "keepLastAssistants":     10,
      "softTrim": map[string]interface{}{
          "maxChars": 2000, "headChars": 500, "tailChars": 500,
      },
      "hardClear": map[string]interface{}{
          "enabled": true, "placeholder": "[Old tool result content cleared]",
      },
  },
  ```
- **问题**：性能调优参数硬编码在 Go 代码中

#### F-23 OpenViking 记忆引擎配置

- **代码位置**：`internal/instance/resources.go:425-463`
- **当前值**：embedding model=text-embedding-v3, dimension=1024, workspace=/home/node/.openclaw/openviking-data
- **问题**：换 embedding 模型或调参数需要改代码

---

### D5: 消息路由与通知

#### F-24 系统消息文案

- **代码位置**：散布在 `router.go` 各处（约 20+ 处）
- **示例**：
  | 位置 | 文案 |
  |------|------|
  | router.go:129 | "暂未开放，请联系管理员开通。" |
  | router.go:231 | "正在启动中，请稍候..." |
  | router.go:354 | "正在重启，下次发消息时自动启动..." |
  | manager.go (OnBeforeReap) | "长时间未使用，实例已休眠。下次发消息时会自动唤醒。" |
  | router.go:815 | "您尚未注册平台账号..." |
- **问题**：不可配置，不支持国际化/定制

#### F-25 广播通知

- **代码位置**：`internal/notify/notify.go` (全文 214 行)
- **当前实现**：
  - IM `/notify <内容>` 命令触发文本或卡片广播
  - 版本更新自动广播（`CheckVersionOnStartup`，比较 OpenClaw 镜像和 Farm 版本）
  - 广播间隔 100ms/人（`time.Sleep(100 * time.Millisecond)`）
- **问题**：无定时推送、无分组推送、无消息模板管理

#### F-26 消息记录存储

- **代码位置**：`internal/msgstore/store.go` (全文 73 行)
- **当前实现**：write-only，入站和出站消息写入 `FarmMessage` 表
- **问题**：无查询接口、无导出、无统计分析

#### F-27 消息队列超时

- **代码位置**：
  - 配置：`internal/config/config.go:113` (`MSG_QUEUE_TIMEOUT`, 默认 300s)
  - 检查器：`internal/router/router.go:658-697`
- **当前实现**：每 10 秒检查一次，超时消息从队列移除并记录 warn 日志
- **问题**：超时消息静默丢弃，不通知用户

---

### D6: 卡片消息系统

#### F-28 Agent 活动状态卡片

- **代码位置**：`internal/activity/card.go` (全文 234 行)
- **当前实现**：
  - 3 种卡片状态：idle / active / finished
  - 步骤列表带图标（✅ / ⏳）+ 耗时
  - 最多显示 12 步，超出折叠
  - 固定 WPS 卡片 JSON 结构（CardEnvelope + TextElement + HrElement + NoteElement）
- **问题**：样式和文案改动需要改 Go 代码

#### F-29 版本更新卡片

- **代码位置**：`internal/notify/notify.go:166-202`
- **卡片类型**：
  - `BuildAnnouncementCard` — 系统公告
  - `BuildImageUpdateCard` — OpenClaw 镜像更新通知
  - `BuildChangelogCard` — Farm 版本更新日志
- **问题**：卡片模板硬编码

---

### D7: OAuth / 凭证管理

#### F-30 WPS 应用凭证

- **代码位置**：`internal/config/config.go:83-84`
- **环境变量**：`WPS_APP_ID`, `WPS_APP_SECRET`, `WPS_ENCRYPT_KEY`
- **消费方**：
  - Go 侧：`wpsapi/client.go`, `webhook/crypto.go`
  - TS 侧：`claw-farm-channel/src/config-schema.ts`（通过 openclaw.json 注入）
- **问题**：全局单应用凭证，多租户下需每租户独立

#### F-31 OAuth 授权配置

- **代码位置**：`internal/config/config.go:119-120`
- **环境变量**：`OAUTH_CALLBACK_URL`, `OAUTH_SCOPES`
- **问题**：固定配置，不支持动态调整

---

### D8: 监控与可观测

#### F-32 日志级别

- **代码位置**：`internal/logging/logging.go:19`
- **当前实现**：`LOG_LEVEL` 环境变量，启动时解析
- **问题**：不支持运行时动态调整

---

## 3. 功能点归属矩阵

以下矩阵标注每个功能点应归属的管理位置：

| 功能点 | 当前 | 管理后台 (P1) | 管理后台 (P2) | 租户运营平台 |
|--------|------|:---:|:---:|:---:|
| F-01 白名单管理 | IM 命令 | **Y** | | Y (per-tenant) |
| F-02 管理员名单 | ENV | **Y** | | Y (per-tenant) |
| F-03 未注册用户拦截 | 硬编码 | | Y | |
| F-04 访问拒绝文案 | 硬编码 | | Y | Y (定制) |
| F-05 实例创建策略 | ENV | | Y | Y (配额) |
| F-06 Pod 资源规格 | ENV | **Y** | | Y (套餐) |
| F-07 PVC 存储配置 | ENV | | Y | Y (配额) |
| F-08 空闲回收 | ENV | | Y | Y (per-tenant) |
| F-09 实例重启 | IM 命令 | **Y** | | |
| F-10 工作空间轮转 | IM/API | | Y | Y (自助) |
| F-11 可用模型列表 | **硬编码** | **Y** | | Y (模型市场) |
| F-12 默认模型选择 | ENV | **Y** | | Y (per-tenant) |
| F-13 模型提供商配置 | **硬编码** | **Y** | | Y (BYOM) |
| F-14 LiteLLM Key 管理 | 自动 | | Y | Y (用量) |
| F-15 模型路由规则 | **硬编码** | **Y** | | |
| F-16 openclaw.json 生成 | **硬编码** | **Y** | | Y (模板) |
| F-17 AGENTS.md | **硬编码** | **Y** | | Y (定制) |
| F-18 BOOTSTRAP.md | **硬编码** | **Y** | | Y (品牌) |
| F-19 TOOLS.md | **硬编码** | **Y** | | Y (定制) |
| F-20 预装 Skill 列表 | **硬编码** | **Y** | | Y (选配) |
| F-21 Skill 白名单 | **硬编码** | **Y** | | Y (选配) |
| F-22 contextPruning | **硬编码** | | Y | |
| F-23 OpenViking 配置 | **硬编码** | | Y | |
| F-24 系统消息文案 | **硬编码** | | Y | Y (多语言) |
| F-25 广播通知 | IM 命令 | **Y** | | Y (per-tenant) |
| F-26 消息记录 | write-only | | Y | Y (分析) |
| F-27 消息队列超时 | ENV | | Y | |
| F-28 活动状态卡片 | **硬编码** | | Y | |
| F-29 版本更新卡片 | **硬编码** | | Y | |
| F-30 WPS 应用凭证 | ENV | | | Y (per-tenant) |
| F-31 OAuth 配置 | ENV | | | Y (per-tenant) |
| F-32 日志级别 | ENV | | Y | |

> **Y (P1)** = 管理后台 MVP 必须，**Y (P2)** = 管理后台二期，**Y (per-tenant)** = 多租户下每租户独立
