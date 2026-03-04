let currentEmployeeId = null;
let employeeCache = [];
let drawerOpen = false;
let drawerMode = 'view';
let topicDrawerOpen = false;
let topicDrawerType = null;
let topicDrawerEmployeeId = null;
const DEPARTMENT_LABELS = {
  ops: '运营',
  operation: '运营',
  operations: '运营',
  finance: '财务',
  hr: '人力资源',
  human_resources: '人力资源',
  legal: '法务',
  marketing: '市场',
  sales: '销售',
  product: '产品',
  engineering: '研发',
  tech: '技术',
  it: '技术支持',
  support: '客服'
};
const ROLE_LABELS = {
  operator: '操作员',
  dispatcher: '调度员',
  analyst: '分析师',
  reviewer: '审核员',
  manager: '经理',
  admin: '管理员',
  specialist: '专员',
  engineer: '工程师',
  assistant: '助理'
};

async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

function canWriteEmployees() {
  if (typeof window.adminCanAccess === 'function') {
    return window.adminCanAccess('admin.employees.write');
  }
  return true;
}

function applyActionAcl(root = document) {
  if (typeof window.adminApplyActionAclForRoot === 'function') {
    window.adminApplyActionAclForRoot(root);
  }
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
  document.getElementById('rows').innerHTML = `<tr><td colspan="8" class="empty">${message}</td></tr>`;
}

function getNode(id) {
  return document.getElementById(id);
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function showPolicyResult(message, tone = 'info') {
  const node = getNode('policyResult');
  if (!node) return;
  node.classList.remove('hidden', 'warn', 'ok');
  if (tone === 'warn') node.classList.add('warn');
  if (tone === 'ok') node.classList.add('ok');
  node.textContent = String(message || '').trim();
}

function hidePolicyResult() {
  const node = getNode('policyResult');
  if (!node) return;
  node.classList.add('hidden');
  node.classList.remove('warn', 'ok');
  node.textContent = '';
}

const POLICY_REQUIRED_FIELD_IDS = [
  'jobAllowList',
  'jobDenyList',
  'jobKpiList',
  'jobEscalationRule',
  'jobShutdownRule',
  'jobPolicyNarrative'
];

const POLICY_REQUIRED_VALIDATION_IDS = [
  'jobAllowValidation',
  'jobDenyValidation',
  'jobKpiValidation',
  'jobEscalationValidation',
  'jobShutdownValidation',
  'jobNarrativeValidation'
];

function hidePolicyRequiredValidationHints() {
  for (const id of POLICY_REQUIRED_VALIDATION_IDS) {
    const node = getNode(id);
    if (!node) continue;
    node.classList.add('hidden');
    node.textContent = '';
  }
}

function showPolicyRequiredValidationHints(message) {
  const text = String(message || '').trim() || '请至少填写一项边界信息或补充说明。';
  for (const id of POLICY_REQUIRED_VALIDATION_IDS) {
    const node = getNode(id);
    if (!node) continue;
    node.classList.remove('hidden');
    node.textContent = text;
  }
}

function defaultJobPolicy() {
  return {
    allow: [],
    deny: [],
    kpi: [],
    escalationRule: '',
    shutdownRule: ''
  };
}

function defaultApprovalPolicy() {
  return {
    byRisk: {
      L1: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
      L2: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
      L3: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
      L4: { requiredApprovals: 2, requiredAnyRoles: ['auditor', 'super_admin'], distinctRoles: true }
    }
  };
}

function buildDefaultSystemPrompt(input = {}) {
  const name = String(input.name || '数字员工').trim();
  const department = String(input.department || '未命名部门').trim();
  const role = String(input.role || '执行岗位').trim();
  const riskLevel = String(input.riskLevel || 'L2').trim().toUpperCase();
  return [
    `你是 ${name}，隶属 ${department}，岗位是 ${role}。`,
    '你的首要职责是把任务目标拆解为可执行步骤，优先输出可直接落地的结果与证据。',
    `默认风险等级为 ${riskLevel}，必须遵守岗位边界、审批规则与审计要求。`,
    '执行过程中如果出现失败、偏差或信息不足，先进行纠偏与重试，再给出清晰的风险说明和下一步建议。',
    '你必须持续自学习与自成长：从每次任务执行中提炼可复用经验，沉淀为技能、知识与改进策略。',
    '每次输出都要包含：关键结论、执行依据、风险点、后续行动建议。'
  ].join('\n');
}

function renderTagList(items, emptyText = '暂无') {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="badge">${escapeHtml(emptyText)}</span>`;
  return list.slice(0, 12).map((item) => `<span class="badge ok">${escapeHtml(item)}</span>`).join('');
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function uniqueSortedValues(rows = [], field) {
  const set = new Set();
  for (const row of rows) {
    const value = String((row && row[field]) || '').trim();
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function readEmployeeFilters() {
  return {
    keyword: String((getNode('employeeKeyword') && getNode('employeeKeyword').value) || '').trim(),
    tenantId: String((getNode('tenantFilter') && getNode('tenantFilter').value) || '').trim(),
    channel: String((getNode('channelFilter') && getNode('channelFilter').value) || '').trim(),
    state: String((getNode('stateFilter') && getNode('stateFilter').value) || '').trim(),
    department: String((getNode('departmentFilter') && getNode('departmentFilter').value) || '').trim(),
    role: String((getNode('roleFilter') && getNode('roleFilter').value) || '').trim()
  };
}

function buildEmployeesQuery() {
  const filters = readEmployeeFilters();
  const params = new URLSearchParams();
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.state) params.set('state', filters.state);
  if (filters.department) params.set('department', filters.department);
  if (filters.role) params.set('role', filters.role);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function fetchEmployeeRows() {
  const query = buildEmployeesQuery();
  try {
    return await api(`/api/admin/instances${query}`);
  } catch {
    return api(`/api/admin/employees${query}`);
  }
}

async function fetchEmployeeDetail(employeeId) {
  const id = encodeURIComponent(String(employeeId || ''));
  try {
    return await api(`/api/admin/instances/${id}`);
  } catch {
    return api(`/api/admin/employees/${id}`);
  }
}

function formatDepartmentLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  return DEPARTMENT_LABELS[key] || raw;
}

function formatRoleLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  return ROLE_LABELS[key] || raw;
}

function formatDeptRoleText(department, role) {
  const departmentLabel = formatDepartmentLabel(department) || '-';
  const roleLabel = formatRoleLabel(role) || '-';
  return `${departmentLabel} / ${roleLabel}`;
}

function renderFilterOptions(selectId, values, currentValue, defaultLabel, formatLabel = null) {
  const select = getNode(selectId);
  if (!select) return;
  const finalValues = Array.isArray(values) ? values.slice() : [];
  if (currentValue && !finalValues.includes(currentValue)) finalValues.push(currentValue);
  finalValues.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  select.innerHTML = [
    `<option value="">${defaultLabel}</option>`,
    ...finalValues.map((value) => {
      const label = typeof formatLabel === 'function' ? formatLabel(value) : value;
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    })
  ].join('');
  select.value = currentValue || '';
}

function updateFilterOptions(rows = []) {
  const filters = readEmployeeFilters();
  renderFilterOptions('stateFilter', uniqueSortedValues(rows, 'status'), filters.state, '全部状态');
  renderFilterOptions('departmentFilter', uniqueSortedValues(rows, 'department'), filters.department, '全部部门', formatDepartmentLabel);
  renderFilterOptions('roleFilter', uniqueSortedValues(rows, 'role'), filters.role, '全部岗位', formatRoleLabel);
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'running' || value === 'active') return 'ok';
  if (value === 'failed' || value === 'error' || value === 'degraded') return 'warn';
  return '';
}

function statusHint(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'failed' || value === 'error') return '实例创建或重建失败，建议执行重建或查看审计日志。';
  if (value === 'stopped' || value === 'paused') return '实例已停止，可执行启动恢复服务。';
  if (value === 'provisioning' || value === 'rebuilding') return '实例处于变更中，请等待状态收敛。';
  return '';
}

async function performInstanceAction(employeeId, action) {
  const id = encodeURIComponent(String(employeeId || ''));
  const op = String(action || '').trim().toLowerCase();
  if (!['start', 'stop', 'rebuild', 'delete'].includes(op)) throw new Error('不支持的实例动作');
  await api(`/api/admin/instances/${id}/${op}`, { method: 'POST' });
}

function bindEnterReload(inputNode) {
  if (!inputNode) return;
  inputNode.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    load();
  });
}

function growthSnapshot(employee = {}) {
  const capabilities = Array.isArray(employee.capabilities) ? employee.capabilities : [];
  const knowledge = Array.isArray(employee.knowledge) ? employee.knowledge : [];
  const linkedSkillIds = Array.isArray(employee.linkedSkillIds) ? employee.linkedSkillIds : [];
  const childAgents = Array.isArray(employee.childAgents) ? employee.childAgents : [];
  const activeChildAgents = childAgents.filter((item) => String((item && item.status) || '') === 'active');
  return {
    capabilities,
    knowledge,
    linkedSkillIds,
    childAgents,
    activeChildAgents
  };
}

function contractSnapshot(employee = {}) {
  const policy = (employee.jobPolicy && typeof employee.jobPolicy === 'object') ? employee.jobPolicy : {};
  const approvalL4 = ((((employee.approvalPolicy || {}).byRisk || {}).L4) || {});
  return {
    policy,
    approvalL4,
    allowCount: Array.isArray(policy.allow) ? policy.allow.length : 0,
    denyCount: Array.isArray(policy.deny) ? policy.deny.length : 0,
    l4RequiredApprovals: Number(approvalL4.requiredApprovals || 0),
    l4Roles: Array.isArray(approvalL4.requiredAnyRoles) ? approvalL4.requiredAnyRoles : []
  };
}

function resolveRuntimeProfile(detail = {}) {
  if (detail.runtimeProfile && typeof detail.runtimeProfile === 'object') return detail.runtimeProfile;
  if (detail.openclawProfile && typeof detail.openclawProfile === 'object') return detail.openclawProfile;
  return {};
}

function setTopicDrawerVisibility(open) {
  topicDrawerOpen = Boolean(open);
  const drawer = getNode('topicDetailDrawer');
  const mask = getNode('topicDrawerMask');
  if (!drawer || !mask) return;
  drawer.classList.toggle('hidden', !topicDrawerOpen);
  mask.classList.toggle('hidden', !topicDrawerOpen);
  drawer.setAttribute('aria-hidden', topicDrawerOpen ? 'false' : 'true');
  mask.setAttribute('aria-hidden', topicDrawerOpen ? 'false' : 'true');
}

function findEmployeeById(employeeId) {
  return employeeCache.find((employee) => employee.id === employeeId) || null;
}

function renderTopicDrawer(employeeId, type) {
  const drawerTitle = getNode('topicDrawerTitle');
  const drawerBody = getNode('topicDrawerBody');
  if (!drawerTitle || !drawerBody) return;
  const employee = findEmployeeById(employeeId);
  if (!employee) {
    drawerTitle.textContent = '专题详情';
    drawerBody.innerHTML = '<div class="empty">员工不存在或已删除</div>';
    return;
  }

  const contract = contractSnapshot(employee);
  const growth = growthSnapshot(employee);

  if (type === 'contracts') {
    drawerTitle.textContent = `岗位合同 · ${employee.employeeCode || employee.id || '-'}`;
    drawerBody.innerHTML = `
      <section class="detail-section">
        <h4>员工信息</h4>
        <div class="overview-kpis">
          <div><span>工号</span><strong>${escapeHtml(employee.employeeCode || '-')}</strong></div>
          <div><span>姓名</span><strong>${escapeHtml(employee.name || '-')}</strong></div>
          <div><span>部门/岗位</span><strong>${escapeHtml(formatDeptRoleText(employee.department, employee.role))}</strong></div>
          <div><span>风险等级</span><strong>${escapeHtml(employee.riskLevel || '-')}</strong></div>
        </div>
      </section>
      <section class="detail-section">
        <h4>岗位边界</h4>
        <div class="detail-grid2">
          <div>
            <div class="toolbar-note">职责范围（Allow）</div>
            <div>${renderTagList(contract.policy.allow, '未配置')}</div>
          </div>
          <div>
            <div class="toolbar-note">禁止边界（Deny）</div>
            <div>${renderTagList(contract.policy.deny, '未配置')}</div>
          </div>
        </div>
        <div style="margin-top:8px;">
          <div class="toolbar-note">KPI 目标</div>
          <div>${renderTagList(contract.policy.kpi, '未配置')}</div>
        </div>
      </section>
      <section class="detail-section">
        <h4>L4 审批策略</h4>
        <div class="overview-kpis">
          <div><span>需审批人数</span><strong>${contract.l4RequiredApprovals}</strong></div>
          <div><span>可审批角色</span><strong>${escapeHtml(contract.l4Roles.join(', ') || '-')}</strong></div>
        </div>
        <details style="margin-top:8px;">
          <summary>完整审批配置</summary>
          <pre class="mono">${escapeHtml(pretty((employee.approvalPolicy || {}).byRisk || {}))}</pre>
        </details>
      </section>
    `;
    return;
  }

  drawerTitle.textContent = `员工成长 · ${employee.employeeCode || employee.id || '-'}`;
  drawerBody.innerHTML = `
    <section class="detail-section">
      <h4>成长指标</h4>
      <div class="overview-kpis">
        <div><span>能力数</span><strong>${growth.capabilities.length}</strong></div>
        <div><span>知识数</span><strong>${growth.knowledge.length}</strong></div>
        <div><span>关联技能</span><strong>${growth.linkedSkillIds.length}</strong></div>
        <div><span>子Agent总数</span><strong>${growth.childAgents.length}</strong></div>
        <div><span>活跃子Agent</span><strong>${growth.activeChildAgents.length}</strong></div>
      </div>
    </section>
    <section class="detail-section">
      <h4>能力与知识</h4>
      <div class="detail-grid2">
        <div>
          <div class="toolbar-note">能力标签</div>
          <div>${renderTagList(growth.capabilities, '暂无能力')}</div>
        </div>
        <div>
          <div class="toolbar-note">知识条目</div>
          <div>${renderTagList(growth.knowledge, '暂无知识')}</div>
        </div>
      </div>
      <div style="margin-top:8px;">
        <div class="toolbar-note">关联技能</div>
        <div>${renderTagList(growth.linkedSkillIds, '暂无关联技能')}</div>
      </div>
    </section>
    <section class="detail-section">
      <h4>子Agent 列表</h4>
      <pre class="mono">${escapeHtml(pretty(growth.childAgents.slice(0, 20)))}</pre>
    </section>
  `;
}

const renderEmployeeDetail = (window.__adminEmployeeDetailRenderer
  && typeof window.__adminEmployeeDetailRenderer.createEmployeeDetailRenderer === 'function')
  ? window.__adminEmployeeDetailRenderer.createEmployeeDetailRenderer({
    getNode,
    escapeHtml,
    pretty,
    formatDate,
    renderTagList,
    formatDeptRoleText,
    resolveRuntimeProfile
  })
  : (() => {});

function setDrawerVisibility(open) {
  drawerOpen = Boolean(open);
  const drawer = getNode('employeeDetailDrawer');
  const mask = getNode('employeeDrawerMask');
  if (!drawer || !mask) return;
  drawer.classList.toggle('hidden', !drawerOpen);
  mask.classList.toggle('hidden', !drawerOpen);
  drawer.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
  mask.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
}

function setDrawerMode(mode) {
  drawerMode = mode === 'edit' ? 'edit' : 'view';
  const body = getNode('employeeDrawerBody');
  const editor = getNode('employeeDrawerEditor');
  const title = getNode('employeeDrawerTitle');
  if (body) body.classList.toggle('hidden', drawerMode !== 'view');
  if (editor) editor.classList.toggle('hidden', drawerMode !== 'edit');
  if (title) title.textContent = drawerMode === 'edit' ? '编辑数字员工' : '员工详情';
}

function fillEditForm(detail) {
  const readonlyMeta = getNode('editReadonlyMeta');
  const title = getNode('employeeDrawerTitle');
  if (title) title.textContent = `编辑数字员工 · ${detail.employeeCode || detail.id || '-'}`;
  if (readonlyMeta) {
    readonlyMeta.innerHTML = `
      <div><span>工号</span><strong>${escapeHtml(detail.employeeCode || '-')}</strong></div>
      <div><span>邮箱</span><strong>${escapeHtml(detail.email || '-')}</strong></div>
    `;
  }
  const name = getNode('editName');
  const department = getNode('editDepartment');
  const role = getNode('editRole');
  const riskLevel = getNode('editRiskLevel');
  const status = getNode('editStatus');
  const runtimeAgentId = getNode('editRuntimeAgentId');
  const runtimeSystemPrompt = getNode('editRuntimeSystemPrompt');
  if (name) name.value = detail.name || '';
  if (department) department.value = detail.department || '';
  if (role) role.value = detail.role || '';
  if (riskLevel) riskLevel.value = detail.riskLevel || 'L2';
  if (status) status.value = detail.status || 'active';
  const runtimeProfile = resolveRuntimeProfile(detail);
  if (runtimeAgentId) {
    runtimeAgentId.value = runtimeProfile.agentId || '';
    runtimeAgentId.readOnly = true;
    runtimeAgentId.disabled = true;
    runtimeAgentId.setAttribute('aria-readonly', 'true');
  }
  if (runtimeSystemPrompt) {
    runtimeSystemPrompt.value = runtimeProfile.systemPrompt || buildDefaultSystemPrompt({
      name: detail.name,
      department: detail.department,
      role: detail.role,
      riskLevel: detail.riskLevel
    });
  }
  const jobPolicy = detail.jobPolicy || defaultJobPolicy();
  const approvalPolicy = detail.approvalPolicy || defaultApprovalPolicy();

  const setText = (id, value) => {
    const node = getNode(id);
    if (node) node.value = value;
  };
  const setCheck = (id, value) => {
    const node = getNode(id);
    if (node) node.checked = Boolean(value);
  };

  setText('jobAllowList', Array.isArray(jobPolicy.allow) ? jobPolicy.allow.join('\n') : '');
  setText('jobDenyList', Array.isArray(jobPolicy.deny) ? jobPolicy.deny.join('\n') : '');
  setText('jobKpiList', Array.isArray(jobPolicy.kpi) ? jobPolicy.kpi.join('\n') : '');
  setText('jobEscalationRule', jobPolicy.escalationRule || '');
  setText('jobShutdownRule', jobPolicy.shutdownRule || '');
  setText('jobPolicyNarrative', '');

  const byRisk = approvalPolicy.byRisk || {};
  for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const policy = byRisk[level] || {};
    setText(`ap_${level.toLowerCase()}_count`, String(Number(policy.requiredApprovals || 0)));
    setText(`ap_${level.toLowerCase()}_roles`, Array.isArray(policy.requiredAnyRoles) ? policy.requiredAnyRoles.join(', ') : '');
    setCheck(`ap_${level.toLowerCase()}_distinct`, Boolean(policy.distinctRoles));
  }
  syncApprovalFormState();
  hidePolicyRequiredValidationHints();
  hidePolicyResult();
}

function parseLineList(id) {
  const node = getNode(id);
  const raw = node ? String(node.value || '') : '';
  return raw.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseRoleList(input) {
  return String(input || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectJobPolicyFromForm() {
  const escalationRuleNode = getNode('jobEscalationRule');
  const shutdownRuleNode = getNode('jobShutdownRule');
  return {
    allow: parseLineList('jobAllowList'),
    deny: parseLineList('jobDenyList'),
    kpi: parseLineList('jobKpiList'),
    escalationRule: String((escalationRuleNode && escalationRuleNode.value) || '').trim(),
    shutdownRule: String((shutdownRuleNode && shutdownRuleNode.value) || '').trim()
  };
}

function collectApprovalPolicyFromForm() {
  const byRisk = {};
  for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const lower = level.toLowerCase();
    const countNode = getNode(`ap_${lower}_count`);
    const rolesNode = getNode(`ap_${lower}_roles`);
    const distinctNode = getNode(`ap_${lower}_distinct`);
    byRisk[level] = {
      requiredApprovals: Math.max(0, Number((countNode && countNode.value) || 0)),
      requiredAnyRoles: parseRoleList(rolesNode ? rolesNode.value : ''),
      distinctRoles: Boolean(distinctNode && distinctNode.checked)
    };
  }
  return { byRisk };
}

async function optimizePolicyPromptFromForm() {
  if (!currentEmployeeId) throw new Error('请先选择员工');
  const runtimeSystemPromptNode = getNode('editRuntimeSystemPrompt');
  const payload = {
    jobPolicy: collectJobPolicyFromForm(),
    approvalPolicy: collectApprovalPolicyFromForm(),
    runtimeProfile: {
      systemPrompt: String((runtimeSystemPromptNode && runtimeSystemPromptNode.value) || '').trim()
    },
    narrative: String((getNode('jobPolicyNarrative') && getNode('jobPolicyNarrative').value) || '').trim()
  };
  const result = await api(`/api/admin/employees/${currentEmployeeId}/policy-optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const optimizedPrompt = String((result && result.optimizedPrompt) || '').trim();
  if (!optimizedPrompt) throw new Error('未生成可用内容，请重试');
  if (runtimeSystemPromptNode) runtimeSystemPromptNode.value = optimizedPrompt;
  showPolicyResult('已生成大模型理解优化内容，确认后点击“保存”。', 'ok');
}

function hasAnyPolicyInput(jobPolicy = {}, narrative = '') {
  const allow = Array.isArray(jobPolicy.allow) ? jobPolicy.allow : [];
  const deny = Array.isArray(jobPolicy.deny) ? jobPolicy.deny : [];
  const kpi = Array.isArray(jobPolicy.kpi) ? jobPolicy.kpi : [];
  const escalation = String(jobPolicy.escalationRule || '').trim();
  const shutdown = String(jobPolicy.shutdownRule || '').trim();
  const note = String(narrative || '').trim();
  return allow.length > 0 || deny.length > 0 || kpi.length > 0 || Boolean(escalation) || Boolean(shutdown) || Boolean(note);
}

function syncApprovalRowState(level) {
  const lower = String(level || '').toLowerCase();
  const countNode = getNode(`ap_${lower}_count`);
  const rolesNode = getNode(`ap_${lower}_roles`);
  const distinctNode = getNode(`ap_${lower}_distinct`);
  if (!countNode || !rolesNode || !distinctNode) return;
  const requiredApprovals = Math.max(0, Number(countNode.value || 0));
  const disabled = requiredApprovals === 0;
  rolesNode.disabled = disabled;
  distinctNode.disabled = disabled;
  rolesNode.placeholder = disabled ? '0 审批时不生效' : '例如 auditor, super_admin';
  if (disabled) distinctNode.checked = false;
}

function syncApprovalFormState() {
  for (const level of ['L1', 'L2', 'L3', 'L4']) syncApprovalRowState(level);
}

function collectBoundaryHints(jobPolicy, approvalPolicy) {
  const hints = [];
  const allowCount = Array.isArray(jobPolicy.allow) ? jobPolicy.allow.length : 0;
  const denyCount = Array.isArray(jobPolicy.deny) ? jobPolicy.deny.length : 0;
  const kpiCount = Array.isArray(jobPolicy.kpi) ? jobPolicy.kpi.length : 0;
  const escalation = String(jobPolicy.escalationRule || '').trim();
  const shutdown = String(jobPolicy.shutdownRule || '').trim();
  const byRisk = (approvalPolicy && approvalPolicy.byRisk) ? approvalPolicy.byRisk : {};

  if (allowCount === 0) hints.push('职责范围为空：建议至少定义 3 条可执行职责，避免目标漂移。');
  if (denyCount === 0) hints.push('禁止边界为空：建议补充高风险禁行项（如敏感外发、越权调用）。');
  if (kpiCount === 0) hints.push('KPI 目标为空：建议定义可考核结果（时效/质量/完成率）。');
  if (!escalation) hints.push('升级规则为空：建议定义触发人工复核的条件。');
  if (!shutdown) hints.push('停机规则为空：建议定义触发立即停机与接管的条件。');

  for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const p = byRisk[level] || {};
    const requiredApprovals = Number(p.requiredApprovals || 0);
    const roles = Array.isArray(p.requiredAnyRoles) ? p.requiredAnyRoles : [];
    const distinct = Boolean(p.distinctRoles);
    if (requiredApprovals > 0 && roles.length === 0) {
      hints.push(`${level} 配置了审批人数但未配置可审批角色。`);
    }
    if (requiredApprovals > 1 && !distinct) {
      hints.push(`${level} 审批人数 > 1，建议开启“必须角色互异”以降低同质审批风险。`);
    }
  }
  return hints;
}

function evaluateBoundaryChecksFromForm() {
  const jobPolicy = collectJobPolicyFromForm();
  const approvalPolicy = collectApprovalPolicyFromForm();
  const hints = collectBoundaryHints(jobPolicy, approvalPolicy);
  return { hints, jobPolicy, approvalPolicy };
}

function renderBoundaryCheckReport(hints = []) {
  if (!Array.isArray(hints) || !hints.length) {
    showPolicyResult('边界质量检查通过：当前配置未发现明显治理缺口。', 'ok');
    return;
  }
  const lines = [
    '边界质量检查发现以下风险项：',
    ...hints.map((item, index) => `${index + 1}. ${item}`)
  ];
  showPolicyResult(lines.join('\n'), 'warn');
}

function collectEditableProfile() {
  const name = String((getNode('editName') && getNode('editName').value) || '').trim();
  const department = String((getNode('editDepartment') && getNode('editDepartment').value) || '').trim();
  const role = String((getNode('editRole') && getNode('editRole').value) || '').trim();
  const riskLevel = String((getNode('editRiskLevel') && getNode('editRiskLevel').value) || 'L2').trim();
  const runtimePromptRaw = String((getNode('editRuntimeSystemPrompt') && getNode('editRuntimeSystemPrompt').value) || '').trim();
  const runtimePrompt = runtimePromptRaw || buildDefaultSystemPrompt({
    name,
    department,
    role,
    riskLevel
  });
  return {
    name,
    department,
    role,
    riskLevel,
    status: String((getNode('editStatus') && getNode('editStatus').value) || 'active').trim(),
    runtimeProfile: {
      systemPrompt: runtimePrompt
    }
  };
}

async function openEditModal(employeeId) {
  setDrawerMode('edit');
  const detail = await fetchEmployeeDetail(employeeId);
  currentEmployeeId = detail.id;
  fillEditForm(detail);
  hidePolicyResult();
  setDrawerVisibility(true);
}

async function saveEmployeeEdits() {
  if (!currentEmployeeId) throw new Error('请先选择员工');
  const profile = collectEditableProfile();
  const jobPolicy = collectJobPolicyFromForm();
  const approvalPolicy = collectApprovalPolicyFromForm();

  await api(`/api/admin/employees/${currentEmployeeId}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile })
  });
  await api(`/api/admin/employees/${currentEmployeeId}/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobPolicy })
  });
  await api(`/api/admin/employees/${currentEmployeeId}/approval-policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalPolicy })
  });
}

function wireEditActions() {
  const saveBtn = getNode('saveEmployeeEdit');
  const optimizeBtn = getNode('optimizePolicyForLlm');
  if (optimizeBtn) {
    optimizeBtn.disabled = !canWriteEmployees();
    optimizeBtn.onclick = async () => {
      if (!canWriteEmployees()) return;
      try {
        hidePolicyRequiredValidationHints();
        hidePolicyResult();
        const narrative = String((getNode('jobPolicyNarrative') && getNode('jobPolicyNarrative').value) || '').trim();
        const { hints, jobPolicy } = evaluateBoundaryChecksFromForm();
        if (!hasAnyPolicyInput(jobPolicy, narrative)) {
          showPolicyRequiredValidationHints('请至少填写一项边界信息或补充说明后再执行优化。');
          const firstField = getNode(POLICY_REQUIRED_FIELD_IDS[0]);
          if (firstField) firstField.focus();
          return;
        }
        if (hints.length > 0) {
          renderBoundaryCheckReport(hints);
          const summary = hints.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n');
          const confirmed = window.confirm(`检测到 ${hints.length} 项边界风险：\n${summary}\n\n是否仍继续执行大模型理解优化？`);
          if (!confirmed) {
            showPolicyResult('已取消优化，请先修正边界风险后再试。', 'warn');
            return;
          }
        }
        optimizeBtn.disabled = true;
        showPolicyResult('正在生成大模型理解优化内容，请稍候…');
        await optimizePolicyPromptFromForm();
      } catch (error) {
        showPolicyResult(`优化失败：${error.message}`, 'warn');
      } finally {
        optimizeBtn.disabled = false;
      }
    };
  }
  if (saveBtn) {
    saveBtn.disabled = !canWriteEmployees();
    saveBtn.onclick = async () => {
      if (!canWriteEmployees()) return;
      try {
        const { hints } = evaluateBoundaryChecksFromForm();
        if (hints.length > 0) {
          renderBoundaryCheckReport(hints);
          const summary = hints.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n');
          const confirmed = window.confirm(`检测到 ${hints.length} 项边界风险：\n${summary}\n\n是否仍继续保存？`);
          if (!confirmed) {
            showPolicyResult('已取消保存，请先修正边界风险后再提交。', 'warn');
            return;
          }
        } else {
          hidePolicyResult();
        }
        await saveEmployeeEdits();
        showPolicyResult(`保存成功：${new Date().toLocaleString()}`, 'ok');
        await load();
        const detail = await fetchEmployeeDetail(currentEmployeeId);
        fillEditForm(detail);
        setDrawerMode('edit');
      } catch (error) {
        showPolicyResult(`保存失败：${error.message}`, 'warn');
      }
    };
  }

  [
    'jobAllowList', 'jobDenyList', 'jobKpiList', 'jobEscalationRule', 'jobShutdownRule', 'jobPolicyNarrative',
    'editRuntimeSystemPrompt',
    'ap_l1_count', 'ap_l1_roles', 'ap_l1_distinct',
    'ap_l2_count', 'ap_l2_roles', 'ap_l2_distinct',
    'ap_l3_count', 'ap_l3_roles', 'ap_l3_distinct',
    'ap_l4_count', 'ap_l4_roles', 'ap_l4_distinct'
  ].forEach((id) => {
    const node = getNode(id);
    if (!node) return;
    if (id.endsWith('_count')) {
      node.addEventListener('input', syncApprovalFormState);
      node.addEventListener('change', syncApprovalFormState);
    }
    if (POLICY_REQUIRED_FIELD_IDS.includes(id)) {
      node.addEventListener('input', hidePolicyRequiredValidationHints);
      node.addEventListener('change', hidePolicyRequiredValidationHints);
    }
    node.addEventListener('input', hidePolicyResult);
    node.addEventListener('change', hidePolicyResult);
  });
}

async function load() {
  try {
    const rows = await fetchEmployeeRows();
    employeeCache = Array.isArray(rows) ? rows : [];
    updateFilterOptions(employeeCache);
    if (!Array.isArray(rows) || !rows.length) {
      renderEmpty('暂无员工数据');
      setText('employeeCount', '0');
      setText('departmentCount', '0 个部门');
      currentEmployeeId = null;
      if (topicDrawerOpen) renderTopicDrawer(topicDrawerEmployeeId, topicDrawerType || 'contracts');
      return;
    }

    const deptSet = new Set(rows.map((x) => x.department).filter(Boolean));
    setText('employeeCount', String(rows.length));
    setText('departmentCount', `${deptSet.size} 个部门`);

    document.getElementById('rows').innerHTML = rows
      .map((e) => {
        const contract = contractSnapshot(e);
        const growth = growthSnapshot(e);
        return `
          <tr>
            <td>${e.employeeCode || '-'}</td>
            <td>${e.name || '-'}</td>
            <td>${e.email || '-'}</td>
            <td>${escapeHtml(formatDepartmentLabel(e.department) || '-')}</td>
            <td>${escapeHtml(formatRoleLabel(e.role) || '-')}</td>
            <td>
              <div class="overview-list">
                <div class="overview-item">职责范围 ${contract.allowCount} / 禁止边界 ${contract.denyCount}</div>
                <button type="button" data-id="${e.id}" data-topic="contracts">查看</button>
              </div>
            </td>
            <td>
              <div class="overview-list">
                <div class="overview-item">能力 ${growth.capabilities.length} / 知识 ${growth.knowledge.length}</div>
                <button type="button" data-id="${e.id}" data-topic="growth">查看</button>
              </div>
            </td>
            <td>
              <div class="row-actions">
                <button data-id="${e.id}" data-action="view">查看</button>
                <button data-id="${e.id}" data-action="edit" data-required-permission="admin.employees.write" class="primary">编辑</button>
              </div>
              <div class="overview-list" style="margin-top:6px;">
                <div class="overview-item">状态：<span class="badge ${statusTone(e.status)}">${escapeHtml(e.status || '-')}</span></div>
                ${statusHint(e.status) ? `<div class="overview-item">${escapeHtml(statusHint(e.status))}</div>` : ''}
              </div>
              <div class="row-actions" style="margin-top:6px;">
                <button data-id="${e.id}" data-instance-action="start" data-required-permission="admin.employees.write">启动</button>
                <button data-id="${e.id}" data-instance-action="stop" data-required-permission="admin.employees.write">停止</button>
                <button data-id="${e.id}" data-instance-action="rebuild" data-required-permission="admin.employees.write">重建</button>
                <button data-id="${e.id}" data-instance-action="delete" data-required-permission="admin.employees.write">删除</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    document.querySelectorAll('#rows button[data-topic][data-id]').forEach((button) => {
      button.onclick = () => {
        topicDrawerEmployeeId = button.dataset.id || null;
        topicDrawerType = button.dataset.topic || 'contracts';
        renderTopicDrawer(topicDrawerEmployeeId, topicDrawerType);
        setTopicDrawerVisibility(true);
      };
    });

    document.querySelectorAll('#rows button[data-action][data-id]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.id;
        const action = button.dataset.action || 'view';
        if (action === 'edit') {
          if (!canWriteEmployees()) return;
          await openEditModal(id);
          return;
        }
        const detail = await fetchEmployeeDetail(id);
        currentEmployeeId = detail.id;
        setDrawerMode('view');
        renderEmployeeDetail(detail);
        setDrawerVisibility(true);
      };
    });
    document.querySelectorAll('#rows button[data-instance-action][data-id]').forEach((button) => {
      button.onclick = async () => {
        if (!canWriteEmployees()) return;
        const id = String(button.dataset.id || '');
        const action = String(button.dataset.instanceAction || '').toLowerCase();
        const actionLabel = { start: '启动', stop: '停止', rebuild: '重建', delete: '删除' }[action] || action;
        const needConfirm = action === 'rebuild' || action === 'delete';
        if (needConfirm) {
          const ok = window.confirm(`确认${actionLabel}实例 ${id} ?`);
          if (!ok) return;
        }
        try {
          button.disabled = true;
          await performInstanceAction(id, action);
          await load();
        } catch (error) {
          window.alert(`${actionLabel}失败：${error.message}`);
        } finally {
          button.disabled = false;
        }
      };
    });
    applyActionAcl(getNode('rows'));

    const hasCurrentEmployee = Boolean(currentEmployeeId && employeeCache.some((employee) => employee.id === currentEmployeeId));
    if (!hasCurrentEmployee) {
      currentEmployeeId = employeeCache[0] && employeeCache[0].id ? employeeCache[0].id : null;
    }
    if (currentEmployeeId) {
      const detail = await fetchEmployeeDetail(currentEmployeeId);
      renderEmployeeDetail(detail);
    }
    if (topicDrawerOpen) renderTopicDrawer(topicDrawerEmployeeId, topicDrawerType || 'contracts');
  } catch (error) {
    renderEmpty(`加载失败：${error.message}`);
    if (topicDrawerOpen) renderTopicDrawer(topicDrawerEmployeeId, topicDrawerType || 'contracts');
  }
}

(async () => {
  if (window.__adminReady) await window.__adminReady;
  wireEditActions();
  const keywordInput = getNode('employeeKeyword');
  const tenantFilter = getNode('tenantFilter');
  const channelFilter = getNode('channelFilter');
  const stateFilter = getNode('stateFilter');
  const departmentFilter = getNode('departmentFilter');
  const roleFilter = getNode('roleFilter');
  bindEnterReload(keywordInput);
  bindEnterReload(tenantFilter);
  bindEnterReload(channelFilter);
  if (stateFilter) stateFilter.addEventListener('change', () => load());
  if (departmentFilter) departmentFilter.addEventListener('change', () => load());
  if (roleFilter) roleFilter.addEventListener('change', () => load());

  const closeDrawer = () => setDrawerVisibility(false);
  const closeTopicDrawer = () => setTopicDrawerVisibility(false);
  const closeBtn = getNode('closeEmployeeDrawer');
  const mask = getNode('employeeDrawerMask');
  const closeTopicBtn = getNode('closeTopicDrawer');
  const topicMask = getNode('topicDrawerMask');
  if (closeBtn) closeBtn.onclick = closeDrawer;
  if (mask) mask.onclick = closeDrawer;
  if (closeTopicBtn) closeTopicBtn.onclick = closeTopicDrawer;
  if (topicMask) topicMask.onclick = closeTopicDrawer;
  await load();
  setInterval(load, 2500);
})();
