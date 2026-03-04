# TASKS: Admin Console Refactor For Matrix-Channel Multi-Tenant Hosting

## Phase A - Baseline & Contracts
- [ ] 冻结现有后台页面交互快照（登录、总览、员工、技能、任务、日志）。
- [ ] 列出可复用组件清单与不可复用逻辑清单。
- [x] 定义 `api/admin` 新契约草案并补充测试用例。

## Phase B - Employee/Instance Migration
- [x] 将员工页主模型切换为 `InstanceVM`（列表/详情读取优先走 `/api/admin/instances`，保留旧接口回退）。
- [x] 补齐实例动作接口：start/stop/rebuild/delete。
- [ ] 实例状态流转异常路径（失败、回滚、重试）UI 呈现。
- [ ] 增加实例筛选维度：tenant/channel/state。

## Phase C - Shared Assets Migration
- [ ] 技能页改造为共享资产流程（上报/审核/发布/绑定）。
- [ ] 工具页接入健康检查与审批状态流。
- [ ] 知识资产页接入案例审计与回滚动作。

## Phase D - Matrix Channel Ops
- [ ] 新增 Matrix 房间绑定视图。
- [ ] 新增消息路由/失败重试计数可视化。
- [ ] 新增 bot 在线状态与最近同步时间。

## Phase E - Ops & Compliance
- [ ] 总览页替换为平台指标（实例、资产、渠道、SLO、成本）。
- [ ] 审计页支持 context/entity/action/operator 过滤。
- [ ] 增加审计导出与保留策略可视配置。

## Phase F - E2E & Cleanup
- [ ] browser-use 用户 E2E（登录、实例可见、截图）稳定通过。
- [ ] Matrix real-room E2E（创建实例）稳定通过。
- [ ] 移除临时兼容端点与重复状态。
- [ ] 更新 README 与 runbook。

## Definition Of Done
- [ ] `npm test` 通过。
- [ ] `npm run e2e:user` 通过。
- [ ] `npm run check:all` 通过。
- [ ] 关键页面视觉与交互无回归。
- [ ] 单文件行数控制（每个文件 < 1000 行）。
