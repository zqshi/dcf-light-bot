# DCF Light Bot 全面优化计划
> 基于 ClawManager 对比分析

生成时间：2026-04-04

---

## 一、对比结论总览

### 1.1 ClawManager 核心优势

| 模块 | ClawManager 特性 | DCF 现状 | 差距 |
|--------|----------------|------------|------|
| **风险控制** | 内置 6 类规则（隐私/公司/安全/财务），正则匹配，自动动作（block/route_secure_model），规则测试 UI | 有基础实现但规则单一 | 严重 |
| **模型管理** | 15+ 供应商模板，模型发现 API，per-model 定价，secure/regular 分级 | 有定价但无模板/发现 | 中 |
| **成本核算** | token × 单价 = 费用，多维度分析（用户/模型/日），多币种支持 | 有 token 计数但无费用计算 | 中 |
| **审计追踪** | trace_id 全链路追踪，request/response 完整记录，flow 节点可视化 | 有 trace 结构但 flow 是 mock | 中 |
| **实例生命周期** | 完整 CRUD + start/stop/restart/sync，K8s 原生 | 无 | 严重 |
| **用户配额** | per-user CPU/内存/存储/GPU/实例数限制 | 无 | 严重 |
| **CSV 批量导入** | 支持批量导入用户 | 无 | 低 |
| **前端架构** | React SPA + 复用组件（AdminLayout/ConfirmDialog） | Vanilla HTML/JS MPA，代码重复严重 | 高 |
| **国际化** | 内建 5 语言（中/英/日/韩/德） | 全中文硬编码 | 中 |
| **实时更新** | WebSocket 推送 | 无 | 中 |

### 1.2 DCF 现有亮点

| 亮点 | 说明 |
|------|------|
| **AI Gateway 4-Tab 设计** | 模型/审计/成本/规则分栏，UI 结构清晰 |
| **SVG 图表系统** | 统计页有纯原生 SVG 绘图，轻量且可控 |
| **权限系统** | admin-runtime.page.* 粒度的权限控制 |
| **OpenClaw 配置中心** | 支持配置计划和模板导入导出 |
| **行为日志** | 多维度日志筛选（scope/module/operation/status/trace） |
| **决策路由** | 决策触发机制与 OpenClaw 协同 |

---

## 二、优化优先级矩阵

| 优先级 | 优化项 | 工作量 | 影响范围 | 依赖 |
|--------|---------|--------|----------|------|
| P0 | 数据持久化 | 高 | 全局 | - |
| P0 | 风控规则完善 | 中 | AI Gateway | 持久化 |
| P1 | 成本核算升级 | 中 | 统计页 | 持久化 |
| P1 | 模型供应商模板 | 低 | AI Gateway | - |
| P1 | 前端组件化 | 高 | 全前端 | - |
| P2 | 实例生命周期管理 | 高 | 员工/共享 Agent | K8s 集成 |
| P2 | 用户配额系统 | 中 | 成员管理 | 持久化 |
| P2 | WebSocket 实时推送 | 中 | 全局 | - |
| P3 | 国际化支持 | 中 | 全前端 | - |
| P3 | CSV 批量导入 | 低 | 成员管理 | - |
| P4 | 用户自助 Dashboard | 中 | 新增页面 | - |

---

## 三、分阶段实施方案

### Phase 1: 基础设施（P0）- 1-2 周

#### 1.1 数据持久化
```
目标：从 In-Memory Map 迁移到 SQLite/MySQL

任务：
□ 选择数据库（推荐 SQLite 开发，生产 MySQL）
□ 设计 Schema（参考 ClawManager migrations）
□ 实现 Repository 层（抽象接口）
□ 数据迁移工具（现有 Map → 新 DB）
□ 迁移 AI Gateway 数据（traces, models, risk_rules）
□ 迁移用户/权限数据
□ 迁移 OpenClaw 配置
□ 数据库连接池管理
□ 回滚方案（保留 Map 双写 2 周）

API 变更：
- 所有 GET 端点：从 Map.values() 改为 repo.List()
- 所有 POST 端点：从 map.set() 改为 repo.Create()
```

#### 1.2 风控规则完善
```
目标：参考 ClawManager 内置规则集

任务：
□ 新增规则分类（privacy/company/security/finance/political/custom）
□ 内置规则库扩展：
  - private_key_marker：PEM 私钥检测
  - api_key_like：API Key 格式检测
  - credential_assignment：凭据赋值
  - private_ip：内网 IP
  - email_address：邮箱地址
  - cn_mobile_number：手机号
  - cn_id_card：身份证号
□ 规则可视化分类（不同类别不同颜色/图标）
□ 规则优先级排序（sortOrder）
□ 规则启用/禁用开关
□ 批量操作（全选启用/禁用）

数据结构：
interface RiskRule {
  ruleId: string;           // 规则标识
  displayName: string;        // 显示名称
  description: string;        // 描述
  pattern: string;           // 正则表达式
  severity: 'low' | 'medium' | 'high';
  action: 'allow' | 'route_secure_model' | 'block';
  isEnabled: boolean;         // 是否启用
  category: 'privacy' | 'company' | 'customer' | 'security' | 'financeLegal' | 'political' | 'custom';
  sortOrder: number;          // 排序
  createdAt: string;
  updatedAt: string;
}
```

---

### Phase 2: AI Gateway 增强（P1）- 1-2 周

#### 2.1 模型供应商模板化
```javascript
// 文件位置：src/interfaces/http/admin-ui/ai-gateway-templates.js

const PROVIDER_TEMPLATES = [
  {
    id: 'openai',
    label: 'OpenAI',
    providerType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    icon: 'openai.svg'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    providerType: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    icon: 'deepseek.ico'
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    providerType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    icon: 'anthropic.svg'
  },
  // ... 其他 12 个供应商
];

// 后端 API：GET /api/admin/ai-gateway/providers
```

#### 2.2 模型发现 API
```
场景：用户选择供应商后，可点击"发现模型"自动拉取可用模型列表

实现：
□ 前端：添加"发现模型"按钮
□ 后端：实现 /models/discover 端点
  - 调用供应商 API 列出模型
  - 缓存结果（5 分钟 TTL）
  - 返回 DiscoveredModel[] 格式

数据结构：
interface DiscoveredModel {
  id: string;              // 唯一标识
  displayName: string;       // 模型显示名
  providerModelName: string; // 上游模型名
  pricing?: {              // 定价信息
    inputPrice: number;
    outputPrice: number;
    currency: string;
  };
}

支持供应商：
- OpenAI：/v1/models
- DeepSeek：/v1/models
- Zhipu：/api/paas/v4/models
- DashScope：/compatible-mode/v1/models
```

#### 2.3 成本核算多币种支持
```
目标：支持 CNY/USD 货币，汇率转换

任务：
□ 汇率接口（每日汇率缓存）
□ 成本统一为 CNY 展示
□ 货币选择器
□ 汇率显示更新时间

数据结构：
interface CostRecord {
  traceId: string;
  userId: string;
  model: string;
  providerType: string;
  promptTokens: number;
  completionTokens: number;
  inputPrice: number;      // 单价（原始货币）
  outputPrice: number;
  currency: string;          // 原始币种
  exchangeRate: number;      // 汇率
  costCNY: number;          // 折合 CNY
  createdAt: string;
}
```

#### 2.4 Flow 节点真实化
```
当前状态：flow 节点是 mock 数据
目标：从真实 LLM 调用记录 flow 节点

任务：
□ 定义 FlowNode 类型：
  - user_message：用户输入
  - llm_call：LLM 调用
  - tool_call：工具调用
  - assistant_response：助手响应
  - risk_check：风险检测
  - error：错误处理

□ flow 节点记录时机：
  - 请求进入时记录 user_message
  - 风险检测记录 risk_check（如有命中）
  - LLM 调用前记录 llm_call（pending）
  - LLM 响应后更新 llm_call（success/error）
  - 工具调用记录 tool_call
  - 最终响应记录 assistant_response

□ 前端渲染：
  - 垂直时间线
  - 节点状态颜色（success=绿/error=红/blocked=橙）
  - Payload 折叠展示（可 JSON 格式化）
```

---

### Phase 3: 用户与实例管理（P2）- 2-3 周

#### 3.1 用户配额系统
```
数据结构：
interface UserQuota {
  userId: string;
  maxInstances: number;       // 最大实例数
  maxCPUCores: number;        // 最大 CPU 核心数
  maxMemoryGB: number;        // 最大内存 GB
  maxStorageGB: number;       // 最大存储 GB
  maxGPUCount: number;        // 最大 GPU 数
  usedInstances: number;
  usedCPUCores: number;
  usedMemoryGB: number;
  usedStorageGB: number;
  usedGPUCount: number;
}

任务：
□ 配额管理页面（管理员）
□ 配额检查（创建实例时验证）
□ 配额可视化（进度条显示使用率）
□ 配额告警（达到 80% 通知）

API 端点：
- GET /api/admin/quota/:userId - 获取用户配额
- PUT /api/admin/quota/:userId - 更新配额
- GET /api/quota - 当前用户配额（自助）
```

#### 3.2 实例生命周期管理
```
新增页面：instances.html / instances.js

任务：
□ 实例列表（状态筛选：running/stopped/error）
□ 实例详情（资源使用、状态、日志）
□ 实例操作：
  - 创建实例
  - 启动/停止
  - 重启
  - 删除
  - 同步状态
□ 实例日志查看

状态机：
pending → starting → running → stopping → stopped → deleting
```

#### 3.3 CSV 批量导入
```
CSV 格式：
Username,Email,Role,Max Instances,Max CPU Cores,Max Memory (GB),Max Storage (GB)

任务：
□ 导入模版下载
□ CSV 解析（验证格式）
□ 批量创建用户
□ 导入结果反馈（成功/失败数量）

API 端点：
POST /api/admin/users/import
```

---

### Phase 4: 前端现代化（P1/P2）- 3-4 周

#### 4.1 组件化改造
```
原则：复用优先，减少重复

□ 创建公共组件：
  - AdminLayout：侧栏 + 顶部导航
  - Card：统一卡片样式
  - Table：统一表格 + 分页
  - Drawer：右侧抽屉（新增/编辑）
  - ConfirmDialog：确认弹窗
  - Toast：消息提示
  - Badge：状态徽章
  - StatCard：统计卡片
  - Chart：图表容器

□ 页面拆分：
  - components/          公共组件
  - pages/            页面逻辑
  - styles/            样式分离
  - lib/              工具函数
```

#### 4.2 WebSocket 实时推送
```
场景：
- 实时 trace 更新
- 风险告警推送
- 实例状态变更
- 配额告警

实现：
□ WebSocket 服务器端
□ 前端连接管理（自动重连）
□ 消息类型区分
□ 心跳机制

消息格式：
interface WSMessage {
  type: 'trace' | 'alert' | 'instance' | 'quota';
  data: any;
  timestamp: number;
}
```

#### 4.3 国际化支持
```
文件结构：
/locales/
  - zh-CN.json  # 简体中文
  - en-US.json   # 英语
  - ja-JP.json   # 日语
  - ko-KR.json   # 韩语

工具函数：
function t(key, params = {}) {
  const locale = window.locale || 'zh-CN';
  const messages = window.i18n[locale];
  let msg = messages[key] || key;
  for (const [k, v] of Object.entries(params)) {
    msg = msg.replace(`{${k}}`, v);
  }
  return msg;
}

语言切换器：
<select id="localeSelector">
  <option value="zh-CN">简体中文</option>
  <option value="en-US">English</option>
  <option value="ja-JP">日本語</option>
  <option value="ko-KR">한국어</option>
</select>
```

---

## 四、技术债务清理

### 4.1 死代码清理
```
□ 删除已移除页面：
  - autoevolve.html/js
  - employees-contracts.html/js
  - employees-growth.html/js
  - oss.html/js
  - prompts.html/js
  - runtime-advanced.html/js
  - logs.html（已拆分为 agent/service/admin）

□ 清理未使用导入
□ 清理注释代码
□ 统一代码格式（统一缩进 2 空格）
```

### 4.2 样式统一
```
□ 统一颜色变量（CSS 变量）
□ 统一间距/圆角
□ 统一阴影/边框
□ 响应式适配（mobile）
```

---

## 五、验证清单

### Phase 1 验收
□ 数据库持久化完成，重启不丢失数据
□ 风控规则 CRUD 正常，内置规则集生效
□ 审计日志可追溯 trace_id 全链路

### Phase 2 验收
□ 供应商模板可用，base URL 自动填充
□ 模型发现功能可用，返回模型列表
□ 成本支持多币种，汇率正常显示
□ Flow 节点从真实数据渲染

### Phase 3 验收
□ 用户配额生效，创建实例时验证
□ 实例生命周期完整，状态变更正常
□ CSV 导入可用，结果准确

### Phase 4 验收
□ 公共组件复用率 > 60%
□ WebSocket 连接稳定，消息实时到达
□ 语言切换生效，界面文本正确翻译

---

## 六、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据迁移风险 | 双写 2 周，保留回滚脚本 |
| Breaking Change（前端重构） | 采用渐进式改造，先新后旧 |
| 汇率波动 | 每日更新汇率，保留历史汇率 |
| K8s 依赖 | 使用 Mock Service 模拟 K8s API（演示环境） |
| WebSocket 稳定性 | 降级到轮询（10s 间隔） |

---

## 七、参考资源

### ClawManager 关键文件
```
frontend/src/lib/modelProviderTemplates.ts      # 供应商模板
frontend/src/pages/admin/RiskRulesPage.tsx     # 风控规则 UI
backend/internal/services/risk_rule_service.go   # 风控规则逻辑
backend/internal/services/risk_detection_service.go  # 风险检测引擎
backend/internal/services/llm_model_service.go      # 模型管理
backend/internal/services/cost_record_service.go     # 成本记录
backend/internal/aigateway/service.go                # AI Gateway 核心服务
```

### DCF 现有文件需改造
```
src/interfaces/http/admin-ui/ai-gateway.js           # 增强 flow/发现
src/interfaces/http/routes/adminCompatAIGateway.js   # 持久化适配
src/interfaces/http/admin-ui/index.js                  # 增加组件复用
src/interfaces/http/admin-ui/auth-members.js          # CSV 导入
```
