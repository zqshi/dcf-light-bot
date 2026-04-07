async function api(path) {
  if (window.adminApi) return window.adminApi(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

const viewState = {
  scope: 'agent',
  module: 'all',
  page: 'all',
  operation: 'all',
  status: 'all',
  timeRange: '1h',
  trace: '',
  keyword: '',
  expandedRowKeys: new Set(),
  currentView: 'list'
};

function renderFatalError(message, detail = '') {
  const rows = document.getElementById('rows');
  if (!rows) return;
  const detailText = [String(message || ''), String(detail || '')].filter(Boolean).join('\n');
  rows.innerHTML = `
    <tr>
      <td colspan="5" class="empty" style="text-align:left;">
        <strong>页面运行异常</strong>
        <pre class="mono" style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(detailText || 'unknown error')}</pre>
      </td>
    </tr>
  `;
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEmpty(message) {
  document.getElementById('rows').innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(message)}</td></tr>`;
}

function firstNonEmpty(values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function logRowKey(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const taskId = firstNonEmpty([payload.taskId, payload.task_id]);
  return [
    String(event && event.id || ''),
    String(event && event.at || ''),
    String(event && event.type || ''),
    taskId
  ].join('|');
}

function moduleKeyFromType(type) {
  const t = String(type || '');
  if (t.startsWith('auth.')) return 'auth';
  if (t.startsWith('instance.') || t.startsWith('admin.instance.')) return 'instance';
  if (t.startsWith('admin.asset.') || t.startsWith('skill.')) return 'asset';
  if (t.startsWith('matrix.')) return 'matrix';
  if (t.startsWith('admin.tools.mcp.')) return 'tools';
  if (t.startsWith('admin.')) return 'admin';
  if (t.startsWith('employee.')) return 'employee';
  if (t.startsWith('runtime.')) return 'runtime';
  if (t.startsWith('audit.')) return 'audit';
  if (t.startsWith('bootstrap.')) return 'bootstrap';
  return 'other';
}

function eventModuleKey(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  return String(payload.audit_module || payload.module || moduleKeyFromType(event && event.type) || 'other');
}

function moduleLabelByKey(key) {
  const map = {
    auth: '账号权限',
    instance: '实例管理',
    asset: '共享资产',
    matrix: 'Matrix 渠道',
    tools: '工具管理',
    admin: '后台管理',
    employee: '员工管理',
    runtime: '运行时',
    bootstrap: '引导流程',
    audit: '审计治理',
    other: '其他',
    system: '系统'
  };
  const normalized = String(key || 'other');
  return map[normalized] || normalized;
}

function eventPageKey(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  return String(payload.audit_page || payload.page || payload.pagePath || payload.request_path || '-');
}

function eventOperationKey(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  return String(payload.audit_action || payload.action || event && event.type || '-');
}

function isAdminLogType(type) {
  const t = String(type || '');
  return t.startsWith('auth.') || t.startsWith('admin.') || t.startsWith('audit.');
}

function isServiceLogType(type) {
  const t = String(type || '');
  return t.startsWith('matrix.')
    || t.startsWith('instance.')
    || t.startsWith('bootstrap.')
    || t.startsWith('integration.')
    || t.startsWith('runtime.')
    || t.startsWith('employee.');
}

function isAgentLogType(type) {
  const t = String(type || '');
  return t.startsWith('task.')
    || t.startsWith('skill.')
    || t.startsWith('runtime.task.')
    || t.startsWith('integration.compensation.');
}

function resolveLogScope() {
  const body = document.body;
  const scope = body ? String(body.getAttribute('data-log-scope') || '').trim().toLowerCase() : '';
  if (scope === 'admin' || scope === 'agent' || scope === 'service') return scope;
  const pathname = String(window.location.pathname || '');
  if (pathname.endsWith('/logs-admin.html')) return 'admin';
  if (pathname.endsWith('/logs-service.html')) return 'service';
  if (pathname.endsWith('/logs-agent.html')) return 'agent';
  return 'service';
}

function normalizeFilter(input) {
  const value = String(input || 'all').trim();
  return value || 'all';
}

function storageKey(name, scope) {
  return `dcf.admin.logs.${name}.${String(scope || 'agent')}`;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function resolveModuleFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('module')) return normalizeFilter(params.get('module'));
  if (scope === 'agent' && params.has('type')) return normalizeFilter(params.get('type'));
  return normalizeFilter(readStorage(storageKey('module', scope)));
}

function resolvePageFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('page')) return normalizeFilter(params.get('page'));
  return normalizeFilter(readStorage(storageKey('page', scope)));
}

function resolveOperationFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('operation')) return normalizeFilter(params.get('operation'));
  return normalizeFilter(readStorage(storageKey('operation', scope)));
}

function resolveStatusFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('status')) return normalizeFilter(params.get('status'));
  return normalizeFilter(readStorage(storageKey('status', scope)));
}

function resolveTimeRangeFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('timeRange')) return normalizeFilter(params.get('timeRange'));
  return normalizeFilter(readStorage(storageKey('timeRange', scope)) || '1h');
}

function resolveTraceFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('trace')) return String(params.get('trace') || '').trim();
  return String(readStorage(storageKey('trace', scope)) || '').trim();
}

function resolveKeywordFilter(scope = 'agent') {
  const params = new URLSearchParams(window.location.search || '');
  if (params.has('keyword')) return String(params.get('keyword') || '').trim();
  return String(readStorage(storageKey('keyword', scope)) || '').trim();
}

function filterLogsByScope(rows = [], scope = 'agent') {
  if (scope === 'admin') return rows.filter((event) => isAdminLogType(event && event.type));
  if (scope === 'service') {
    return rows.filter((event) => {
      const type = event && event.type;
      return !isAdminLogType(type) && isServiceLogType(type);
    });
  }
  return rows.filter((event) => isAgentLogType(event && event.type));
}

function filterLogsByModule(rows = [], module = 'all') {
  if (module === 'all') return rows;
  return rows.filter((event) => eventModuleKey(event) === module);
}

function filterLogsByPage(rows = [], page = 'all') {
  if (page === 'all') return rows;
  return rows.filter((event) => eventPageKey(event) === page);
}

function filterLogsByOperation(rows = [], operation = 'all') {
  if (operation === 'all') return rows;
  return rows.filter((event) => eventOperationKey(event) === operation);
}

function classifyServiceStatus(event) {
  const type = String(event && event.type || '').toLowerCase();
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const phase = String(payload.phase || payload.status || '').toLowerCase();
  if (type.includes('failed') || type.includes('error') || phase === 'failed' || phase === 'error' || phase === 'forbidden') return 'failed';
  if (type.includes('ignored') || phase === 'ignored' || phase === 'delegated') return 'ignored';
  if (type.includes('succeeded') || type.includes('success') || type.includes('ready') || phase === 'succeeded' || phase === 'ready') return 'succeeded';
  return 'unknown';
}

function resolveTimeRangeMs(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === '15m') return 15 * 60 * 1000;
  if (key === '1h') return 60 * 60 * 1000;
  if (key === '24h') return 24 * 60 * 60 * 1000;
  if (key === '7d') return 7 * 24 * 60 * 60 * 1000;
  return 0;
}

function filterLogsByTimeRange(rows = [], timeRange = '1h') {
  const windowMs = resolveTimeRangeMs(timeRange);
  if (!windowMs) return rows;
  const now = Date.now();
  return rows.filter((event) => {
    const at = Date.parse(String(event && event.at || ''));
    if (!Number.isFinite(at)) return false;
    return (now - at) <= windowMs;
  });
}

function filterLogsByStatus(rows = [], status = 'all') {
  if (status === 'all') return rows;
  return rows.filter((event) => classifyServiceStatus(event) === status);
}

function filterLogsByTrace(rows = [], trace = '') {
  const q = String(trace || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((event) => {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
    const tokens = [
      event && event.id,
      payload.traceId,
      payload.requestId,
      payload.eventId,
      payload.roomId,
      payload.instanceId,
      payload.employeeId,
      payload.taskId
    ].map((x) => String(x || '').toLowerCase()).filter(Boolean);
    return tokens.some((x) => x.includes(q));
  });
}

function filterLogsByKeyword(rows = [], keyword = '') {
  const q = String(keyword || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((event) => {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
    const haystack = [
      String(event && event.type || ''),
      String(payload.message || ''),
      String(payload.reason || ''),
      String(payload.command || ''),
      String(payload.sender || ''),
      String(payload.body || '')
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function summarizeAction(event) {
  const type = String(event.type || '');
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const actor = firstNonEmpty([payload.actor_name, payload.updatedBy, payload.actor, payload.username, payload.creator]);
  const taskId = firstNonEmpty([payload.taskId, payload.task_id]);
  const employeeId = firstNonEmpty([payload.employeeId, payload.employee_id]);
  const role = firstNonEmpty([payload.role]);
  const serviceId = firstNonEmpty([payload.serviceId]);

  const map = {
    'auth.login.succeeded': `${firstNonEmpty([payload.username, '用户'])} 登录成功`,
    'auth.login.failed': `${firstNonEmpty([payload.username, '用户'])} 登录失败`,
    'auth.logout': `${firstNonEmpty([payload.username, '用户'])} 退出登录`,
    'auth.user.created': `创建账号 ${firstNonEmpty([payload.username, payload.userId, '-'])}${role ? `（角色：${role}）` : ''}`,
    'auth.user.updated': `更新账号 ${firstNonEmpty([payload.username, payload.userId, '-'])}${role ? `（角色：${role}）` : ''}`,
    'auth.user.password.reset': `重置账号密码 ${firstNonEmpty([payload.username, payload.userId, '-'])}`,
    'auth.role.created': `创建角色 ${firstNonEmpty([payload.role, '-'])}`,
    'auth.role.updated': `更新角色 ${firstNonEmpty([payload.role, '-'])} 权限`,
    'auth.role.deleted': `删除角色 ${firstNonEmpty([payload.role, '-'])}`,
    'auth.user.deleted': `删除账号 ${firstNonEmpty([payload.username, payload.userId, '-'])}`,
    'auth.user.status.changed': `账号 ${firstNonEmpty([payload.username, '-'])} 状态变更为 ${firstNonEmpty([payload.status, '-'])}`,
    'instance.provisioning': `实例创建中 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'instance.provisioned': `实例创建成功 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'instance.provision.failed': `实例创建失败 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'admin.instance.started': `启动实例 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'admin.instance.stopped': `停止实例 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'admin.instance.rebuilt': `重建实例 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'admin.instance.deleted': `删除实例 ${firstNonEmpty([payload.instanceId, '-'])}`,
    'employee.created': `创建数字员工 ${firstNonEmpty([payload.name, employeeId, '-'])}`,
    'employee.profile.updated': `更新员工资料 ${firstNonEmpty([employeeId, '-'])}`,
    'employee.policy.updated': `更新岗位合同 ${firstNonEmpty([employeeId, '-'])}`,
    'employee.approval_policy.updated': `更新审批策略 ${firstNonEmpty([employeeId, '-'])}`,
    'task.created': `创建任务${payload.goal ? `：${String(payload.goal).slice(0, 28)}` : ''}`,
    'task.validating': '任务进入校验',
    'task.approval.required': `任务等待审批（需 ${Number(payload.requiredApprovals || 0)} 人）`,
    'task.approved': '任务审批通过',
    'task.running': '任务开始执行',
    'task.corrected': '任务执行纠偏',
    'task.succeeded': '任务执行成功',
    'task.failed': `任务执行失败${payload.severity ? `（${payload.severity}）` : ''}`,
    'task.rollback.triggered': '触发任务回滚',
    'task.rolled_back': '任务已回滚',
    'task.aborted': '任务已中止',
    'runtime.task.synced': `同步 Runtime 任务${payload.runtimeTaskId ? `（${payload.runtimeTaskId}）` : ''}`,
    'runtime.raw.event': `捕获 Runtime 事件${payload.runtimeType ? `（${payload.runtimeType}）` : ''}`,
    'skill.created': `创建技能 ${firstNonEmpty([payload.name, payload.skillId, '-'])}`,
    'skill.imported': `导入技能 ${firstNonEmpty([payload.skillId, '-'])}`,
    'skill.proposed': `技能提案 ${firstNonEmpty([payload.skillName, payload.skillId, '-'])}`,
    'skill.status.changed': `更新技能状态 ${firstNonEmpty([payload.skillId, '-'])}`,
    'skill.auto.created': `自动沉淀技能 ${firstNonEmpty([payload.skillName, payload.skillId, '-'])}`,
    'skill.auto.linked': `自动关联技能 ${firstNonEmpty([payload.skillId, '-'])}`,
    'oss.research.queued': `发起开源检索${payload.query ? `：${String(payload.query).slice(0, 24)}` : ''}`,
    'oss.research.done': '开源检索完成',
    'oss.research.failed': '开源检索失败',
    'integration.compensation.queued': '补偿任务入队',
    'integration.compensation.running': '补偿任务执行中',
    'integration.compensation.succeeded': '补偿任务成功',
    'integration.compensation.retry_scheduled': '补偿任务待重试',
    'integration.compensation.retry_requested': '触发补偿重试',
    'integration.compensation.dead_lettered': '补偿任务进入死信',
    'integration.compensation.deferred': '补偿任务延后执行',
    'admin.tools.mcp.created': `新增 MCP 服务 ${firstNonEmpty([serviceId, '-'])}`,
    'admin.tools.mcp.updated': `更新 MCP 服务 ${firstNonEmpty([serviceId, '-'])}`,
    'admin.tools.mcp.deleted': `删除 MCP 服务 ${firstNonEmpty([serviceId, '-'])}`,
    'admin.tools.mcp.health_checked': `MCP 服务探活 ${firstNonEmpty([serviceId, '-'])}`,
    'admin.asset.reported': `提交资产上报 ${firstNonEmpty([payload.reportId, '-'])}`,
    'admin.asset.approved': `审批通过资产 ${firstNonEmpty([payload.id, '-'])}`,
    'admin.asset.rejected': `驳回资产 ${firstNonEmpty([payload.id, '-'])}`,
    'admin.asset.published': `发布共享资产 ${firstNonEmpty([payload.id, '-'])}`,
    'admin.asset.bound': `绑定资产到租户 ${firstNonEmpty([payload.tenantId, '-'])}`,
    'matrix.bot.started': 'Matrix Bot 启动',
    'matrix.bot.stopped': 'Matrix Bot 停止',
    'matrix.relay.started': 'Matrix Relay 启动',
    'matrix.relay.stopped': 'Matrix Relay 停止',
    'matrix.relay.inbound': `收到渠道消息 ${firstNonEmpty([payload.eventId, '-'])}`,
    'matrix.relay.inbound.encrypted_ignored': `加密消息未解密 ${firstNonEmpty([payload.eventId, '-'])}`,
    'matrix.relay.delivery.succeeded': `渠道消息投递成功 ${firstNonEmpty([payload.traceId, payload.eventId, '-'])}`,
    'matrix.relay.delivery.failed': `渠道消息投递失败 ${firstNonEmpty([payload.traceId, payload.eventId, '-'])}`,
    'matrix.relay.crypto.ready': 'Matrix 加密能力就绪',
    'matrix.relay.crypto.failed': 'Matrix 加密能力初始化失败',
    'matrix.command.received': `收到命令 ${firstNonEmpty([payload.command, '-'])}`,
    'matrix.command.handled': `命令处理${firstNonEmpty([payload.phase, '-'])} ${firstNonEmpty([payload.command, '-'])}`,
    'runtime.openclaw.shared_agent.discovered': `运行时发现共享Agent ${firstNonEmpty([payload.capabilitySignature, payload.name, '-'])}`,
    'runtime.openclaw.shared_agent.synced': `共享Agent大厅自动同步（总数 ${Number(payload.total || 0)}）`,
    'runtime.openclaw.shared_agent.upserted': `共享Agent运行时上报入库（数量 ${Number(payload.upserted || 0)}）`,
    'audit.anchor.created': `创建审计锚点 ${firstNonEmpty([payload.anchorId, '-'])}`
  };

  if (map[type]) {
    const suffix = actor ? `（操作者：${actor}）` : '';
    return `${map[type]}${suffix}`;
  }
  if (taskId) return `记录任务相关行为（${taskId}）`;
  if (employeeId) return `记录员工相关行为（${employeeId}）`;
  return `记录系统行为：${type || 'unknown'}`;
}

function relatedObject(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const taskId = firstNonEmpty([payload.taskId, payload.task_id]);
  const employeeId = firstNonEmpty([payload.employeeId, payload.employee_id]);
  const skillId = firstNonEmpty([payload.skillId]);
  const serviceId = firstNonEmpty([payload.serviceId]);
  const resource = firstNonEmpty([payload.audit_resource]);
  const parts = [];
  if (taskId) parts.push(`任务 ${taskId}`);
  if (employeeId) parts.push(`员工 ${employeeId}`);
  if (skillId) parts.push(`技能 ${skillId}`);
  if (serviceId) parts.push(`服务 ${serviceId}`);
  if (resource) parts.push(`资源 ${resource}`);
  return parts.length ? parts.join(' / ') : '-';
}

function renderRows(rows = []) {
  const body = document.getElementById('rows');
  if (!body) return;
  if (!rows.length) {
    renderEmpty('暂无日志数据');
    return;
  }
  body.innerHTML = rows.map((event) => {
    const at = event.at ? new Date(event.at).toLocaleString() : '-';
    const module = moduleLabelByKey(eventModuleKey(event));
    const summary = summarizeAction(event);
    const object = relatedObject(event);
    const raw = JSON.stringify(event.payload || {}, null, 2);
    const rowKey = logRowKey(event);
    const openAttr = viewState.expandedRowKeys.has(rowKey) ? ' open' : '';
    return `
      <tr>
        <td>${escapeHtml(at)}</td>
        <td><span class="badge">${escapeHtml(module)}</span></td>
        <td>${escapeHtml(summary)}</td>
        <td>${escapeHtml(object)}</td>
        <td>
          <details data-row-key="${escapeHtml(rowKey)}"${openAttr}>
            <summary>查看原始数据</summary>
            <pre class="mono">${escapeHtml(raw)}</pre>
          </details>
        </td>
      </tr>
    `;
  }).join('');
}

function updateUrlQuery() {
  const params = new URLSearchParams(window.location.search || '');
  params.delete('type');
  params.delete('module');
  params.delete('page');
  params.delete('operation');
  params.delete('status');
  params.delete('timeRange');
  params.delete('trace');
  params.delete('keyword');
  if (viewState.scope === 'admin' || viewState.scope === 'service') {
    if (viewState.module !== 'all') params.set('module', viewState.module);
    if (viewState.scope === 'admin' && viewState.page !== 'all') params.set('page', viewState.page);
    if (viewState.operation !== 'all') params.set('operation', viewState.operation);
    if (viewState.scope === 'service') {
      if (viewState.status !== 'all') params.set('status', viewState.status);
      if (viewState.timeRange !== '1h') params.set('timeRange', viewState.timeRange);
      if (viewState.trace) params.set('trace', viewState.trace);
      if (viewState.keyword) params.set('keyword', viewState.keyword);
    }
  } else {
    if (viewState.operation !== 'all') params.set('operation', viewState.operation);
  }
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', next);
}

function persistViewState() {
  writeStorage(storageKey('module', viewState.scope), viewState.module);
  writeStorage(storageKey('page', viewState.scope), viewState.page);
  writeStorage(storageKey('operation', viewState.scope), viewState.operation);
  writeStorage(storageKey('status', viewState.scope), viewState.status);
  writeStorage(storageKey('timeRange', viewState.scope), viewState.timeRange);
  writeStorage(storageKey('trace', viewState.scope), viewState.trace);
  writeStorage(storageKey('keyword', viewState.scope), viewState.keyword);
  updateUrlQuery();
}

function bindControls() {
  const moduleSelect = document.getElementById('logModuleFilter');
  const pageSelect = document.getElementById('logPageFilter');
  const operationSelect = document.getElementById('logOperationFilter');
  const statusSelect = document.getElementById('logStatusFilter');
  const timeRangeSelect = document.getElementById('logTimeRangeFilter');
  const traceInput = document.getElementById('logTraceFilter');
  const keywordInput = document.getElementById('logKeywordFilter');

  if (moduleSelect) {
    moduleSelect.addEventListener('change', async () => {
      viewState.module = normalizeFilter(moduleSelect.value);
      viewState.page = 'all';
      viewState.operation = 'all';
      persistViewState();
      await load();
    });
  }

  if (pageSelect) {
    pageSelect.addEventListener('change', async () => {
      if (viewState.scope !== 'admin') return;
      viewState.page = normalizeFilter(pageSelect.value);
      viewState.operation = 'all';
      persistViewState();
      await load();
    });
  }

  if (operationSelect) {
    operationSelect.addEventListener('change', async () => {
      viewState.operation = normalizeFilter(operationSelect.value);
      persistViewState();
      await load();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      viewState.status = normalizeFilter(statusSelect.value);
      persistViewState();
      await load();
    });
  }

  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', async () => {
      viewState.timeRange = normalizeFilter(timeRangeSelect.value);
      persistViewState();
      await load();
    });
  }

  if (traceInput) {
    traceInput.addEventListener('change', async () => {
      viewState.trace = String(traceInput.value || '').trim();
      persistViewState();
      await load();
    });
    traceInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      viewState.trace = String(traceInput.value || '').trim();
      persistViewState();
      await load();
    });
  }

  if (keywordInput) {
    keywordInput.addEventListener('change', async () => {
      viewState.keyword = String(keywordInput.value || '').trim();
      persistViewState();
      await load();
    });
    keywordInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      viewState.keyword = String(keywordInput.value || '').trim();
      persistViewState();
      await load();
    });
  }
}

function syncAdminFilterOptions(scopedRows = []) {
  const moduleSelect = document.getElementById('logModuleFilter');
  const pageSelect = document.getElementById('logPageFilter');
  const operationSelect = document.getElementById('logOperationFilter');
  if (!moduleSelect || !pageSelect || !operationSelect) return;

  const moduleCount = new Map();
  scopedRows.forEach((event) => {
    const key = eventModuleKey(event);
    moduleCount.set(key, (moduleCount.get(key) || 0) + 1);
  });
  const moduleOptions = [...moduleCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return moduleLabelByKey(a[0]).localeCompare(moduleLabelByKey(b[0]), 'zh-CN');
  });
  if (viewState.module !== 'all' && !moduleOptions.some(([key]) => key === viewState.module)) viewState.module = 'all';
  moduleSelect.innerHTML = ['<option value="all">全部</option>', ...moduleOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(moduleLabelByKey(key))}（${count}）</option>`
  ))].join('');
  moduleSelect.value = viewState.module;

  const moduleFiltered = filterLogsByModule(scopedRows, viewState.module);
  const pageCount = new Map();
  moduleFiltered.forEach((event) => {
    const key = eventPageKey(event);
    pageCount.set(key, (pageCount.get(key) || 0) + 1);
  });
  const pageOptions = [...pageCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'zh-CN');
  });
  if (viewState.page !== 'all' && !pageOptions.some(([key]) => key === viewState.page)) viewState.page = 'all';
  pageSelect.innerHTML = ['<option value="all">全部</option>', ...pageOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(key)}（${count}）</option>`
  ))].join('');
  pageSelect.value = viewState.page;

  const pageFiltered = filterLogsByPage(moduleFiltered, viewState.page);
  const operationCount = new Map();
  pageFiltered.forEach((event) => {
    const key = eventOperationKey(event);
    operationCount.set(key, (operationCount.get(key) || 0) + 1);
  });
  const operationOptions = [...operationCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'zh-CN');
  });
  if (viewState.operation !== 'all' && !operationOptions.some(([key]) => key === viewState.operation)) viewState.operation = 'all';
  operationSelect.innerHTML = ['<option value="all">全部</option>', ...operationOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(key)}（${count}）</option>`
  ))].join('');
  operationSelect.value = viewState.operation;
}

function syncServiceFilterOptions(scopedRows = []) {
  const moduleSelect = document.getElementById('logModuleFilter');
  const operationSelect = document.getElementById('logOperationFilter');
  const statusSelect = document.getElementById('logStatusFilter');
  const timeRangeSelect = document.getElementById('logTimeRangeFilter');
  const traceInput = document.getElementById('logTraceFilter');
  const keywordInput = document.getElementById('logKeywordFilter');
  if (!moduleSelect || !operationSelect) return;

  const moduleCount = new Map();
  scopedRows.forEach((event) => {
    const key = eventModuleKey(event);
    moduleCount.set(key, (moduleCount.get(key) || 0) + 1);
  });
  const moduleOptions = [...moduleCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return moduleLabelByKey(a[0]).localeCompare(moduleLabelByKey(b[0]), 'zh-CN');
  });
  if (viewState.module !== 'all' && !moduleOptions.some(([key]) => key === viewState.module)) viewState.module = 'all';
  moduleSelect.innerHTML = ['<option value="all">全部</option>', ...moduleOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(moduleLabelByKey(key))}（${count}）</option>`
  ))].join('');
  moduleSelect.value = viewState.module;

  const moduleFiltered = filterLogsByModule(scopedRows, viewState.module);
  const operationCount = new Map();
  moduleFiltered.forEach((event) => {
    const key = eventOperationKey(event);
    operationCount.set(key, (operationCount.get(key) || 0) + 1);
  });
  const operationOptions = [...operationCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'zh-CN');
  });
  if (viewState.operation !== 'all' && !operationOptions.some(([key]) => key === viewState.operation)) viewState.operation = 'all';
  operationSelect.innerHTML = ['<option value="all">全部</option>', ...operationOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(key)}（${count}）</option>`
  ))].join('');
  operationSelect.value = viewState.operation;

  if (statusSelect) statusSelect.value = viewState.status || 'all';
  if (timeRangeSelect) timeRangeSelect.value = viewState.timeRange || '1h';
  if (traceInput) traceInput.value = viewState.trace || '';
  if (keywordInput) keywordInput.value = viewState.keyword || '';
}

function syncAgentFilterOptions(scopedRows = []) {
  const operationSelect = document.getElementById('logOperationFilter');
  if (!operationSelect) return;
  const operationCount = new Map();
  scopedRows.forEach((event) => {
    const key = String(event && event.type || '').trim();
    if (!key) return;
    operationCount.set(key, (operationCount.get(key) || 0) + 1);
  });
  const operationOptions = [...operationCount.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], 'zh-CN');
  });
  if (viewState.operation !== 'all' && !operationOptions.some(([key]) => key === viewState.operation)) viewState.operation = 'all';
  operationSelect.innerHTML = ['<option value="all">全部</option>', ...operationOptions.map(([key, count]) => (
    `<option value="${escapeHtml(key)}">${escapeHtml(key)}（${count}）</option>`
  ))].join('');
  operationSelect.value = viewState.operation;
}

function bindDetailsToggleState() {
  const body = document.getElementById('rows');
  if (!body) return;
  const detailsNodes = body.querySelectorAll('details[data-row-key]');
  detailsNodes.forEach((detailsNode) => {
    if (detailsNode.dataset.toggleBound === '1') return;
    detailsNode.dataset.toggleBound = '1';
    detailsNode.addEventListener('toggle', () => {
      const rowKey = detailsNode.getAttribute('data-row-key');
      if (!rowKey) return;
      if (detailsNode.open) viewState.expandedRowKeys.add(rowKey);
      else viewState.expandedRowKeys.delete(rowKey);
    });
  });
}

window.addEventListener('error', (event) => {
  const msg = event && event.message ? event.message : 'unknown error';
  const stack = event && event.error && event.error.stack ? event.error.stack : '';
  renderFatalError(`window.error: ${msg}`, stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event && event.reason ? event.reason : 'unknown rejection';
  const text = reason && reason.stack ? String(reason.stack) : String(reason);
  renderFatalError('unhandledrejection', text);
});

function emptyMessageForScope() {
  if (viewState.operation !== 'all') return `暂无操作为 ${viewState.operation} 的日志`;
  if ((viewState.scope === 'admin' || viewState.scope === 'service') && viewState.page !== 'all') return `暂无页面为 ${viewState.page} 的日志`;
  if ((viewState.scope === 'admin' || viewState.scope === 'service') && viewState.module !== 'all') return `暂无模块为 ${viewState.module} 的日志`;
  if (viewState.scope === 'admin') return '暂无后台操作日志';
  if (viewState.scope === 'service') return '暂无平台服务日志';
  return '暂无 Agent 行为日志';
}

async function load() {
  try {
    const all = await api('/api/admin/logs');
    const scoped = Array.isArray(all) ? filterLogsByScope(all, viewState.scope) : [];

    if (viewState.scope === 'admin') syncAdminFilterOptions(scoped);
    else if (viewState.scope === 'service') syncServiceFilterOptions(scoped);
    else syncAgentFilterOptions(scoped);

    const filtered = viewState.scope === 'admin'
      ? filterLogsByOperation(
        filterLogsByPage(
          filterLogsByModule(scoped, viewState.module),
          viewState.page
        ),
        viewState.operation
      )
      : viewState.scope === 'service'
        ? filterLogsByKeyword(
          filterLogsByTrace(
            filterLogsByStatus(
              filterLogsByOperation(
                filterLogsByModule(
                  filterLogsByTimeRange(scoped, viewState.timeRange),
                  viewState.module
                ),
                viewState.operation
              ),
              viewState.status
            ),
            viewState.trace
          ),
          viewState.keyword
        )
        : filterLogsByOperation(scoped, viewState.operation);

    const rows = filtered;
    viewState._lastFilteredRows = rows;
    const rowKeySet = new Set(rows.map((event) => logRowKey(event)));
    for (const rowKey of [...viewState.expandedRowKeys]) {
      if (!rowKeySet.has(rowKey)) viewState.expandedRowKeys.delete(rowKey);
    }

    if (!rows.length) {
      renderEmpty(emptyMessageForScope());
      setText('logCount', '0');
      setText('latestLogTime', '-');
      return;
    }

    setText('logCount', String(rows.length));
    setText('latestLogTime', rows[0].at ? new Date(rows[0].at).toLocaleString() : '-');
    renderRows(rows);
    bindDetailsToggleState();

    if (window.__refreshGlobalTablePagination) {
      window.__refreshGlobalTablePagination();
    }
  } catch (error) {
    renderEmpty(`加载失败：${error.message}`);
  }
}

function exportFilteredLogs(format) {
  const rows = viewState._lastFilteredRows || [];
  if (!rows.length) { alert('当前无数据可导出'); return; }

  if (format === 'csv') {
    const header = '时间,模块,事件类型,行为摘要,关联对象';
    const csvRows = rows.map(event => {
      const at = event.at ? new Date(event.at).toLocaleString() : '-';
      const module = moduleLabelByKey(eventModuleKey(event));
      const type = String(event.type || '-');
      const summary = summarizeAction(event).replace(/"/g, '""');
      const object = relatedObject(event).replace(/"/g, '""');
      return `"${at}","${module}","${type}","${summary}","${object}"`;
    });
    const blob = new Blob(['\uFEFF' + header + '\n' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `logs-${viewState.scope}-${new Date().toISOString().slice(0,10)}.csv`);
  } else {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `logs-${viewState.scope}-${new Date().toISOString().slice(0,10)}.json`);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

(async () => {
  viewState.scope = resolveLogScope();
  viewState.module = resolveModuleFilter(viewState.scope);
  viewState.page = resolvePageFilter(viewState.scope);
  viewState.operation = resolveOperationFilter(viewState.scope);
  viewState.status = resolveStatusFilter(viewState.scope);
  viewState.timeRange = resolveTimeRangeFilter(viewState.scope) || '1h';
  viewState.trace = resolveTraceFilter(viewState.scope);
  viewState.keyword = resolveKeywordFilter(viewState.scope);
  if (viewState.scope === 'agent') {
    viewState.module = 'all';
    viewState.page = 'all';
    viewState.status = 'all';
    viewState.timeRange = '1h';
    viewState.trace = '';
    viewState.keyword = '';
  }
  if (viewState.scope === 'admin') {
    viewState.status = 'all';
    viewState.timeRange = '1h';
    viewState.trace = '';
    viewState.keyword = '';
  }
  bindControls();
  bindViewToggle();
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportJson = document.getElementById('btnExportJson');
  if (btnExportCsv) btnExportCsv.addEventListener('click', () => exportFilteredLogs('csv'));
  if (btnExportJson) btnExportJson.addEventListener('click', () => exportFilteredLogs('json'));
  persistViewState();
  await load();

  if (window.__adminReady) {
    try {
      await Promise.race([
        window.__adminReady,
        new Promise((resolve) => window.setTimeout(resolve, 1500))
      ]);
    } catch {
      // keep logs page usable even if global shell initialization fails
    }
  }
  await load();
  setInterval(() => {
    if (viewState.expandedRowKeys.size > 0) return;
    load();
  }, 2500);
})().catch((error) => {
  const message = error && error.message ? error.message : 'initialization failed';
  const stack = error && error.stack ? error.stack : '';
  renderFatalError(`init failed: ${message}`, stack);
});
