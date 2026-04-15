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
  document.getElementById('rows').innerHTML = `<tr><td colspan="9" class="empty">${message}</td></tr>`;
}

function getNode(id) {
  return document.getElementById(id);
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function renderTagList(items, emptyText = '暂无') {
  if (!items || !items.length) return `<span class="badge">${emptyText}</span>`;
  return items.map((item) => `<span class="badge ok">${escapeHtml(item)}</span>`).join(' ');
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch (_) {
    return String(value);
  }
}

function uniqueSortedValues(rows = [], field) {
  const set = new Set();
  for (const row of rows) {
    const value = row[field];
    if (value != null && value !== '') set.add(String(value));
  }
  return [...set].sort();
}

function readEmployeeFilters() {
  return {
    keyword: String((getNode('employeeKeyword') && getNode('employeeKeyword').value) || '').trim(),
    tenantId: String((getNode('tenantFilter') && getNode('tenantFilter').value) || '').trim(),
    channelId: String((getNode('channelFilter') && getNode('channelFilter').value) || '').trim(),
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
  if (filters.channelId) params.set('channelId', filters.channelId);
  if (filters.state) params.set('state', filters.state);
  if (filters.department) params.set('department', filters.department);
  if (filters.role) params.set('role', filters.role);
  const qs = params.toString();
  return `/api/admin/employees${qs ? '?' + qs : ''}`;
}

async function fetchEmployeeRows() {
  const url = buildEmployeesQuery();
  const data = await api(url);
  return Array.isArray(data) ? data : (data && data.employees ? data.employees : []);
}

async function fetchEmployeeDetail(employeeId) {
  const data = await api(`/api/admin/employees/${employeeId}`);
  return data;
}

function formatDepartmentLabel(value) {
  if (!value) return '-';
  const lower = String(value).toLowerCase().trim();
  if (DEPARTMENT_LABELS[lower]) return DEPARTMENT_LABELS[lower];
  return value;
}

function formatRoleLabel(value) {
  if (!value) return '-';
  const lower = String(value).toLowerCase().trim();
  if (ROLE_LABELS[lower]) return ROLE_LABELS[lower];
  return value;
}

function formatDeptRoleText(department, role) {
  const d = formatDepartmentLabel(department);
  const r = formatRoleLabel(role);
  return (d !== '-' || r !== '-') ? `${d} / ${r}` : '-';
}

function renderFilterOptions(selectId, values, currentValue, defaultLabel, formatLabel = null) {
  const selectNode = getNode(selectId);
  if (!selectNode) return;
  let html = `<option value="">${defaultLabel}</option>`;
  for (const v of values) {
    const label = formatLabel ? formatLabel(v) : v;
    const selected = v === currentValue ? ' selected' : '';
    html += `<option value="${escapeHtml(v)}"${selected}>${escapeHtml(label)}</option>`;
  }
  selectNode.innerHTML = html;
}

function updateFilterOptions(rows = []) {
  const filters = readEmployeeFilters();
  renderFilterOptions('departmentFilter', uniqueSortedValues(rows, 'department'), filters.department, '所有部门', formatDepartmentLabel);
  renderFilterOptions('roleFilter', uniqueSortedValues(rows, 'role'), filters.role, '所有角色', formatRoleLabel);
}

function statusTone(status) {
  if (status === 'active' || status === 'running') return 'ok';
  if (status === 'provisioning' || status === 'pending') return 'warn';
  if (status === 'error' || status === 'failed') return 'err';
  return '';
}

function statusHint(status) {
  if (status === 'provisioning') return '实例正在创建中…';
  if (status === 'pending') return '等待管理员启动';
  if (status === 'error' || status === 'failed') return '异常，请检查日志';
  return '';
}

async function performInstanceAction(employeeId, action) {
  return api(`/api/admin/employees/${employeeId}/instance-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
}

function bindEnterReload(inputNode) {
  if (!inputNode) return;
  inputNode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      load();
    }
  });
}

function growthSnapshot(employee = {}) {
  return {
    capabilities: Array.isArray(employee.capabilities) ? employee.capabilities : [],
    knowledge: Array.isArray(employee.knowledge) ? employee.knowledge : [],
    linkedSkillIds: Array.isArray(employee.linkedSkillIds) ? employee.linkedSkillIds : [],
    certifications: Array.isArray(employee.certifications) ? employee.certifications : [],
    careerPath: employee.careerPath || '-'
  };
}

function contractSnapshot(employee = {}) {
  const jobPolicy = employee.jobPolicy || {};
  const allow = Array.isArray(jobPolicy.allow) ? jobPolicy.allow : [];
  const deny = Array.isArray(jobPolicy.deny) ? jobPolicy.deny : [];
  return {
    allowCount: allow.length,
    denyCount: deny.length,
    allow,
    deny
  };
}

function resolveRuntimeProfile(detail = {}) {
  return detail.runtimeProfile || detail.runtime || {};
}

function setTopicDrawerVisibility(open) {
  topicDrawerOpen = Boolean(open);
  const drawer = getNode('topicDrawer');
  const mask = getNode('topicDrawerMask');
  if (drawer) drawer.classList.toggle('hidden', !topicDrawerOpen);
  if (mask) {
    mask.classList.toggle('hidden', !topicDrawerOpen);
    mask.setAttribute('aria-hidden', String(!topicDrawerOpen));
  }
}

function findEmployeeById(employeeId) {
  return employeeCache.find((emp) => emp.id === employeeId) || null;
}

function renderTopicDrawer(employeeId, type) {
  const drawer = getNode('topicDrawer');
  if (!drawer) return;
  const employee = findEmployeeById(employeeId);
  if (!employee) {
    drawer.innerHTML = `<p class="empty">未找到员工 ${escapeHtml(employeeId)}</p>`;
    return;
  }
  const title = type === 'growth' ? '成长档案' : '契约概览';
  let body = '';
  if (type === 'growth') {
    const growth = growthSnapshot(employee);
    body = `
      <div class="drawer-section">
        <h4>能力标签</h4>${renderTagList(growth.capabilities, '暂无能力标签')}
      </div>
      <div class="drawer-section">
        <h4>知识领域</h4>${renderTagList(growth.knowledge, '暂无知识领域')}
      </div>
      <div class="drawer-section">
        <h4>关联技能</h4>
        ${growth.linkedSkillIds.length > 0
    ? growth.linkedSkillIds.map((id) => `<span class="badge ok mono">${escapeHtml(id)}</span>`).join(' ')
    : '<span class="badge">暂无关联技能</span>'}
      </div>
      <div class="drawer-section">
        <h4>认证与路径</h4>
        <p>认证：${growth.certifications.length > 0 ? renderTagList(growth.certifications) : '暂无'}</p>
        <p>成长路径：${escapeHtml(growth.careerPath)}</p>
      </div>
    `;
  } else {
    const contract = contractSnapshot(employee);
    const jobPolicy = employee.jobPolicy || {};
    const approvalPolicy = employee.approvalPolicy || {};
    body = `
      <div class="drawer-section">
        <h4>Allow 列表 <span class="badge ok">${contract.allowCount}</span></h4>
        ${contract.allow.length > 0
    ? `<ul>${contract.allow.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
    : '<p class="empty">暂无 Allow 条目</p>'}
      </div>
      <div class="drawer-section">
        <h4>Deny 列表 <span class="badge err">${contract.denyCount}</span></h4>
        ${contract.deny.length > 0
    ? `<ul>${contract.deny.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
    : '<p class="empty">暂无 Deny 条目</p>'}
      </div>
      <div class="drawer-section">
        <h4>KPI 指标</h4>
        ${Array.isArray(jobPolicy.kpi) && jobPolicy.kpi.length > 0
    ? renderTagList(jobPolicy.kpi)
    : '<span class="badge">暂无 KPI</span>'}
      </div>
      <div class="drawer-section">
        <h4>上报 / 熔断规则</h4>
        <p>上报：${escapeHtml(jobPolicy.escalationRule || '未设置')}</p>
        <p>熔断：${escapeHtml(jobPolicy.shutdownRule || '未设置')}</p>
      </div>
      <div class="drawer-section">
        <h4>审批策略</h4>
        ${approvalPolicy.byRisk ? Object.entries(approvalPolicy.byRisk).map(([level, policy]) => {
    const p = policy || {};
    return `<div class="overview-item">${escapeHtml(level)}：需 ${p.requiredApprovals || 0} 人审批` +
              (Array.isArray(p.requiredAnyRoles) && p.requiredAnyRoles.length > 0 ? `（角色：${p.requiredAnyRoles.join(', ')}）` : '') +
              (p.distinctRoles ? ' [去重]' : '') +
              '</div>';
  }).join('') : '<p class="empty">暂无审批策略</p>'}
      </div>
    `;
  }
  drawer.innerHTML = `
    <div class="topic-drawer-header">
      <h3>${escapeHtml(employee.name || '-')} · ${escapeHtml(title)}</h3>
      <button id="closeTopicDrawer" title="关闭">✕</button>
    </div>
    <div class="topic-drawer-body">${body}</div>
  `;
  const closeTopicBtn = getNode('closeTopicDrawer');
  if (closeTopicBtn) closeTopicBtn.onclick = () => setTopicDrawerVisibility(false);
}

function setDrawerVisibility(open) {
  drawerOpen = Boolean(open);
  const drawer = getNode('employeeDrawer');
  const mask = getNode('employeeDrawerMask');
  if (drawer) drawer.classList.toggle('hidden', !drawerOpen);
  if (mask) {
    mask.classList.toggle('hidden', !drawerOpen);
    mask.setAttribute('aria-hidden', String(!drawerOpen));
  }
}

function setDrawerMode(mode) {
  drawerMode = mode;
  const viewPanel = getNode('viewPanel');
  const editPanel = getNode('editPanel');
  if (viewPanel) viewPanel.classList.toggle('hidden', mode !== 'view');
  if (editPanel) editPanel.classList.toggle('hidden', mode !== 'edit');
}

// ── Detail rendering (delegated to employee-detail-renderer.js) ──

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

// ── Form rendering (delegated to employee-form-renderer.js) ──

const formRenderer = (window.__adminEmployeeFormRenderer
  && typeof window.__adminEmployeeFormRenderer.createEmployeeFormRenderer === 'function')
  ? window.__adminEmployeeFormRenderer.createEmployeeFormRenderer({
    getNode,
    escapeHtml,
    api,
    resolveRuntimeProfile,
    fetchEmployeeDetail,
    setDrawerMode,
    setDrawerVisibility,
    canWriteEmployees,
    loadPage: () => load(),
    getCurrentEmployeeId: () => currentEmployeeId,
    setCurrentEmployeeId: (id) => { currentEmployeeId = id; }
  })
  : null;

const openEditModal = formRenderer ? formRenderer.openEditModal : async () => {};
const wireEditActions = formRenderer ? formRenderer.wireEditActions : () => {};

// ── Main load ──

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
        const matrixRoom = String(e.matrixRoomId || '').trim();
        return `
          <tr>
            <td><span class="mono">${escapeHtml(e.id || '-')}</span></td>
            <td>${escapeHtml(e.name || '-')}</td>
            <td>
              <div class="overview-list">
                <div class="overview-item">工号：${escapeHtml(e.employeeNo || '-')}</div>
                <div class="overview-item">${escapeHtml(e.email || '-')}</div>
              </div>
            </td>
            <td>${escapeHtml(e.tenantId || '-')}</td>
            <td><span class="mono">${escapeHtml(matrixRoom || '-')}</span></td>
            <td>
              <div class="overview-list">
                <div class="overview-item">${escapeHtml(formatDeptRoleText(e.department, e.role) || '-')}</div>
                <div class="overview-item">岗位名：${escapeHtml(e.jobTitle || '-')}</div>
              </div>
            </td>
            <td>
              <div class="overview-list">
                <div class="overview-item">Allow ${contract.allowCount} / Deny ${contract.denyCount}</div>
                <button type="button" data-id="${e.id}" data-topic="contracts">查看</button>
              </div>
            </td>
            <td>
              <div class="overview-list">
                <div class="overview-item">能力 ${growth.capabilities.length} / 知识 ${growth.knowledge.length} / 技能 ${growth.linkedSkillIds.length}</div>
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
