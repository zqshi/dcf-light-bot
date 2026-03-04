# SPEC: Admin Console Refactor For Matrix-Channel Multi-Tenant Hosting

## Goal
在保留现有后台视觉与交互风格的前提下，完成管理后台从“OpenClaw 强耦合控制台”到“多租户托管控制面”的领域重构。用户主操作渠道为 Matrix，OpenClaw 作为租户实例运行时，不直接暴露给最终用户。

## Product Principles
1. 用户无感 OpenClaw：用户只感知 Matrix 对话与数字员工卡片。
2. 平台只管托管：实例编排、隔离、监控、共享资产治理。
3. 租户数据隔离：实例与存储独立；跨租户仅通过共享资产中心与 Matrix 协作。
4. 共享优先：技能/工具/知识通过“上报-审核-发布-绑定”流转，避免私域沉淀。

## Scope
### In Scope
- 后台页面“换心不换皮”：复用样式、布局、组件、交互骨架。
- 重构页面数据模型与 API 契约到 DDD 边界。
- 新增 Matrix 渠道运营与租户实例编排能力视图。
- 新增真实用户 E2E（Matrix + browser-use）验收链路。

### Out Of Scope
- 完整重写 UI 风格体系。
- 自研 IM 客户端（采用 Matrix + Element Web）。
- 多云生产集群治理细节（先保留当前单环境能力）。

## Bounded Context Mapping
1. TenantInstance
- 负责数字员工实例生命周期：create/start/stop/rebuild/upgrade/delete。
- 输出实例状态、配额、健康、运行入口。

2. ChannelMatrix
- 负责 Matrix 用户、房间、命令路由、卡片消息。
- 提供“消息到实例动作”的编排入口。

3. SharedAssets
- 负责技能/工具/知识上报、审核、发布、版本、绑定。
- 提供共享资产可见性与审批轨迹。

4. IdentityAccess
- 负责后台账户、角色、权限、会话。

5. AuditCompliance
- 负责跨上下文审计事件、检索、导出、保留策略。

6. PlatformOps
- 负责健康、告警、SLO、成本与容量可视化。

## Reuse Strategy (UI)
### Direct Reuse
- 登录页、侧边导航、卡片/表格/抽屉组件、统一样式、权限门控前端逻辑。
- 审计日志表格与筛选交互骨架。

### Reuse With Refactor
- 总览页：保留布局，替换指标定义与数据源。
- 员工管理页：员工语义改为“租户实例”，动作映射到实例生命周期。
- 技能/工具管理页：保留表格与审批交互，重建为共享资产流程。
- 任务台账页：任务语义改为编排任务与渠道任务。

### New Pages/Sections
- Matrix 渠道运营：房间绑定、bot 状态、命令模板、消息投递状态。
- 租户隔离视图：namespace/pod/volume/networkPolicy 状态。
- 成本与闲置治理：实例利用率、自动休眠候选。

## Required API Contracts (BFF-Oriented)
1. `GET /api/admin/overview`
- 输出：实例总量、运行中、失败、待处理审批、Matrix 活跃会话、共享资产统计、SLO。

2. `GET /api/admin/instances`
- 支持筛选：state/tenantId/name/channel/updatedAt。
- 动作：`POST /api/admin/instances/:id/{start|stop|rebuild|delete}`。

3. `GET /api/admin/matrix/channels`
- 输出：房间、绑定实例、最近消息时间、失败投递计数。

4. `POST /api/admin/matrix/channels/:roomId/bind-instance`
- 将房间绑定到实例或实例组。

5. `GET /api/admin/assets/{skills|tools|knowledge}`
- 支持状态筛选：draft/pending_review/approved/published/rejected/offline。

6. `POST /api/admin/assets/:type/:id/{approve|reject|publish|rollback|bind}`
- 审批与发布动作具备审计记录。

7. `GET /api/admin/audits`
- 支持按 `context/entityId/action/result/operator/time-range` 检索。

## Data Model Alignment (UI View Model)
1. Employee -> InstanceVM
- id/name/tenantId/state/channel(roomId)/runtimeEndpoint/health/resourceQuota/updatedAt

2. Skill/Tool/Knowledge -> SharedAssetVM
- id/type/name/version/sourceTenant/status/reviewer/publishedAt/boundTenants

3. Task -> OrchestrationTaskVM
- id/type(target)/status/trigger(matrix|admin|system)/startedAt/duration/error

## Acceptance Criteria
1. 用户通过 Matrix 发送创建命令后，后台“员工管理”可见新实例。
2. 后台可对实例执行 start/stop/rebuild，状态在 10 秒内刷新可见。
3. 技能上报后可进入审核并发布，其他租户可绑定。
4. 审计日志可完整追踪：发起人、动作、对象、结果、时间。
5. `npm run check:all` 通过（包含 Matrix + browser-use 用户 E2E）。
6. 管理后台页面风格与既有视觉保持一致，无明显 UI 回归。
