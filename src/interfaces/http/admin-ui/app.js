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
    releaseFailures: document.getElementById('release-failures'),
    refreshInstances: document.getElementById('btn-refresh-instances'),
    refreshAssets: document.getElementById('btn-refresh-assets'),
    refreshAudits: document.getElementById('btn-refresh-audits'),
    refreshRelease: document.getElementById('btn-refresh-release'),
    assertRelease: document.getElementById('btn-assert-release'),
    instanceCreateForm: document.getElementById('instance-create-form'),
    instanceName: document.getElementById('instance-name'),
    instanceCreator: document.getElementById('instance-creator'),
    instanceRoom: document.getElementById('instance-room'),
    instanceActionForm: document.getElementById('instance-action-form'),
    instanceActionId: document.getElementById('instance-action-id'),
    instanceStart: document.getElementById('btn-instance-start'),
    instanceStop: document.getElementById('btn-instance-stop'),
    assetReviewForm: document.getElementById('asset-review-form'),
    reviewReportId: document.getElementById('review-report-id'),
    reviewDecision: document.getElementById('review-decision'),
    reviewOpinion: document.getElementById('review-opinion'),
    assetBindForm: document.getElementById('asset-bind-form'),
    bindTenantId: document.getElementById('bind-tenant-id'),
    bindAssetId: document.getElementById('bind-asset-id'),
    bindAssetType: document.getElementById('bind-asset-type'),
    auditFilterForm: document.getElementById('audit-filter-form'),
    auditType: document.getElementById('audit-type'),
    auditActor: document.getElementById('audit-actor')
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
      li.className = 'pending-row';
      li.innerHTML = `<span>${item.assetType || 'skill'} | ${item.name || item.id} | 状态 ${item.status || '-'}</span>
        <span class="pending-actions">
          <button type="button" data-action="approve" data-report-id="${item.id || ''}">approve</button>
          <button type="button" class="danger" data-action="reject" data-report-id="${item.id || ''}">reject</button>
        </span>`;
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

  async function refreshInstances() {
    const instanceRes = await api('/api/control/instances');
    const instances = instanceRes.data || [];
    el.instanceTotal.textContent = String(instances.length);
    renderInstances(instances);
    return instances;
  }

  async function refreshAssets() {
    const pendingRes = await api('/api/control/assets/reviews/pending');
    const pending = pendingRes.data || [];
    el.pendingTotal.textContent = String(pending.length);
    const sharedRes = await api('/api/control/assets/shared');
    renderAssets(sharedRes.data || [], pending);
    return { pending, shared: sharedRes.data || [] };
  }

  async function refreshAudits(params) {
    const query = new URLSearchParams({ limit: '50' });
    if (params && params.type) query.set('type', params.type);
    if (params && params.actor) query.set('actor', params.actor);
    const auditRes = await api(`/api/control/audits?${query.toString()}`);
    renderAudits(auditRes.data || []);
    return auditRes.data || [];
  }

  async function refreshRelease() {
    const releaseRes = await api('/api/control/release/preflight');
    el.preflightOk.textContent = releaseRes.data && releaseRes.data.ok ? 'passed' : 'failed';
    el.releaseJson.classList.toggle('failed', !(releaseRes.data && releaseRes.data.ok));
    el.releaseFailures.innerHTML = '';
    const failedChecks = (releaseRes.data && releaseRes.data.checks || []).filter(function (x) {
      return x.status === 'failed';
    });
    failedChecks.forEach(function (item) {
      const li = document.createElement('li');
      li.textContent = `${item.name}: ${item.detail}`;
      el.releaseFailures.appendChild(li);
    });
    el.releaseJson.textContent = JSON.stringify(releaseRes.data || {}, null, 2);
    return releaseRes.data || {};
  }

  async function doAssetReview(reportId, decision, opinion) {
    if (!reportId) throw new Error('报告ID不能为空');
    await api(`/api/control/assets/reports/${encodeURIComponent(reportId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        decision: decision,
        reviewer: (state.me && state.me.username) || 'platform_admin',
        opinion: String(opinion || '').trim()
      })
    });
  }

  async function loadDashboard() {
    const statusRes = await api('/status');
    const status = statusRes || {};
    el.healthLevel.textContent = status.healthLevel || 'unknown';
    el.statusSummary.textContent = `failed=${status.failedInstances || 0}, degradedEvents=${status.recentDegradedEvents || 0}`;

    const instances = await refreshInstances();
    const assets = await refreshAssets();
    await refreshAudits();
    await refreshRelease();

    return { instances, pending: assets.pending };
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
      await refreshInstances();
      showToast('实例列表已刷新', 'success');
    });

    el.refreshAssets.addEventListener('click', async function () {
      await refreshAssets();
      showToast('资产列表已刷新', 'success');
    });

    el.refreshAudits.addEventListener('click', async function () {
      await refreshAudits();
      showToast('审计日志已刷新', 'success');
    });

    el.refreshRelease.addEventListener('click', async function () {
      await refreshRelease();
      showToast('发布预检已刷新', 'success');
    });

    el.assertRelease.addEventListener('click', async function () {
      try {
        const result = await api('/api/control/release/preflight/assert', { method: 'POST', body: '{}' });
        el.preflightOk.textContent = result.data && result.data.ok ? 'passed' : 'failed';
        await refreshRelease();
        showToast('发布预检 assert 通过', 'success');
      } catch (error) {
        await refreshRelease().catch(function () {});
        showToast(`发布预检 assert 失败: ${error.message}`, 'error');
      }
    });

    el.instanceCreateForm.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      try {
        await api('/api/control/instances', {
          method: 'POST',
          body: JSON.stringify({
            name: el.instanceName.value.trim(),
            creator: el.instanceCreator.value.trim() || (state.me && state.me.username) || 'admin-ui',
            matrixRoomId: el.instanceRoom.value.trim() || null
          })
        });
        await refreshInstances();
        showToast('实例创建成功', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.instanceStart.addEventListener('click', async function () {
      try {
        const id = el.instanceActionId.value.trim();
        if (!id) throw new Error('请输入实例ID');
        await api(`/api/control/instances/${encodeURIComponent(id)}/start`, { method: 'POST', body: '{}' });
        await refreshInstances();
        showToast('实例已启动', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.instanceStop.addEventListener('click', async function () {
      try {
        const id = el.instanceActionId.value.trim();
        if (!id) throw new Error('请输入实例ID');
        await api(`/api/control/instances/${encodeURIComponent(id)}/stop`, { method: 'POST', body: '{}' });
        await refreshInstances();
        showToast('实例已停止', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.assetReviewForm.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      try {
        const reportId = el.reviewReportId.value.trim();
        if (!reportId) throw new Error('请输入报告ID');
        await api(`/api/control/assets/reports/${encodeURIComponent(reportId)}/reviews`, {
          method: 'POST',
          body: JSON.stringify({
            decision: el.reviewDecision.value,
            reviewer: (state.me && state.me.username) || 'platform_admin',
            opinion: el.reviewOpinion.value.trim()
          })
        });
        await refreshAssets();
        showToast('审核提交成功', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.assetBindForm.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      try {
        await api('/api/control/assets/bindings', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: el.bindTenantId.value.trim(),
            assetId: el.bindAssetId.value.trim(),
            assetType: el.bindAssetType.value,
            actor: (state.me && state.me.username) || 'platform_admin'
          })
        });
        showToast('资产绑定成功', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.auditFilterForm.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      try {
        await refreshAudits({
          type: el.auditType.value.trim(),
          actor: el.auditActor.value.trim()
        });
        showToast('审计查询完成', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.pendingAssets.addEventListener('click', async function (evt) {
      const btn = evt.target && evt.target.closest ? evt.target.closest('button[data-action]') : null;
      if (!btn) return;
      const decision = btn.getAttribute('data-action');
      const reportId = btn.getAttribute('data-report-id');
      if (!decision || !reportId) return;
      try {
        const opinion = decision === 'reject' ? 'rejected by admin-ui quick action' : 'approved by admin-ui quick action';
        await doAssetReview(reportId, decision, opinion);
        await refreshAssets();
        showToast(`已${decision} ${reportId}`, 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  bindEvents();
  bootstrapFromToken();
})();
