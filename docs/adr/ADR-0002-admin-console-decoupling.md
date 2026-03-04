# ADR-0002: Admin Console Decoupling From OpenClaw Runtime

## Status
Accepted

## Context
当前后台存在“界面复用但领域耦合未拆干净”的问题：
- 页面语义与旧运行时对象绑定。
- 后台直接感知 OpenClaw 内部行为细节。
- Matrix 渠道语义未成为一等对象。

## Decision
采用“壳复用、领域重构、BFF 契约统一”策略：
1. 保留既有后台样式与交互框架。
2. 将后台能力重构为多上下文控制面模型（TenantInstance/ChannelMatrix/SharedAssets 等）。
3. OpenClaw 仅作为租户运行时，不作为后台主语义对象。
4. Matrix 作为主用户渠道，后台负责渠道运营与编排可视化。

## Consequences
### Positive
- 降低后台与 OpenClaw 内部实现耦合。
- 提高接口稳定性与可测试性。
- 支持共享资产沉淀与跨租户复用。

### Negative
- 需要维护一段时间兼容层。
- 初期存在双模型并存迁移成本。

## Follow-ups
- 在 `admin-refactor` 任务中逐页迁移并删除兼容端点。
- 保持所有关键路径具备契约测试与端到端测试。
