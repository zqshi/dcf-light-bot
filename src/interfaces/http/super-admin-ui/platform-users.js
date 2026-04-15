(function () {
  'use strict';

  const { apiFetch } = window.__platformAuth;

  const SCOPE_LABELS = { platform: '平台', tenant: '租户' };
  const ROLE_LABELS = {
    platform_admin: '平台管理员', platform_ops: '平台运维',
    tenant_admin: '租户管理员', tenant_ops: '租户运维', tenant_auditor: '租户审计员'
  };
  const ROLE_OPTIONS = [
    { value: 'platform_admin', label: '平台管理员', scope: 'platform' },
    { value: 'platform_ops', label: '平台运维', scope: 'platform' },
    { value: 'tenant_admin', label: '租户管理员', scope: 'tenant' },
    { value: 'tenant_ops', label: '租户运维', scope: 'tenant' },
    { value: 'tenant_auditor', label: '租户审计员', scope: 'tenant' }
  ];

  let _users = [];
  let _tenants = [];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function scopeBadge(scope) {
    const cls = scope === 'platform' ? 'info' : 'ok';
    return `<span class="badge ${cls}">${esc(SCOPE_LABELS[scope] || scope)}</span>`;
  }

  function statusBadge(disabled) {
    return disabled
      ? '<span class="badge fail">已禁用</span>'
      : '<span class="badge ok">正常</span>';
  }

  function sourceBadge(source) {
    const cls = source === 'dynamic' ? 'dynamic' : 'env';
    const label = source === 'dynamic' ? '动态' : '系统';
    return `<span class="pu-source-chip ${cls}">${label}</span>`;
  }

  /* ── Stats ── */
  function renderStats(users) {
    document.getElementById('statTotal').textContent = users.length;
    document.getElementById('statPlatform').textContent = users.filter((u) => u.scope === 'platform').length;
    document.getElementById('statTenant').textContent = users.filter((u) => u.scope === 'tenant').length;
  }

  /* ── Table ── */
  function renderTable(users) {
    const body = document.getElementById('userBody');
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">暂无用户</td></tr>';
      return;
    }
    body.innerHTML = users.map((u) => `
      <tr data-username="${esc(u.username)}" style="cursor:pointer;">
        <td><strong>${esc(u.username)}</strong></td>
        <td>${esc(u.displayName || '-')}</td>
        <td>${scopeBadge(u.scope)}</td>
        <td>${esc(ROLE_LABELS[u.role] || u.role)}</td>
        <td>${u.tenantId ? `<code style="font-size:12px;color:var(--text-soft);">${esc(u.tenantId)}</code>` : '<span style="color:var(--text-soft);">-</span>'}</td>
        <td>${sourceBadge(u.source)}</td>
        <td>${statusBadge(u.disabled)}</td>
        <td>
          <button class="btn-link" data-action="toggle" data-user="${esc(u.username)}">${u.disabled ? '启用' : '禁用'}</button>
          <button class="btn-link" data-action="reset-pw" data-user="${esc(u.username)}">重置密码</button>
        </td>
      </tr>
    `).join('');
  }

  /* ── Load ── */
  async function loadUsers() {
    const scope = document.getElementById('filterScope').value;
    const role = document.getElementById('filterRole').value;
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (role) params.set('role', role);
    const url = '/api/platform/users' + (params.toString() ? '?' + params : '');
    const res = await apiFetch(url);
    const { data } = await res.json();
    _users = data;
    renderStats(data);
    renderTable(data);
  }

  async function loadTenants() {
    try {
      const res = await apiFetch('/api/platform/tenants');
      const { data } = await res.json();
      _tenants = data || [];
    } catch { _tenants = []; }
  }

  /* ── Drawer ── */
  const drawer = document.getElementById('userDrawer');
  const drawerMask = document.getElementById('userDrawerMask');
  const drawerBody = document.getElementById('userDrawerBody');
  const drawerTitle = document.getElementById('userDrawerTitle');

  function openDrawer(mode, user) {
    const isCreate = mode === 'create';
    drawerTitle.textContent = isCreate ? '创建用户' : `编辑用户 — ${user.username}`;
    const u = user || {};

    const roleOpts = ROLE_OPTIONS.map((r) =>
      `<option value="${r.value}" ${u.role === r.value ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    const tenantOpts = _tenants.map((t) =>
      `<option value="${t.id}" ${u.tenantId === t.id ? 'selected' : ''}>${esc(t.name)} (${esc(t.slug)})</option>`
    ).join('');

    drawerBody.innerHTML = `
      <div class="pu-drawer-form">
        <h4 class="pu-section-title">基本信息</h4>
        <div class="pu-field-row">
          <label class="pu-field">
            <span class="pu-field-label">用户名 *</span>
            <input id="puUsername" type="text" value="${esc(u.username || '')}" ${isCreate ? '' : 'disabled'} placeholder="小写字母、数字">
          </label>
          <label class="pu-field">
            <span class="pu-field-label">显示名称</span>
            <input id="puDisplayName" type="text" value="${esc(u.displayName || '')}" placeholder="中文姓名">
          </label>
        </div>
        <label class="pu-field">
          <span class="pu-field-label">邮箱</span>
          <input id="puEmail" type="email" value="${esc(u.email || '')}" placeholder="user@example.com">
        </label>

        <h4 class="pu-section-title">角色与权限</h4>
        <div class="pu-field-row">
          <label class="pu-field">
            <span class="pu-field-label">角色 *</span>
            <select id="puRole">${roleOpts}</select>
          </label>
          <label class="pu-field" id="puTenantGroup" style="${u.scope === 'tenant' || (!u.scope && !isCreate) ? '' : 'display:none'}">
            <span class="pu-field-label">归属租户</span>
            <select id="puTenantId">
              <option value="">-- 选择租户 --</option>
              ${tenantOpts}
            </select>
          </label>
        </div>
        <p class="pu-hint" id="puScopeHint">选择平台角色时作用域为"平台"，选择租户角色时需指定归属租户</p>

        ${isCreate ? `
        <h4 class="pu-section-title">安全</h4>
        <label class="pu-field">
          <span class="pu-field-label">初始密码 *</span>
          <input id="puPassword" type="password" placeholder="至少 6 位">
        </label>
        ` : ''}

        <div class="pu-actions">
          <button type="button" id="puCancelBtn">取消</button>
          <button type="button" id="puSaveBtn" class="primary">${isCreate ? '创建' : '保存'}</button>
        </div>
      </div>
    `;

    // Role → scope/tenant toggle
    const roleSelect = document.getElementById('puRole');
    const tenantGroup = document.getElementById('puTenantGroup');
    roleSelect.addEventListener('change', () => {
      const opt = ROLE_OPTIONS.find((r) => r.value === roleSelect.value);
      tenantGroup.style.display = opt && opt.scope === 'tenant' ? '' : 'none';
    });

    document.getElementById('puCancelBtn').addEventListener('click', closeDrawer);
    document.getElementById('puSaveBtn').addEventListener('click', () => {
      isCreate ? createUser() : updateUser(u.username);
    });

    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    drawerMask.classList.remove('hidden');
    drawerMask.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
    drawerMask.classList.add('hidden');
    drawerMask.setAttribute('aria-hidden', 'true');
  }

  /* ── CRUD ── */
  async function createUser() {
    const username = document.getElementById('puUsername').value.trim();
    const displayName = document.getElementById('puDisplayName').value.trim();
    const email = document.getElementById('puEmail').value.trim();
    const role = document.getElementById('puRole').value;
    const tenantId = document.getElementById('puTenantId').value;
    const password = document.getElementById('puPassword').value;
    const opt = ROLE_OPTIONS.find((r) => r.value === role);
    const scope = opt ? opt.scope : 'tenant';

    if (!username || !role || !password) { alert('请填写必填字段'); return; }
    if (password.length < 6) { alert('密码至少 6 位'); return; }
    if (scope === 'tenant' && !tenantId) { alert('请选择归属租户'); return; }

    try {
      await apiFetch('/api/platform/users', {
        method: 'POST',
        body: JSON.stringify({ username, displayName, email, role, scope, tenantId: tenantId || null, password })
      });
      closeDrawer();
      await loadUsers();
    } catch (err) { alert('创建失败：' + err.message); }
  }

  async function updateUser(username) {
    const displayName = document.getElementById('puDisplayName').value.trim();
    const email = document.getElementById('puEmail').value.trim();
    const role = document.getElementById('puRole').value;
    const tenantId = document.getElementById('puTenantId').value;
    const opt = ROLE_OPTIONS.find((r) => r.value === role);
    const scope = opt ? opt.scope : 'tenant';

    try {
      await apiFetch(`/api/platform/users/${encodeURIComponent(username)}`, {
        method: 'POST',
        body: JSON.stringify({ displayName, email, role, scope, tenantId: tenantId || null })
      });
      closeDrawer();
      await loadUsers();
    } catch (err) { alert('保存失败：' + err.message); }
  }

  async function toggleUser(username) {
    if (!confirm(`确定切换用户 "${username}" 的状态？`)) return;
    try {
      await apiFetch(`/api/platform/users/${encodeURIComponent(username)}/toggle`, { method: 'POST' });
      await loadUsers();
    } catch (err) { alert('操作失败：' + err.message); }
  }

  async function resetPassword(username) {
    const pw = prompt(`为用户 "${username}" 设置新密码（至少 6 位）：`);
    if (!pw) return;
    if (pw.length < 6) { alert('密码至少 6 位'); return; }
    try {
      await apiFetch(`/api/platform/users/${encodeURIComponent(username)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: pw })
      });
      alert('密码已重置');
    } catch (err) { alert('重置失败：' + err.message); }
  }

  /* ── Events ── */
  document.getElementById('createUserBtn').addEventListener('click', () => openDrawer('create'));
  document.getElementById('closeUserDrawer').addEventListener('click', closeDrawer);
  drawerMask.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  document.getElementById('filterScope').addEventListener('change', loadUsers);
  document.getElementById('filterRole').addEventListener('change', loadUsers);

  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const username = actionBtn.dataset.user;
      if (action === 'toggle') toggleUser(username);
      else if (action === 'reset-pw') resetPassword(username);
      return;
    }
    const row = e.target.closest('[data-username]');
    if (row) {
      const username = row.dataset.username;
      const user = _users.find((u) => u.username === username);
      if (user) openDrawer('edit', user);
    }
  });

  /* ── Init ── */
  async function init() {
    await window.__platformReady;
    await loadTenants();
    await loadUsers();
  }

  init();
})();
