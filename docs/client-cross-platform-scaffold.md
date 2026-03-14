# DCF 跨端客户端脚手架方案（可直接开工）

## 1. 目标与原则
- 目标：基于现有 `stitch_main_workspace_with_interactive_canvas` 风格，实现可交付客户的跨端客户端（Web + Desktop + Mobile）。
- 原则：
- 先交付业务可用，再逐步增强体验。
- UI 风格统一，业务逻辑统一，平台适配分层。
- 保留现有后端 API 与 Matrix 能力，不重复造后端。

## 2. 技术路线（推荐）
- Web：`React + TypeScript + Vite + Tailwind`
- Desktop：`Tauri`（加载 Web 产物，原生能力通过 Rust 插件桥接）
- Mobile：`React Native + Expo`（与 Web 共享领域层）
- 共享层：
- `packages/domain`: 业务实体、用例、状态模型
- `packages/api-sdk`: 后端 API 封装（鉴权、重试、错误标准化）
- `packages/ui-tokens`: 颜色/间距/字体/圆角/阴影/动效 token

## 3. 建议目录（Monorepo）
```txt
client-suite/
  apps/
    web/                  # React Web 主应用（开发最快）
    desktop/              # Tauri 壳工程（复用 web 构建产物）
    mobile/               # Expo RN 客户端
  packages/
    api-sdk/              # 对接 dcf-light-bot 后端 API
    matrix-sdk-wrapper/   # Matrix 登录、房间、消息能力封装（默认禁用 E2EE）
    domain/               # 会话、画布、通知、用户等领域模型
    ui-tokens/            # design tokens（来源于你提供的 stitch 视觉）
    ui-web/               # Web 组件（可选）
  docs/
    architecture.md
    ui-spec.md
    api-contract.md
```

## 4. 模块边界
- Shell 层（平台相关）：
- Web 路由、桌面窗口生命周期、移动端导航与权限。
- Domain 层（平台无关）：
- 会话列表、消息流、右侧画布状态机、搜索、草稿、同步状态。
- Infra 层（平台适配）：
- HTTP 客户端、Matrix 客户端、持久化、日志、埋点。

## 5. UI 落地规则（基于你给的原型）
- 三栏布局固定：
- 左主导航：64~70px
- 二级侧栏：260px 左右
- 中间聊天主区：自适应（`min-width: 400px`）
- 右画布：450~600px 可折叠
- Token 化：
- 主色 `#2b9dee`
- 深色背景 `#0f172a`
- 卡片圆角 `12px`
- 输入区高度与工具栏结构保持一致
- 主题：
- 同时支持 light/dark，默认跟随产品设定，不依赖系统强切换。

## 6. E2EE 策略（明确关闭）
- 客户端默认禁用 E2EE 初始化。
- 不展示任何加密验证、密钥备份、设备信任 UI。
- Matrix 房间列表默认过滤 `m.room.encryption` 房间。
- 固定服务台 alias 进入时若发现加密房间：
- 提示并自动切换到非加密房间 alias（由后端保障）。

## 7. 里程碑（建议 4 个 Sprint）
- Sprint 1（1-2 周）
- Web 骨架：登录、会话列表、消息收发、右侧画布空态
- Token 系统 + 基础组件库
- Sprint 2（1-2 周）
- 画布模块：文档卡片、图表卡片、地图卡片、Pin/展开
- 搜索、过滤、会话状态同步
- Sprint 3（1 周）
- Desktop（Tauri）打包与自动更新通道
- 客户端配置中心（环境、网关、日志级别）
- Sprint 4（1-2 周）
- Mobile（Expo）最小可用：会话/消息/画布只读
- 端到端测试与发布流程

## 8. 开发规范
- TypeScript strict 模式
- API 错误统一：`{ code, message, traceId }`
- 状态管理建议：`Zustand`（轻量）或 `Redux Toolkit`（大型团队）
- 测试：
- Domain 与 API 封装：单元测试
- 关键流程：Playwright（Web）+ Detox（移动可后置）

## 9. 与现仓库集成方式
- 当前仓库继续做后端与管理台，不直接替换。
- 新客户端工程建议放在仓库子目录 `client-suite/`，并行开发。
- 通过现有接口对接：
- `/api/...` 管理与业务 API
- Matrix homeserver API（通过 wrapper 收敛）

## 10. 立即开工清单（Day 1）
- 创建 `client-suite/` 基础目录与 package manager workspace。
- 落地 `ui-tokens`（先把颜色/字号/圆角/阴影配置化）。
- 初始化 `apps/web`，先复刻一版三栏主页面（无真实数据）。
- 接入 `api-sdk` 和 `matrix-sdk-wrapper` 的最小登录流。

