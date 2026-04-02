# DCF Light Bot — 开发规范

## 核心开发范式

### DDD（Domain-Driven Design）
- 严格分层：domain/ → infrastructure/ → application/ → presentation/
- domain 层零外部依赖，纯业务逻辑
- infrastructure 层封装所有外部接口（Matrix SDK、API 等）
- application 层编排用例，不含 UI 逻辑
- presentation 层只做渲染和用户交互

### TDD（Test-Driven Development）
- 新功能先写测试，再写实现
- 测试覆盖：domain 层 100%，infrastructure 适配器层关键路径覆盖
- 使用 vitest 作为测试框架
- 测试文件与源文件同目录，命名 `*.test.ts` / `*.test.tsx`

### 工程实践
- 每个文件 < 1000 行，超出必须拆分
- 代码整洁优雅，功能边界清晰
- 接口定义先行，实现跟随
- 每次修改评估影响范围，确保所有相关文件（接口、文档、脚本）同步更新
- 项目文档结构组织清晰，便于未来迭代维护

### Speckit 代码生成
- 遵循 Speckit 规范做代码生成
- 生成代码需通过 lint + type check + 测试三重验证

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS 3.4 + zustand
- **设计系统**: Apple HIG glass morphism，主色 `#007AFF`
- **暗色模式**: OpenClaw 通过 `[data-mode="openclaw"]` CSS 变量覆盖
- **测试**: vitest
- **包管理**: npm workspaces (client-suite/)

## 文件组织

```
client-suite/
  apps/web/src/
    domain/          # 纯业务逻辑，零依赖
    infrastructure/  # 外部适配器
    application/     # 用例编排 + zustand stores
    presentation/    # React 组件 + 路由
  packages/
    ui-tokens/       # 设计 token（colors, shadows, typography）
```
