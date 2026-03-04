# API Contract: 客户端形态对齐接口

## 1. 用户侧入口

### 1.1 Matrix 命令入口
- `POST /api/integrations/matrix/commands`
- 功能：接收 `!create_agent` 等命令并触发实例流程。

### 1.2 Matrix Relay
- Matrix 房间消息 -> 控制面命令路由 -> 实例执行。

## 2. 管理端（BFF）

### 2.1 总览
- `GET /api/admin/overview`
- 返回（核心）：
  - `overview.platform`: 实例、租户、状态分布
  - `overview.assets`: 共享资产、绑定数、待审/逾期
  - `overview.operations`: 审计事件统计
  - `overview.security`: 用户/禁用用户/角色
- 兼容字段保留：`delivery/governance/assets/runtime/focus`

### 2.2 员工（实例）
- `GET /api/admin/instances`
- `GET /api/admin/instances/:id`
- `POST /api/admin/instances/:id/start`
- `POST /api/admin/instances/:id/stop`
- `POST /api/admin/instances/:id/rebuild`
- `POST /api/admin/instances/:id/delete`

### 2.3 共享资产
- `GET /api/admin/assets/:type` (`skill|tool|knowledge`)
- `GET /api/admin/assets/:type/:id`
- `POST /api/admin/assets/:type/reports`
- `POST /api/admin/assets/:type/:id/:action`
  - `approve|reject|publish|bind|rollback|deploy|verify`

### 2.4 日志
- `GET /api/admin/logs`

### 2.5 权限
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/acl`
- `GET/POST /api/admin/auth/users`
- `GET/POST /api/admin/auth/roles`

## 3. 错误约定
- 未登录：`401`
- 无权限：`403`
- 纯净后台禁用端点：`404 { error: "endpoint disabled in pure admin mode" }`
- 参数错误：`400`
