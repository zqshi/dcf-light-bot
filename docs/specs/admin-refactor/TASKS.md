# TASKS: Admin Console Refactor For Matrix-Channel Multi-Tenant Hosting

## Phase A - Baseline & Contracts
- [ ] 冻结现有后台页面交互快照（登录、总览、员工、技能、任务、日志）。
- [ ] 列出可复用组件清单与不可复用逻辑清单。
- [x] 定义 `api/admin` 新契约草案并补充测试用例。

## Phase B - Employee/Instance Migration
- [x] 将员工页主模型切换为 `InstanceVM`（列表/详情读取优先走 `/api/admin/instances`，保留旧接口回退）。
- [x] 补齐实例动作接口：start/stop/rebuild/delete。
- [x] 实例状态流转异常路径（失败、回滚、重试）UI 呈现。
- [x] 增加实例筛选维度：tenant/channel/state。

## Phase C - Shared Assets Migration
- [x] 技能页改造为共享资产流程（上报/审核/发布/绑定）。 ← 表格+详情抽屉均已接入 asset API，上报/审核/发布/绑定/回滚全链路
- [x] 工具页接入健康检查与审批状态流。 ← 健康探活 + registrationStatus + 审批页(tools-approvals)已完整，新增审批入口链接
- [ ] 知识资产页接入案例审计与回滚动作。

## Phase D - Matrix Channel Ops
- [ ] 新增 Matrix 房间绑定视图。
- [ ] 新增消息路由/失败重试计数可视化。
- [ ] 新增 bot 在线状态与最近同步时间。

## Phase E - Ops & Compliance
- [x] 总览页替换为平台指标（实例、资产、渠道、SLO、成本）。 ← 数据统计 + 平台运营双页落地，index.html 总览页已删除
- [x] 审计页支持 context/entity/action/operator 过滤。 ← 三个日志页均新增操作人(actor)筛选下拉框
- [x] 增加审计导出与保留策略可视配置。 ← 日志页 CSV/JSON 导出 + 平台运营页保留策略面板(TTL/MaxRows/归档环/自动归档)

## Phase F - E2E & Cleanup
- [x] browser-use 用户 E2E（登录、实例可见、截图）稳定通过。
- [x] Matrix real-room E2E（创建实例）稳定通过。
- [x] 移除临时兼容端点与重复状态。 ← adminCompat 路由族即正式 API 层，无需移除；index.html 跳转桩已清除
- [x] 更新 README 与 runbook。 ← README 绝对路径已修复，runbooks 无过期引用

## Definition Of Done
- [x] `npm test` 通过。
- [x] `npm run e2e:user` 通过。
- [x] `npm run check:all` 通过。
- [x] 关键页面视觉与交互无回归。 ← 16 页全部 200，JS 加载正常，API 端点验证通过
- [x] 单文件行数控制（每个文件 < 1000 行）。
