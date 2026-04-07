/**
 * AI Gateway 管理路由
 * 提供模型管理、审计追踪、成本分析、风险规则 4 大功能模块的 API
 */
const path = require('path');
const { registerDecisionRoutes } = require('./adminDecisionRoutes');

// ── Provider 模板（后端侧副本，与前端 ai-gateway-templates.js 保持一致） ──
const PROVIDER_TEMPLATES = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'tongyi', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'moonshot', name: 'Moonshot AI', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1' },
  { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'lingyiwanwu', name: '01.AI', baseUrl: 'https://api.lingyiwanwu.com/v1' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { id: 'xai', name: 'xAI', baseUrl: 'https://api.x.ai/v1' },
  { id: 'perplexity', name: 'Perplexity', baseUrl: 'https://api.perplexity.ai' },
  { id: 'volcengine', name: '火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'local', name: 'Local / Ollama', baseUrl: 'http://localhost:11434/v1' }
];

// ── 工具函数 ──
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function isoDay(d) { return d.toISOString().slice(0, 10); }

// ── 种子数据 ──

function seedModels(store) {
  const models = [
    { id: 'mdl-1', displayName: 'DeepSeek V3', description: '深度求索 V3 通用模型', providerType: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', providerModelName: 'deepseek-chat', apiKey: 'sk-demo-deepseek', inputPrice: 1.0, outputPrice: 2.0, currency: 'CNY', isActive: true, isSecure: false },
    { id: 'mdl-2', displayName: 'DeepSeek R1', description: '深度求索 R1 推理模型', providerType: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', providerModelName: 'deepseek-reasoner', apiKey: 'sk-demo-deepseek', inputPrice: 4.0, outputPrice: 16.0, currency: 'CNY', isActive: true, isSecure: false },
    { id: 'mdl-3', displayName: 'Claude Sonnet 4.6', description: 'Anthropic 安全模型（风险路由目标）', providerType: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', providerModelName: 'claude-sonnet-4-6', apiKey: 'sk-demo-anthropic', inputPrice: 3.0, outputPrice: 15.0, currency: 'USD', isActive: true, isSecure: true },
    { id: 'mdl-4', displayName: 'GPT-4o', description: 'OpenAI GPT-4o（已停用）', providerType: 'openai', baseUrl: 'https://api.openai.com/v1', providerModelName: 'gpt-4o', apiKey: 'sk-demo-openai', inputPrice: 2.5, outputPrice: 10.0, currency: 'USD', isActive: false, isSecure: false }
  ];
  for (const m of models) store.set(m.id, m);
}

function seedRiskRules(store) {
  const rules = [
    { ruleId: 'private_key', displayName: '私钥检测', description: '检测 PEM 格式的私钥内容', pattern: '-----BEGIN.*PRIVATE KEY-----', severity: 'high', action: 'block', category: 'security', isEnabled: true },
    { ruleId: 'api_key', displayName: 'API Key 检测', description: '检测常见的 API Key 格式（sk-、ak_、AKIA 前缀）', pattern: '(sk-|ak_|AKIA)[A-Za-z0-9]{16,}', severity: 'high', action: 'route_secure_model', category: 'security', isEnabled: true },
    { ruleId: 'id_card', displayName: '身份证号检测', description: '检测 18 位身份证号码', pattern: '\\d{17}[\\dXx]', severity: 'medium', action: 'route_secure_model', category: 'privacy', isEnabled: true },
    { ruleId: 'phone_number', displayName: '手机号检测', description: '检测中国大陆手机号', pattern: '1[3-9]\\d{9}', severity: 'low', action: 'allow', category: 'privacy', isEnabled: true },
    { ruleId: 'email_address', displayName: '邮箱地址', description: '检测邮箱地址格式', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', severity: 'low', action: 'allow', category: 'privacy', isEnabled: true },
    { ruleId: 'private_ip', displayName: '内网 IP', description: '检测私有 IP 地址（10.x, 172.16-31.x, 192.168.x.x）', pattern: '\\b(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.)\\d{1,3}\\b', severity: 'medium', action: 'route_secure_model', category: 'company', isEnabled: true },
    { ruleId: 'sql_injection', displayName: 'SQL 注入检测', description: '检测破坏性 SQL 语句', pattern: '(DROP|DELETE|TRUNCATE)\\s+TABLE', severity: 'high', action: 'block', category: 'security', isEnabled: true }
  ];
  for (const r of rules) store.set(r.ruleId, r);
}

function seedTraces(store) {
  const models = ['DeepSeek V3', 'DeepSeek R1', 'Claude Sonnet 4.6'];
  const userDepts = [
    { userId: 'alice', department: '研发部' },
    { userId: 'bob', department: '研发部' },
    { userId: 'charlie', department: '产品部' },
    { userId: 'diana', department: '产品部' },
    { userId: 'evan', department: '运营部' },
    { userId: 'frank', department: '市场部' },
    { userId: 'grace', department: '研发部' },
    { userId: 'henry', department: '运营部' }
  ];
  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'blocked', 'failed'];

  for (let i = 0; i < 15; i++) {
    const traceId = `tr-${uid()}-${i}`;
    const status = statuses[i % statuses.length];
    const model = models[i % models.length];
    const ud = userDepts[i % userDepts.length];
    const userId = ud.userId;
    const department = ud.department;
    const createdAt = daysAgo(i % 7);
    const promptTokens = 200 + Math.floor(Math.random() * 1800);
    const completionTokens = 100 + Math.floor(Math.random() * 2000);
    const totalTokens = promptTokens + completionTokens;
    const latencyMs = 300 + Math.floor(Math.random() * 4700);
    const inputCost = (promptTokens / 1e6) * (model.includes('R1') ? 4 : 1);
    const outputCost = (completionTokens / 1e6) * (model.includes('R1') ? 16 : 2);

    const flowNodes = [
      { kind: 'user_message', title: '用户输入', summary: '接收用户请求', status: 'completed', model: null, createdAt: createdAt.toISOString(), inputPayload: JSON.stringify({ message: `测试请求 #${i + 1}` }), outputPayload: null },
      { kind: 'risk_check', title: '风险检测', summary: status === 'blocked' ? '检测到高危内容' : '通过安全检查', status: status === 'blocked' ? 'blocked' : 'completed', model: null, createdAt: new Date(createdAt.getTime() + 50).toISOString(), inputPayload: null, outputPayload: JSON.stringify({ passed: status !== 'blocked' }) }
    ];

    const riskHits = [];

    if (status === 'blocked') {
      riskHits.push({ severity: 'high', action: 'block', ruleName: '私钥检测', matchSummary: '匹配: -----BEGIN RSA PRIVATE KEY-----' });
    } else {
      flowNodes.push(
        { kind: 'llm_call', title: 'LLM 调用', summary: `调用 ${model}`, status: status === 'failed' ? 'error' : 'completed', model, createdAt: new Date(createdAt.getTime() + 100).toISOString(), inputPayload: JSON.stringify({ model, tokens: promptTokens }), outputPayload: JSON.stringify({ tokens: completionTokens, latency: latencyMs }) },
        { kind: 'assistant_response', title: '返回响应', summary: status === 'failed' ? '模型超时' : '成功返回', status: status === 'failed' ? 'error' : 'completed', model: null, createdAt: new Date(createdAt.getTime() + latencyMs).toISOString(), inputPayload: null, outputPayload: null }
      );
    }

    if (i === 5) {
      riskHits.push({ severity: 'medium', action: 'route_secure_model', ruleName: '身份证号检测', matchSummary: '匹配: 110101199003071234' });
    }

    store.set(traceId, {
      traceId,
      status,
      requestedModel: 'auto',
      actualModel: status === 'blocked' ? null : model,
      userId,
      department,
      promptTokens,
      completionTokens,
      totalTokens,
      inputCost,
      outputCost,
      estimatedCost: inputCost + outputCost,
      latencyMs: status === 'blocked' ? null : latencyMs,
      createdAt: createdAt.toISOString(),
      completedAt: status === 'blocked' ? null : new Date(createdAt.getTime() + latencyMs).toISOString(),
      riskHits,
      flowNodes
    });
  }
}

// ── 路由注册 ──

function registerAdminCompatAIGatewayRoutes(router, context, deps) {
  const { requireSession } = deps;

  // 内存 Store
  const modelStore = new Map();
  const riskRuleStore = new Map();
  const traceStore = new Map();

  const failoverChainStore = new Map();

  // 种子数据
  seedModels(modelStore);
  seedRiskRules(riskRuleStore);
  seedTraces(traceStore);

  // 为已有模型补充 healthStatus / lastHealthCheck
  for (const m of modelStore.values()) {
    m.healthStatus = 'unknown';
    m.lastHealthCheck = null;
  }

  // 种子数据：故障转移链
  failoverChainStore.set('fc-1', {
    id: 'fc-1',
    name: '通用故障转移链',
    primaryModelId: 'mdl-1',
    fallbackModelIds: ['mdl-2', 'mdl-3'],
    enabled: true
  });

  const budgetStore = new Map();

  // 种子数据：预算
  budgetStore.set('bdg-rd', { id: 'bdg-rd', scope: 'department', name: '研发部', monthlyBudget: 50, thresholdWarn: 0.8, thresholdHard: 1.0, mode: 'soft' });
  budgetStore.set('bdg-alice', { id: 'bdg-alice', scope: 'user', name: 'alice', monthlyBudget: 10, thresholdWarn: 0.8, thresholdHard: 1.0, mode: 'hard' });

  // 规则快照（内存，最近 50 个）
  const ruleSnapshots = [];
  function captureRuleSnapshot(action, ruleId) {
    const snap = {
      id: uid(),
      timestamp: new Date().toISOString(),
      action,
      ruleId,
      snapshot: Array.from(riskRuleStore.values()).map(r => ({ ...r }))
    };
    ruleSnapshots.unshift(snap);
    if (ruleSnapshots.length > 50) ruleSnapshots.length = 50;
  }

  // 暴露 stores 供 analytics 等路由访问
  context.gwStores = { modelStore, riskRuleStore, traceStore, budgetStore, failoverChainStore };

  // ════════════════════════════════════════
  // 模型管理
  // ════════════════════════════════════════

  router.get('/api/admin/ai-gateway/providers', requireSession, (req, res) => {
    res.json({ providers: PROVIDER_TEMPLATES });
  });

  router.get('/api/admin/ai-gateway/models', requireSession, (req, res) => {
    const rows = Array.from(modelStore.values());
    res.json({ rows });
  });

  router.get('/api/admin/ai-gateway/models/:id', requireSession, (req, res) => {
    const model = modelStore.get(req.params.id);
    if (!model) return res.status(404).json({ error: 'model not found' });
    res.json(model);
  });

  router.post('/api/admin/ai-gateway/models', requireSession, (req, res) => {
    const b = req.body || {};
    if (!b.displayName) return res.status(400).json({ error: 'displayName is required' });

    const id = b.id || `mdl-${uid()}`;
    const model = {
      id,
      displayName: String(b.displayName),
      description: String(b.description || ''),
      providerType: String(b.providerType || 'openai'),
      baseUrl: String(b.baseUrl || ''),
      providerModelName: String(b.providerModelName || ''),
      apiKey: String(b.apiKey || ''),
      inputPrice: Number(b.inputPrice) || 0,
      outputPrice: Number(b.outputPrice) || 0,
      currency: b.currency === 'USD' ? 'USD' : 'CNY',
      isActive: modelStore.has(id) ? modelStore.get(id).isActive : true,
      isSecure: !!b.isSecure,
      healthStatus: modelStore.has(id) ? modelStore.get(id).healthStatus : 'unknown',
      lastHealthCheck: modelStore.has(id) ? modelStore.get(id).lastHealthCheck : null
    };
    modelStore.set(id, model);
    res.json({ success: true, model });
  });

  router.post('/api/admin/ai-gateway/models/:id/toggle', requireSession, (req, res) => {
    const model = modelStore.get(req.params.id);
    if (!model) return res.status(404).json({ error: 'model not found' });
    model.isActive = !model.isActive;
    res.json({ success: true, model });
  });

  router.post('/api/admin/ai-gateway/models/:id/delete', requireSession, (req, res) => {
    if (!modelStore.has(req.params.id)) return res.status(404).json({ error: 'model not found' });
    modelStore.delete(req.params.id);
    res.json({ success: true });
  });

  // ── 模型健康检查 ──

  router.post('/api/admin/ai-gateway/models/:id/health-check', requireSession, (req, res) => {
    const model = modelStore.get(req.params.id);
    if (!model) return res.status(404).json({ error: 'model not found' });
    if (model.isActive) {
      model.healthStatus = Math.random() < 0.9 ? 'healthy' : 'degraded';
    } else {
      model.healthStatus = 'down';
    }
    model.lastHealthCheck = new Date().toISOString();
    res.json({ success: true, healthStatus: model.healthStatus, lastHealthCheck: model.lastHealthCheck });
  });

  router.get('/api/admin/ai-gateway/models/:id/health', requireSession, (req, res) => {
    const model = modelStore.get(req.params.id);
    if (!model) return res.status(404).json({ error: 'model not found' });
    res.json({ healthStatus: model.healthStatus || 'unknown', lastHealthCheck: model.lastHealthCheck || null });
  });

  // ── 故障转移链 ──

  router.get('/api/admin/ai-gateway/failover-chains', requireSession, (req, res) => {
    res.json({ rows: Array.from(failoverChainStore.values()) });
  });

  router.post('/api/admin/ai-gateway/failover-chains', requireSession, (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name is required' });
    if (!b.primaryModelId) return res.status(400).json({ error: 'primaryModelId is required' });
    const id = b.id || `fc-${uid()}`;
    const chain = {
      id,
      name: String(b.name),
      primaryModelId: String(b.primaryModelId),
      fallbackModelIds: Array.isArray(b.fallbackModelIds) ? b.fallbackModelIds.map(String) : [],
      enabled: b.enabled !== false
    };
    failoverChainStore.set(id, chain);
    res.json({ success: true, chain });
  });

  router.delete('/api/admin/ai-gateway/failover-chains/:id', requireSession, (req, res) => {
    if (!failoverChainStore.has(req.params.id)) return res.status(404).json({ error: 'chain not found' });
    failoverChainStore.delete(req.params.id);
    res.json({ success: true });
  });

  // ── 模型自动发现（模拟） ──

  const DISCOVER_CATALOG = {
    deepseek: [
      { name: 'deepseek-chat', displayName: 'DeepSeek Chat (V3)', inputPrice: 1.0, outputPrice: 2.0 },
      { name: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner (R1)', inputPrice: 4.0, outputPrice: 16.0 }
    ],
    openai: [
      { name: 'gpt-4o', displayName: 'GPT-4o', inputPrice: 2.5, outputPrice: 10.0 },
      { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.6 },
      { name: 'o3-mini', displayName: 'o3-mini', inputPrice: 1.1, outputPrice: 4.4 }
    ],
    anthropic: [
      { name: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', inputPrice: 3.0, outputPrice: 15.0 },
      { name: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', inputPrice: 0.8, outputPrice: 4.0 }
    ],
    zhipu: [
      { name: 'glm-4-plus', displayName: 'GLM-4 Plus', inputPrice: 50.0, outputPrice: 50.0 },
      { name: 'glm-4-flash', displayName: 'GLM-4 Flash', inputPrice: 0.1, outputPrice: 0.1 }
    ],
    moonshot: [
      { name: 'moonshot-v1-8k', displayName: 'Moonshot v1 8K', inputPrice: 12.0, outputPrice: 12.0 },
      { name: 'moonshot-v1-32k', displayName: 'Moonshot v1 32K', inputPrice: 24.0, outputPrice: 24.0 }
    ],
    tongyi: [
      { name: 'qwen-turbo', displayName: 'Qwen Turbo', inputPrice: 0.3, outputPrice: 0.6 },
      { name: 'qwen-plus', displayName: 'Qwen Plus', inputPrice: 0.8, outputPrice: 2.0 }
    ]
  };

  router.post('/api/admin/ai-gateway/models/discover', requireSession, (req, res) => {
    const b = req.body || {};
    if (!b.providerType) return res.status(400).json({ error: 'providerType is required' });
    const catalog = DISCOVER_CATALOG[b.providerType];
    if (!catalog) return res.json({ models: [], message: '该厂商暂无模拟数据' });
    const tpl = PROVIDER_TEMPLATES.find(p => p.id === b.providerType);
    const models = catalog.map(c => ({
      providerModelName: c.name,
      displayName: c.displayName,
      inputPrice: c.inputPrice,
      outputPrice: c.outputPrice,
      providerType: b.providerType,
      baseUrl: tpl ? tpl.baseUrl : ''
    }));
    res.json({ models });
  });

  // ════════════════════════════════════════
  // 审计追踪
  // ════════════════════════════════════════

  router.get('/api/admin/ai-gateway/stats', requireSession, (req, res) => {
    let completed = 0, blocked = 0, failed = 0, totalTokens = 0;
    for (const t of traceStore.values()) {
      if (t.status === 'completed') completed++;
      else if (t.status === 'blocked') blocked++;
      else if (t.status === 'failed') failed++;
      totalTokens += t.totalTokens || 0;
    }
    res.json({ completed, blocked, failed, totalTokens });
  });

  router.get('/api/admin/ai-gateway/traces', requireSession, (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim();
    const model = String(req.query.model || '').trim();

    let rows = Array.from(traceStore.values());

    if (status) rows = rows.filter(t => t.status === status);
    if (model) rows = rows.filter(t => (t.actualModel || '').includes(model) || (t.requestedModel || '').includes(model));
    if (search) rows = rows.filter(t => t.traceId.toLowerCase().includes(search) || (t.userId || '').toLowerCase().includes(search));

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);

    res.json({ items, total, page, limit });
  });

  router.get('/api/admin/ai-gateway/traces/:traceId', requireSession, (req, res) => {
    const trace = traceStore.get(req.params.traceId);
    if (!trace) return res.status(404).json({ error: 'trace not found' });
    res.json(trace);
  });

  // ════════════════════════════════════════
  // 成本分析
  // ════════════════════════════════════════

  router.get('/api/admin/ai-gateway/costs', requireSession, (req, res) => {
    let totalPromptTokens = 0, totalCompletionTokens = 0, totalEstimatedCost = 0;
    const userMap = new Map();
    const modelMap = new Map();
    const deptMap = new Map();
    const dayMap = new Map();

    for (const t of traceStore.values()) {
      totalPromptTokens += t.promptTokens || 0;
      totalCompletionTokens += t.completionTokens || 0;
      totalEstimatedCost += t.estimatedCost || 0;

      // 按用户聚合
      const uKey = t.userId || 'anonymous';
      const u = userMap.get(uKey) || { userId: uKey, department: t.department || '-', count: 0, totalTokens: 0, estimatedCost: 0 };
      u.count++;
      u.totalTokens += t.totalTokens || 0;
      u.estimatedCost += t.estimatedCost || 0;
      userMap.set(uKey, u);

      // 按部门聚合
      const dKey = t.department || '未分配';
      const dp = deptMap.get(dKey) || { department: dKey, userCount: new Set(), count: 0, totalTokens: 0, estimatedCost: 0 };
      dp.userCount.add(uKey);
      dp.count++;
      dp.totalTokens += t.totalTokens || 0;
      dp.estimatedCost += t.estimatedCost || 0;
      deptMap.set(dKey, dp);

      // 按模型聚合
      const mKey = t.actualModel || t.requestedModel || 'unknown';
      const m = modelMap.get(mKey) || { model: mKey, count: 0, totalTokens: 0, estimatedCost: 0 };
      m.count++;
      m.totalTokens += t.totalTokens || 0;
      m.estimatedCost += t.estimatedCost || 0;
      modelMap.set(mKey, m);

      // 按日聚合
      const day = (t.createdAt || '').slice(0, 10);
      if (day) {
        const d = dayMap.get(day) || { day, count: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
        d.count++;
        d.promptTokens += t.promptTokens || 0;
        d.completionTokens += t.completionTokens || 0;
        d.totalTokens += t.totalTokens || 0;
        d.estimatedCost += t.estimatedCost || 0;
        dayMap.set(day, d);
      }
    }

    const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
    const deptSummary = Array.from(deptMap.values()).map(d => ({ department: d.department, users: d.userCount.size, count: d.count, totalTokens: d.totalTokens, estimatedCost: d.estimatedCost }));

    res.json({
      totalPromptTokens,
      totalCompletionTokens,
      totalEstimatedCost,
      userSummary: Array.from(userMap.values()),
      deptSummary,
      modelSummary: Array.from(modelMap.values()),
      dailyTrend
    });
  });

  // ════════════════════════════════════════
  // 预算管理
  // ════════════════════════════════════════

  router.get('/api/admin/ai-gateway/budgets', requireSession, (req, res) => {
    res.json({ rows: Array.from(budgetStore.values()) });
  });

  router.post('/api/admin/ai-gateway/budgets', requireSession, (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name is required' });
    if (!['department', 'user'].includes(b.scope)) return res.status(400).json({ error: 'scope must be department or user' });
    if (!b.monthlyBudget || Number(b.monthlyBudget) <= 0) return res.status(400).json({ error: 'monthlyBudget must be positive' });

    const id = b.id || `bdg-${uid()}`;
    const budget = {
      id,
      scope: b.scope,
      name: String(b.name),
      monthlyBudget: Number(b.monthlyBudget),
      thresholdWarn: Number(b.thresholdWarn) || 0.8,
      thresholdHard: Number(b.thresholdHard) || 1.0,
      mode: b.mode === 'hard' ? 'hard' : 'soft'
    };
    budgetStore.set(id, budget);
    res.json({ success: true, budget });
  });

  router.delete('/api/admin/ai-gateway/budgets/:id', requireSession, (req, res) => {
    if (!budgetStore.has(req.params.id)) return res.status(404).json({ error: 'budget not found' });
    budgetStore.delete(req.params.id);
    res.json({ success: true });
  });

  router.get('/api/admin/ai-gateway/budget-status', requireSession, (req, res) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 聚合当月 trace 的 estimatedCost
    const deptCost = new Map();
    const userCost = new Map();
    for (const t of traceStore.values()) {
      if (!t.createdAt || !t.createdAt.startsWith(yearMonth)) continue;
      const cost = t.estimatedCost || 0;
      if (t.department) deptCost.set(t.department, (deptCost.get(t.department) || 0) + cost);
      if (t.userId) userCost.set(t.userId, (userCost.get(t.userId) || 0) + cost);
    }

    const items = Array.from(budgetStore.values()).map(b => {
      const used = b.scope === 'department'
        ? (deptCost.get(b.name) || 0)
        : (userCost.get(b.name) || 0);
      const pct = b.monthlyBudget > 0 ? used / b.monthlyBudget : 0;
      return { ...b, used, pct };
    });

    res.json({ yearMonth, items });
  });

  // ════════════════════════════════════════
  // 风险规则
  // ════════════════════════════════════════

  router.get('/api/admin/ai-gateway/risk-rules', requireSession, (req, res) => {
    const rows = Array.from(riskRuleStore.values());
    res.json({ rows });
  });

  router.post('/api/admin/ai-gateway/risk-rules', requireSession, (req, res) => {
    const b = req.body || {};
    if (!b.ruleId) return res.status(400).json({ error: 'ruleId is required' });
    if (!b.pattern) return res.status(400).json({ error: 'pattern is required' });

    // 验证正则合法性
    try { new RegExp(b.pattern); } catch (e) {
      return res.status(400).json({ error: `正则表达式无效: ${e.message}` });
    }

    const existing = riskRuleStore.get(b.ruleId);
    const rule = {
      ruleId: String(b.ruleId),
      displayName: String(b.displayName || b.ruleId),
      description: String(b.description || ''),
      pattern: String(b.pattern),
      severity: ['low', 'medium', 'high'].includes(b.severity) ? b.severity : 'medium',
      action: ['allow', 'route_secure_model', 'block'].includes(b.action) ? b.action : 'route_secure_model',
      category: b.category || (existing && existing.category) || 'custom',
      isEnabled: existing ? existing.isEnabled : true
    };
    const isCreate = !riskRuleStore.has(b.ruleId);
    riskRuleStore.set(rule.ruleId, rule);
    captureRuleSnapshot(isCreate ? 'create' : 'update', rule.ruleId);
    res.json({ success: true, rule });
  });

  router.post('/api/admin/ai-gateway/risk-rules/:ruleId/toggle', requireSession, (req, res) => {
    const rule = riskRuleStore.get(req.params.ruleId);
    if (!rule) return res.status(404).json({ error: 'rule not found' });
    rule.isEnabled = !rule.isEnabled;
    captureRuleSnapshot('toggle', req.params.ruleId);
    res.json({ success: true, rule });
  });

  router.post('/api/admin/ai-gateway/risk-rules/:ruleId/delete', requireSession, (req, res) => {
    if (!riskRuleStore.has(req.params.ruleId)) return res.status(404).json({ error: 'rule not found' });
    captureRuleSnapshot('delete', req.params.ruleId);
    riskRuleStore.delete(req.params.ruleId);
    res.json({ success: true });
  });

  router.post('/api/admin/ai-gateway/risk-rules/test', requireSession, (req, res) => {
    const text = String((req.body || {}).text || '');
    if (!text) return res.status(400).json({ error: 'text is required' });

    const ACTION_PRIORITY = { allow: 1, route_secure_model: 2, block: 3 };
    const SEVERITY_PRIORITY = { low: 1, medium: 2, high: 3 };

    const hits = [];
    let highestAction = 'allow';
    let highestSeverity = 'low';

    for (const rule of riskRuleStore.values()) {
      if (!rule.isEnabled) continue;
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const match = regex.exec(text);
        if (!match) continue;
        const matchText = match[0].length > 40 ? match[0].slice(0, 40) + '...' : match[0];
        hits.push({ severity: rule.severity, action: rule.action, ruleName: rule.displayName, matchSummary: `匹配: ${matchText}` });
        if ((ACTION_PRIORITY[rule.action] || 0) > (ACTION_PRIORITY[highestAction] || 0)) highestAction = rule.action;
        if ((SEVERITY_PRIORITY[rule.severity] || 0) > (SEVERITY_PRIORITY[highestSeverity] || 0)) highestSeverity = rule.severity;
      } catch { /* 跳过无效正则 */ }
    }

    res.json({ hits, highestAction, highestSeverity });
  });

  // ── 快照管理 ──

  router.get('/api/admin/ai-gateway/risk-rules/snapshots', requireSession, (req, res) => {
    res.json({ snapshots: ruleSnapshots.map(s => ({ id: s.id, timestamp: s.timestamp, action: s.action, ruleId: s.ruleId, ruleCount: s.snapshot.length })) });
  });

  router.post('/api/admin/ai-gateway/risk-rules/snapshots/:id/restore', requireSession, (req, res) => {
    const snap = ruleSnapshots.find(s => s.id === req.params.id);
    if (!snap) return res.status(404).json({ error: 'snapshot not found' });
    riskRuleStore.clear();
    for (const r of snap.snapshot) riskRuleStore.set(r.ruleId, { ...r });
    captureRuleSnapshot('restore', snap.id);
    res.json({ success: true, restoredCount: snap.snapshot.length });
  });

  // ── 批量操作 ──

  router.post('/api/admin/ai-gateway/risk-rules/batch', requireSession, (req, res) => {
    const { action, ruleIds } = req.body || {};
    if (!action || !Array.isArray(ruleIds) || !ruleIds.length) {
      return res.status(400).json({ error: 'action and ruleIds[] are required' });
    }
    let affected = 0;
    if (action === 'enable' || action === 'disable') {
      for (const id of ruleIds) {
        const r = riskRuleStore.get(id);
        if (r) { r.isEnabled = action === 'enable'; affected++; }
      }
    } else if (action === 'delete') {
      for (const id of ruleIds) {
        if (riskRuleStore.delete(id)) affected++;
      }
    } else {
      return res.status(400).json({ error: 'action must be enable, disable, or delete' });
    }
    captureRuleSnapshot(`batch_${action}`, ruleIds.join(','));
    res.json({ success: true, affected });
  });

  // ── 导入导出 ──

  router.get('/api/admin/ai-gateway/risk-rules/export', requireSession, (req, res) => {
    res.json({ rules: Array.from(riskRuleStore.values()) });
  });

  router.post('/api/admin/ai-gateway/risk-rules/import', requireSession, (req, res) => {
    const { rules, mode } = req.body || {};
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules[] is required' });
    if (!['replace', 'merge'].includes(mode)) return res.status(400).json({ error: 'mode must be replace or merge' });
    captureRuleSnapshot('pre_import', mode);
    if (mode === 'replace') riskRuleStore.clear();
    let imported = 0;
    for (const r of rules) {
      if (!r.ruleId || !r.pattern) continue;
      try { new RegExp(r.pattern); } catch { continue; }
      riskRuleStore.set(r.ruleId, {
        ruleId: String(r.ruleId),
        displayName: String(r.displayName || r.ruleId),
        description: String(r.description || ''),
        pattern: String(r.pattern),
        severity: ['low', 'medium', 'high'].includes(r.severity) ? r.severity : 'medium',
        action: ['allow', 'route_secure_model', 'block'].includes(r.action) ? r.action : 'route_secure_model',
        category: r.category || 'custom',
        isEnabled: r.isEnabled !== false
      });
      imported++;
    }
    captureRuleSnapshot('import', mode);
    res.json({ success: true, imported, total: riskRuleStore.size });
  });

  // ════════════════════════════════════════
  // Decision 路由（已有实现）
  // ════════════════════════════════════════

  registerDecisionRoutes(router, context, deps);
}

module.exports = { registerAdminCompatAIGatewayRoutes };
