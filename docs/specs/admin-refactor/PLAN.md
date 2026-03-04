# PLAN: Admin Console Refactor For Matrix-Channel Multi-Tenant Hosting

## Architecture Strategy
采用“前端壳复用 + BFF 契约重构 + 领域服务迁移”三段式策略。

1. Frontend Shell Reuse
- 保留 `admin-ui` 页面结构与样式。
- 将每页脚本收敛为：`page init` + `api adapter` + `render` + `actions`。

2. BFF Contract Stabilization
- 新增/统一 `api/admin/*` 契约，屏蔽底层编排实现。
- 通过兼容层过渡，最终移除临时兼容字段。

3. Domain Migration
- 将旧耦合逻辑迁移到 6 个上下文服务。
- 页面只消费 ViewModel，不拼接基础设施细节。

## Phase Plan
### Phase A: Baseline Freeze (1-2 days)
- 冻结现有 UI 资源与交互行为快照。
- 建立页面回归检查清单（登录、导航、表格、抽屉、权限控件）。

### Phase B: Core Domain Page Migration (3-5 days)
- 员工管理 -> 实例管理语义迁移。
- 技能/工具管理 -> 共享资产流转迁移。
- 总览页 -> 平台指标迁移。

### Phase C: Channel + Ops (2-4 days)
- 新增 Matrix 渠道运营视图。
- 新增隔离状态与成本治理卡片。

### Phase D: Compatibility Cleanup (1-2 days)
- 下线临时兼容路由与重复状态。
- 收敛 API 字段与错误码。

## Testing Strategy (TDD)
1. Contract First
- 先写路由契约测试（状态码、字段、错误）。

2. Domain Unit Tests
- 实例生命周期、资产状态机、渠道绑定规则。

3. Integration Tests
- Matrix 命令 -> 实例创建 -> 后台可见。
- 资产上报 -> 审核 -> 发布 -> 绑定。

4. E2E Tests
- browser-use：登录后台、查询实例、截图留证。
- Matrix real-room：真实用户消息触发流程。

## Risk And Mitigation
1. 风险：旧字段被页面隐式依赖。
- 对策：每页引入 ViewModel 适配器层，逐页切换。

2. 风险：限流/重启导致 E2E 不稳定。
- 对策：本地环境限流豁免、脚本幂等、重试策略。

3. 风险：兼容层长期滞留。
- 对策：每个兼容端点标记清理截止版本。

## Deliverables
- `SPEC/PLAN/TASKS` 文档完整。
- ADR（后台去耦决策）落地。
- 关键页面改造 + 回归报告 + E2E 证据截图。
