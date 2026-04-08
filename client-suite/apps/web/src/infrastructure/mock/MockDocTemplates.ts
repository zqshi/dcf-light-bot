/**
 * MockDocTemplates — 文档生成 Mock 模板
 * 为 Doc Editor D 栏面板提供 Tiptap 兼容 HTML 内容（按章节拆分）
 */

export interface DocTemplate {
  title: string;
  sections: Array<{ title: string; html: string }>;
}

const API_SECURITY_DOC: DocTemplate = {
  title: 'API 安全技术文档',
  sections: [
    {
      title: '概述',
      html: `<h1>API 安全技术文档</h1>
<p>本文档系统梳理了 API 安全的核心防护策略，涵盖认证授权、数据加密、流量控制及审计监控四大领域。适用于微服务架构下的 RESTful / GraphQL API 安全加固。</p>
<blockquote><p>安全不是一次性事件，而是持续迭代的工程实践。</p></blockquote>
<h2>威胁全景</h2>
<ul>
<li><strong>注入攻击</strong>：SQL 注入、NoSQL 注入、命令注入</li>
<li><strong>认证绕过</strong>：弱密码、Token 泄露、会话劫持</li>
<li><strong>数据泄露</strong>：过度暴露字段、日志中的敏感信息</li>
<li><strong>DDoS / CC 攻击</strong>：接口级流量洪峰</li>
</ul>`,
    },
    {
      title: '认证与授权',
      html: `<h2>认证与授权机制</h2>
<p>系统采用 <strong>OAuth 2.0 + JWT</strong> 双层认证架构，确保服务间通信和用户访问的安全性。</p>
<h3>Token 策略</h3>
<table>
<thead><tr><th>Token 类型</th><th>签名算法</th><th>有效期</th><th>存储位置</th></tr></thead>
<tbody>
<tr><td>Access Token</td><td>RS256</td><td>15 分钟</td><td>内存 / httpOnly Cookie</td></tr>
<tr><td>Refresh Token</td><td>HS256</td><td>7 天</td><td>httpOnly Cookie</td></tr>
<tr><td>Service Token</td><td>RS256</td><td>1 小时</td><td>Vault / 环境变量</td></tr>
</tbody>
</table>
<h3>代码示例</h3>
<pre><code>// JWT 签名验证中间件
import jwt from 'jsonwebtoken';

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}</code></pre>
<h3>RBAC 权限模型</h3>
<p>基于角色的访问控制（RBAC）通过 <code>role → permission → resource</code> 三层映射实现细粒度的 API 权限管理。</p>
<ul>
<li><strong>Admin</strong>：全部资源的读写权限</li>
<li><strong>Editor</strong>：内容资源读写 + 用户资源只读</li>
<li><strong>Viewer</strong>：全部资源只读</li>
</ul>`,
    },
    {
      title: '数据安全',
      html: `<h2>数据安全</h2>
<h3>传输层加密</h3>
<p>所有 API 通信强制使用 <strong>TLS 1.3</strong>，禁用旧版本协议。证书管理通过 Let's Encrypt 自动轮换，配合 HSTS 头确保浏览器端强制 HTTPS。</p>
<h3>敏感字段处理</h3>
<ul>
<li><strong>请求参数脱敏</strong>：密码字段在日志中替换为 <code>***</code></li>
<li><strong>响应过滤</strong>：通过 DTO 投影层控制返回字段，避免暴露内部 ID、创建时间等非必要信息</li>
<li><strong>PII 标记</strong>：个人身份信息在存储层使用 AES-256-GCM 加密，密钥通过 KMS 管理</li>
</ul>
<pre><code>// 响应字段过滤示例
function sanitizeUser(user) {
  const { passwordHash, internalId, ...safe } = user;
  return { ...safe, email: maskEmail(safe.email) };
}</code></pre>`,
    },
    {
      title: '限流与防护',
      html: `<h2>限流与防护策略</h2>
<h3>多级限流架构</h3>
<table>
<thead><tr><th>层级</th><th>策略</th><th>阈值</th><th>实现</th></tr></thead>
<tbody>
<tr><td>全局</td><td>固定窗口</td><td>10,000 req/min</td><td>Nginx limit_req</td></tr>
<tr><td>用户</td><td>滑动窗口</td><td>100 req/min</td><td>Redis + Lua</td></tr>
<tr><td>接口</td><td>令牌桶</td><td>按接口配置</td><td>Express middleware</td></tr>
</tbody>
</table>
<h3>防护措施</h3>
<ul>
<li><strong>WAF 规则</strong>：拦截 SQL 注入、XSS、路径穿越等 OWASP Top 10 攻击模式</li>
<li><strong>IP 黑名单</strong>：异常行为自动加入临时黑名单（30 分钟衰减）</li>
<li><strong>Bot 检测</strong>：基于请求指纹和行为分析识别恶意爬虫</li>
</ul>
<pre><code>// Redis 滑动窗口限流
async function rateLimit(userId, limit, windowMs) {
  const key = \`rate:\${userId}\`;
  const now = Date.now();
  await redis.zremrangebyscore(key, 0, now - windowMs);
  const count = await redis.zcard(key);
  if (count >= limit) throw new TooManyRequestsError();
  await redis.zadd(key, now, \`\${now}\`);
  await redis.expire(key, Math.ceil(windowMs / 1000));
}</code></pre>`,
    },
    {
      title: '审计与监控',
      html: `<h2>审计与监控</h2>
<h3>审计日志规范</h3>
<p>所有敏感操作（认证、授权变更、数据修改）必须记录结构化审计日志，包含以下字段：</p>
<ul>
<li><code>timestamp</code> — ISO 8601 格式</li>
<li><code>actor</code> — 操作者身份（userId / serviceId）</li>
<li><code>action</code> — 操作类型（create / update / delete / access）</li>
<li><code>resource</code> — 目标资源标识</li>
<li><code>outcome</code> — 结果（success / failure + reason）</li>
<li><code>sourceIp</code> — 来源 IP</li>
</ul>
<h3>异常检测</h3>
<p>基于时序分析的异常检测系统监控以下指标：</p>
<ul>
<li><strong>认证失败率</strong>：单 IP 5 分钟内失败超过 10 次 → 告警</li>
<li><strong>接口延迟</strong>：P99 延迟超过 SLO 的 150% → 告警</li>
<li><strong>数据访问模式</strong>：单用户短时间内批量导出 → 风控审查</li>
</ul>
<blockquote><p>合规要求：审计日志保留 180 天，不可篡改，支持 SOC 2 Type II 审计取证。</p></blockquote>`,
    },
  ],
};

const ARCH_DESIGN_DOC: DocTemplate = {
  title: '系统架构设计文档',
  sections: [
    {
      title: '概述',
      html: `<h1>系统架构设计文档</h1>
<p>本文档描述数字员工协作平台（DCF）的整体技术架构，包括系统分层、核心组件、数据流转和部署方案。</p>
<h2>设计目标</h2>
<ul>
<li><strong>可扩展性</strong>：支持水平扩展，单集群承载 10,000 并发 Agent</li>
<li><strong>可观测性</strong>：全链路追踪，分钟级故障定位</li>
<li><strong>安全性</strong>：零信任网络架构，端到端加密</li>
</ul>`,
    },
    {
      title: '系统架构',
      html: `<h2>系统架构</h2>
<h3>分层模型</h3>
<p>系统采用 <strong>DDD（领域驱动设计）</strong> 四层架构：</p>
<table>
<thead><tr><th>层级</th><th>职责</th><th>技术选型</th></tr></thead>
<tbody>
<tr><td>Presentation</td><td>UI 渲染、用户交互</td><td>React + TypeScript + Tailwind</td></tr>
<tr><td>Application</td><td>用例编排、状态管理</td><td>Zustand + Custom Hooks</td></tr>
<tr><td>Domain</td><td>核心业务逻辑</td><td>纯 TypeScript，零外部依赖</td></tr>
<tr><td>Infrastructure</td><td>外部适配（API、存储）</td><td>Adapter Pattern</td></tr>
</tbody>
</table>
<h3>通信协议</h3>
<ul>
<li><strong>Agent ↔ 平台</strong>：Matrix 协议（E2EE 加密）</li>
<li><strong>前端 ↔ 后端</strong>：REST + SSE（Server-Sent Events）</li>
<li><strong>Agent ↔ Agent</strong>：事件总线（pub/sub）</li>
</ul>`,
    },
    {
      title: '数据模型',
      html: `<h2>数据模型</h2>
<h3>核心实体</h3>
<pre><code>Agent {
  id: string
  name: string
  capabilities: Capability[]
  status: 'idle' | 'working' | 'offline'
  channels: ChannelConnection[]
}

AgentTask {
  id: string
  agentId: string
  name: string
  progress: number
  subtasks: Subtask[]
  logs: ExecutionLog[]
}

DecisionRequest {
  id: string
  title: string
  context: string
  recommendation: Option
  alternatives: Option[]
  urgency: 'low' | 'medium' | 'high' | 'critical'
}</code></pre>`,
    },
    {
      title: 'API 设计',
      html: `<h2>API 设计</h2>
<h3>RESTful 接口规范</h3>
<p>所有 API 遵循 <code>/api/v1/{resource}</code> 命名规范，返回统一的响应结构：</p>
<pre><code>{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 },
  "error": null
}</code></pre>
<h3>核心接口列表</h3>
<table>
<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
<tbody>
<tr><td>GET</td><td>/api/v1/agents</td><td>获取 Agent 列表</td></tr>
<tr><td>POST</td><td>/api/v1/agents/:id/tasks</td><td>为 Agent 创建任务</td></tr>
<tr><td>GET</td><td>/api/v1/decisions</td><td>获取待决策列表</td></tr>
<tr><td>POST</td><td>/api/v1/decisions/:id/respond</td><td>响应决策请求</td></tr>
</tbody>
</table>`,
    },
    {
      title: '部署方案',
      html: `<h2>部署方案</h2>
<h3>容器化部署</h3>
<p>全部服务容器化部署于 Kubernetes 集群，通过 Helm Chart 管理配置。</p>
<ul>
<li><strong>前端</strong>：Nginx 静态资源服务 + CDN 分发</li>
<li><strong>后端</strong>：Node.js 服务，HPA 自动扩缩（CPU 70% 阈值）</li>
<li><strong>Matrix 服务</strong>：Synapse 单实例（演示阶段）</li>
<li><strong>存储</strong>：PostgreSQL（主从复制）+ Redis Cluster</li>
</ul>
<h3>监控告警</h3>
<p>基于 Prometheus + Grafana 的监控体系，核心指标：</p>
<ul>
<li>API P99 延迟 < 200ms</li>
<li>Agent 在线率 > 99.5%</li>
<li>任务完成率 > 95%</li>
</ul>`,
    },
  ],
};

const USER_GUIDE_DOC: DocTemplate = {
  title: '平台用户指南',
  sections: [
    {
      title: '入门',
      html: `<h1>DCF 数字员工协作平台 — 用户指南</h1>
<p>欢迎使用数字员工协作平台！本指南帮助您快速上手平台核心功能。</p>
<h2>快速开始</h2>
<ol>
<li>登录平台（支持企业 SSO / Matrix 账号）</li>
<li>创建您的数字分身（Primary Agent）</li>
<li>连接外部渠道（飞书 / Slack / 邮件）</li>
<li>开始与 Agent 协作</li>
</ol>`,
    },
    {
      title: '核心功能',
      html: `<h2>核心功能</h2>
<h3>多渠道消息聚合</h3>
<p>平台自动汇聚来自飞书、Slack、邮件等渠道的消息，Agent 实时分析并分类处理：</p>
<ul>
<li><strong>自动处理</strong>：Agent 置信度高的消息，自动回复并通知用户</li>
<li><strong>人工审阅</strong>：Agent 无法独立决策的消息，标记为"需要人工介入"</li>
</ul>
<h3>任务管理</h3>
<p>通过自然语言创建任务，Agent 自动拆解子任务并执行。实时查看：</p>
<ul>
<li>任务进度和子任务状态</li>
<li>Agent 推理过程（CoT 思维链）</li>
<li>执行日志和错误信息</li>
</ul>
<h3>决策协助</h3>
<p>当 Agent 遇到需要人类判断的场景时，会生成决策请求，提供：</p>
<ul>
<li>问题上下文和影响分析</li>
<li>推荐方案和备选方案</li>
<li>风险评估和预期收益</li>
</ul>`,
    },
    {
      title: '高级功能',
      html: `<h2>高级功能</h2>
<h3>应用构建</h3>
<p>通过自然语言描述需求，Agent 可以实时构建轻量级 Web 应用。在对话中输入如"帮我创建一个天气查询应用"，即可在右侧面板中看到实时构建过程。</p>
<h3>文档生成</h3>
<p>Agent 支持根据描述自动生成结构化文档（技术文档、设计文档、用户指南等），生成后可在内置编辑器中直接修改。</p>
<h3>多 Agent 协作链</h3>
<p>复杂任务可由多个 Agent 协作完成。平台自动编排执行顺序，可视化展示数据流转。</p>`,
    },
    {
      title: '常见问题',
      html: `<h2>常见问题</h2>
<h3>Q: Agent 不响应怎么办？</h3>
<p>检查 Agent 状态是否为"在线"。如果显示"离线"，尝试在设置中重新连接。如果问题持续，联系管理员检查 Agent 实例健康状态。</p>
<h3>Q: 如何提高 Agent 回复质量？</h3>
<p>提供更具体的指令和上下文信息。例如，不要说"帮我写个文档"，而是说"帮我写一篇关于 API 安全的技术文档，包含认证、加密和限流三个章节"。</p>
<h3>Q: 数据是否安全？</h3>
<p>平台采用端到端加密（E2EE），所有通信通过 Matrix 协议加密传输。敏感数据在存储层使用 AES-256-GCM 加密。详见<strong>安全白皮书</strong>。</p>`,
    },
  ],
};

export const DOC_TEMPLATES: Record<string, DocTemplate> = {
  'API安全': API_SECURITY_DOC,
  '架构设计': ARCH_DESIGN_DOC,
  '用户指南': USER_GUIDE_DOC,
};

export const DEFAULT_DOC_KEY = 'API安全';

export function matchDocTemplate(text: string): string {
  for (const key of Object.keys(DOC_TEMPLATES)) {
    if (text.includes(key)) return key;
  }
  if (/架构|系统设计|技术架构/.test(text)) return '架构设计';
  if (/指南|手册|使用说明/.test(text)) return '用户指南';
  return DEFAULT_DOC_KEY;
}
