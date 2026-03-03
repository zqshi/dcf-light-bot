/* global document, localStorage */
(function () {
  const state = {
    token: localStorage.getItem('dcf_admin_token') || '',
    me: null
  };

  const el = {
    loginCard: document.getElementById('login-card'),
    dashboard: document.getElementById('dashboard'),
    workspace: document.getElementById('workspace'),
    loginForm: document.getElementById('login-form'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    sessionUser: document.getElementById('session-user'),
    logout: document.getElementById('btn-logout'),
    toast: document.getElementById('toast'),
    healthLevel: document.getElementById('health-level'),
    statusSummary: document.getElementById('status-summary'),
    instanceTotal: document.getElementById('instance-total'),
    pendingTotal: document.getElementById('pending-total'),
    preflightOk: document.getElementById('preflight-ok'),
    instancesTable: document.getElementById('instances-table'),
    sharedAssets: document.getElementById('shared-assets'),
    pendingAssets: document.getElementById('pending-assets'),
    auditList: document.getElementById('audit-list'),
    releaseJson: document.getElementById('release-json'),
    refreshInstances: document.getElementById('btn-refresh-instances'),
    refreshAssets: document.getElementById('btn-refresh-assets'),
    refreshAudits: document.getElementById('btn-refresh-audits'),
    refreshRelease: document.getElementById('btn-refresh-release')
  };

  async function api(path, options) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const response = await fetch(path, Object.assign({}, options || {}, { headers }));
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || data.success === false) {
      const message = data && data.error && data.error.message || `request failed: ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  function showToast(message, type) {
    el.toast.textContent = message;
    el.toast.className = `toast ${type || ''}`.trim();
  }

  function toggleAuthed(authed) {
    el.loginCard.classList.toggle('hidden', authed);
    el.dashboard.classList.toggle('hidden', !authed);
    el.workspace.classList.toggle('hidden', !authed);
    el.logout.classList.toggle('hidden', !authed);
  }

  function activateTab(tab) {
    document.querySelectorAll('.tab').forEach(function (node) {
      node.classList.toggle('active', node.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function (node) {
      node.classList.toggle('active', node.id === `tab-${tab}`);
    });
  }

  function renderInstances(rows) {
    el.instancesTable.innerHTML = '';
    (rows || []).forEach(function (item) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.id || '-'}</td><td>${item.tenantId || '-'}</td><td>${item.state || '-'}</td><td>${item.runtimeVersion || '-'}</td><td>${item.updatedAt || '-'}</td>`;
      el.instancesTable.appendChild(tr);
    });
  }

  function renderAssets(sharedRows, pendingRows) {
    el.sharedAssets.innerHTML = '';
    (sharedRows || []).slice(0, 20).forEach(function (item) {
      const li = document.createElement('li');
      li.textContent = `${item.assetType || 'skill'} | ${item.name || item.id} | by ${item.ownerTenantId || '-'}`;
      el.sharedAssets.appendChild(li);
    });

    el.pendingAssets.innerHTML = '';
    (pendingRows || []).slice(0, 20).forEach(function (item) {
      const li = document.createElement('li');
      li.textContent = `${item.assetType || 'skill'} | ${item.name || item.id} | 状态 ${item.status || '-'}`;
      el.pendingAssets.appendChild(li);
    });
  }

  function renderAudits(rows) {
    el.auditList.innerHTML = '';
    (rows || []).slice(0, 50).forEach(function (item) {
      const li = document.createElement('li');
      li.textContent = `${item.ts || '-'} | ${item.type || '-'} | actor=${item.actor || '-'}`;
      el.auditList.appendChild(li);
    });
  }

  async function loadDashboard() {
    const statusRes = await api('/status');
    const status = statusRes || {};
    el.healthLevel.textContent = status.healthLevel || 'unknown';
    el.statusSummary.textContent = `failed=${status.failedInstances || 0}, degradedEvents=${status.recentDegradedEvents || 0}`;

    const instanceRes = await api('/api/control/instances');
    const instances = instanceRes.data || [];
    el.instanceTotal.textContent = String(instances.length);
    renderInstances(instances);

    const pendingRes = await api('/api/control/assets/reviews/pending');
    const pending = pendingRes.data || [];
    el.pendingTotal.textContent = String(pending.length);

    const sharedRes = await api('/api/control/assets/shared');
    renderAssets(sharedRes.data || [], pending);

    const auditRes = await api('/api/control/audits?limit=50');
    renderAudits(auditRes.data || []);

    const releaseRes = await api('/api/control/release/preflight');
    el.preflightOk.textContent = releaseRes.data && releaseRes.data.ok ? 'passed' : 'failed';
    el.releaseJson.textContent = JSON.stringify(releaseRes.data || {}, null, 2);

    return { instances, pending };
  }

  async function doLogin(evt) {
    evt.preventDefault();
    try {
      const res = await api('/api/control/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: el.username.value.trim(),
          password: el.password.value
        })
      });
      state.token = res.data.token;
      localStorage.setItem('dcf_admin_token', state.token);
      state.me = res.data.user;
      el.sessionUser.textContent = `${state.me.username} (${state.me.role})`;
      toggleAuthed(true);
      await loadDashboard();
      showToast('登录成功', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function bootstrapFromToken() {
    if (!state.token) {
      toggleAuthed(false);
      return;
    }
    try {
      const me = await api('/api/control/auth/me');
      state.me = me.data;
      el.sessionUser.textContent = `${state.me.username} (${state.me.role})`;
      toggleAuthed(true);
      await loadDashboard();
    } catch {
      localStorage.removeItem('dcf_admin_token');
      state.token = '';
      toggleAuthed(false);
    }
  }

  function bindEvents() {
    el.loginForm.addEventListener('submit', doLogin);
    el.logout.addEventListener('click', function () {
      state.token = '';
      state.me = null;
      localStorage.removeItem('dcf_admin_token');
      el.sessionUser.textContent = '未登录';
      toggleAuthed(false);
      showToast('已退出', 'success');
    });

    document.querySelectorAll('.tab').forEach(function (node) {
      node.addEventListener('click', function () {
        activateTab(node.dataset.tab);
      });
    });

    el.refreshInstances.addEventListener('click', async function () {
      const res = await api('/api/control/instances');
      renderInstances(res.data || []);
      showToast('实例列表已刷新', 'success');
    });

    el.refreshAssets.addEventListener('click', async function () {
      const pendingRes = await api('/api/control/assets/reviews/pending');
      const sharedRes = await api('/api/control/assets/shared');
      renderAssets(sharedRes.data || [], pendingRes.data || []);
      showToast('资产列表已刷新', 'success');
    });

    el.refreshAudits.addEventListener('click', async function () {
      const res = await api('/api/control/audits?limit=50');
      renderAudits(res.data || []);
      showToast('审计日志已刷新', 'success');
    });

    el.refreshRelease.addEventListener('click', async function () {
      const res = await api('/api/control/release/preflight');
      el.preflightOk.textContent = res.data && res.data.ok ? 'passed' : 'failed';
      el.releaseJson.textContent = JSON.stringify(res.data || {}, null, 2);
      showToast('发布预检已刷新', 'success');
    });
  }

  bindEvents();
  bootstrapFromToken();
})();
