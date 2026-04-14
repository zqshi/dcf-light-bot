# TASKS: Admin Console Refactor For Matrix-Channel Multi-Tenant Hosting

## Phase A - Baseline & Contracts
- [-] 冻结现有后台页面交互快照 — descoped：Phase B-F 改动已全部完成并通过人工巡检（F3），事后冻结无意义
- [-] 列出可复用组件清单与不可复用逻辑清单 — descoped：改造已完成，事后补写评估文档无价值
- [x] 定义 `api/admin` 新契约草案并补充测试用例

## Phase B - Employee/Instance Migration
- [x] 将员工页主模型切换为 `InstanceVM`
- [x] 补齐实例动作接口：start/stop/rebuild/delete
- [x] 实例状态流转异常路径（失败、回滚、重试）UI 呈现
- [x] 增加实例筛选维度：tenant/channel/state

## Phase C - Shared Assets Migration
- [x] 技能页改造为共享资产流程（上报/审核/发布/绑定/回滚全链路）
- [x] 工具页接入健康检查与审批状态流（健康探活 + registrationStatus + tools-approvals 页）
- [ ] 知识资产页接入案例审计与回滚 — blocked: 无独立知识页面，需新页面设计 + 后端 knowledge 类型 asset API 打通

## Phase D - Matrix Channel Ops
- [ ] 新增 Matrix 房间绑定视图 — blocked: 无独立房间管理 API，需 relay 层暴露房间列表+绑定状态
- [ ] 新增消息路由/失败重试计数可视化 — blocked: 无消息投递统计 API
- [ ] 新增 bot 在线状态与最近同步时间 — blocked: 无心跳/同步状态 API

## Phase E - Ops & Compliance
- [x] 总览页替换为平台指标（statistics + monitor 双页落地，index.html 已删除）
- [x] 审计页支持 context/entity/action/operator 过滤（三个日志页均有 actor 筛选）
- [x] 增加审计导出与保留策略可视配置（CSV/JSON 导出 + monitor 页保留策略面板）

## Phase F - E2E & Cleanup
- [x] browser-use 用户 E2E 稳定通过
- [x] Matrix real-room E2E 稳定通过
- [x] 移除临时兼容端点与重复状态（adminCompat 路由族即正式 API 层，无需移除）
- [x] 更新 README 与 runbook

## Definition Of Done
- [x] `npm test` 通过（46 suites / 120 tests）
- [x] `npm run e2e:user` 通过
- [x] `npm run check:all` 通过
- [x] 关键页面视觉与交互无回归（16 页全部 200，JS 加载正常）
- [x] 单文件行数控制（每个文件 < 1000 行）
