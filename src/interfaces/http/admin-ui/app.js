/* global document, localStorage */
(function () {
  const state = {
    token: localStorage.getItem('dcf_admin_token') || '',
    me: null,
    auditQuery: {
      type: '',
      actor: '',
      cursor: '0',
      nextCursor: null,
      hasMore: false,
      history: []
    }
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
    instanceDetail: document.getElementById('instance-detail'),
    instanceDetailJson: document.getElementById('instance-detail-json'),
    closeInstanceDetail: document.getElementById('btn-close-instance-detail'),
    sharedAssets: document.getElementById('shared-assets'),
    pendingAssets: document.getElementById('pending-assets'),
    inlineBindTenantId: document.getElementById('inline-bind-tenant-id'),
    auditList: document.getElementById('audit-list'),
    auditPageInfo: document.getElementById('audit-page-info'),
    releaseJson: document.getElementById('release-json'),
    releaseFailures: document.getElementById('release-failures'),
    refreshInstances: document.getElementById('btn-refresh-instances'),
    refreshAssets: document.getElementById('btn-refresh-assets'),
    refreshAudits: document.getElementById('btn-refresh-audits'),
    auditPrev: document.getElementById('btn-audit-prev'),
    auditNext: document.getElementById('btn-audit-next'),
    auditExport: document.getElementById('btn-audit-export'),
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
      tr.innerHTML = `<td>${item.id || '-'}</td><td>${item.tenantId || '-'}</td><td>${item.state || '-'}</td><td>${item.runtimeVersion || '-'}</td><td>${item.updatedAt || '-'}</td>
      <td>
        <button type="button" class="ghost row-action" data-instance-detail="1" data-instance-id="${item.id || ''}">详情</button>
        <button type="button" class="ghost row-action" data-instance-action="start" data-instance-id="${item.id || ''}">启动</button>
        <button type="button" class="ghost row-action" data-instance-action="stop" data-instance-id="${item.id || ''}">停止</button>
      </td>`;
      el.instancesTable.appendChild(tr);
    });
  }

  function renderAssets(sharedRows, pendingRows) {
    el.sharedAssets.innerHTML = '';
    (sharedRows || []).slice(0, 20).forEach(function (item) {
      const li = document.createElement('li');
      li.className = 'shared-row';
      li.innerHTML = `<span>${item.assetType || 'skill'} | ${item.name || item.id} | by ${item.ownerTenantId || '-'}</span>
      <span class="shared-actions">
        <button type="button" class="ghost" data-shared-bind="1" data-asset-id="${item.id || ''}" data-asset-type="${item.assetType || 'skill'}">绑定到租户</button>
      </span>`;
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
    const merged = Object.assign({}, state.auditQuery, params || {});
    const query = new URLSearchParams({ limit: '50', cursor: String(merged.cursor || '0') });
    if (merged.type) query.set('type', merged.type);
    if (merged.actor) query.set('actor', merged.actor);
    const auditRes = await api(`/api/control/audits?${query.toString()}`);
    const rows = auditRes.data || [];
    renderAudits(rows);
    state.auditQuery = {
      type: String(merged.type || ''),
      actor: String(merged.actor || ''),
      cursor: String(auditRes.cursor || merged.cursor || '0'),
      nextCursor: auditRes.nextCursor || null,
      hasMore: Boolean(auditRes.hasMore),
      history: Array.isArray(merged.history) ? merged.history : state.auditQuery.history
    };
    el.auditPageInfo.textContent = `cursor=${state.auditQuery.cursor} next=${state.auditQuery.nextCursor || '-'} hasMore=${state.auditQuery.hasMore}`;
    return rows;
  }

  async function exportAuditsNdjson() {
    const query = new URLSearchParams({ format: 'ndjson', limit: '5000', cursor: String(state.auditQuery.cursor || '0') });
    if (state.auditQuery.type) query.set('type', state.auditQuery.type);
    if (state.auditQuery.actor) query.set('actor', state.auditQuery.actor);
    const headers = {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`/api/control/audits/export?${query.toString()}`, { method: 'GET', headers: headers });
    if (!response.ok) {
      throw new Error(`导出失败: ${response.status}`);
    }
    const text = await response.text();
    const blob = new Blob([text], { type: 'application/x-ndjson;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `dcf-audits-${ts}.ndjson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function runInstanceAction(id, action) {
    if (!id) throw new Error('请输入实例ID');
    await api(`/api/control/instances/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
  }

  async function showInstanceDetail(id) {
    if (!id) throw new Error('实例ID不能为空');
    const res = await api(`/api/control/instances/${encodeURIComponent(id)}`);
    el.instanceDetailJson.textContent = JSON.stringify(res.data || {}, null, 2);
    el.instanceDetail.classList.remove('hidden');
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

    el.closeInstanceDetail.addEventListener('click', function () {
      el.instanceDetail.classList.add('hidden');
      el.instanceDetailJson.textContent = '';
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
        await runInstanceAction(id, 'start');
        await refreshInstances();
        showToast('实例已启动', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.instanceStop.addEventListener('click', async function () {
      try {
        const id = el.instanceActionId.value.trim();
        await runInstanceAction(id, 'stop');
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
        state.auditQuery.history = [];
        await refreshAudits({
          cursor: '0',
          type: el.auditType.value.trim(),
          actor: el.auditActor.value.trim()
        });
        showToast('审计查询完成', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.auditNext.addEventListener('click', async function () {
      try {
        if (!state.auditQuery.hasMore || !state.auditQuery.nextCursor) {
          showToast('没有下一页', 'error');
          return;
        }
        state.auditQuery.history = state.auditQuery.history.concat([state.auditQuery.cursor]);
        await refreshAudits({ cursor: state.auditQuery.nextCursor, history: state.auditQuery.history });
        showToast('已切换到下一页', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.auditPrev.addEventListener('click', async function () {
      try {
        const history = state.auditQuery.history.slice();
        if (!history.length) {
          showToast('已经是第一页', 'error');
          return;
        }
        const prevCursor = history.pop();
        await refreshAudits({ cursor: prevCursor, history: history });
        showToast('已返回上一页', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.auditExport.addEventListener('click', async function () {
      try {
        await exportAuditsNdjson();
        showToast('审计导出已开始', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    el.instancesTable.addEventListener('click', async function (evt) {
      const btn = evt.target && evt.target.closest ? evt.target.closest('button[data-instance-action]') : null;
      const detailBtn = evt.target && evt.target.closest ? evt.target.closest('button[data-instance-detail]') : null;
      if (btn) {
        const action = btn.getAttribute('data-instance-action');
        const id = btn.getAttribute('data-instance-id');
        if (!action || !id) return;
        try {
          await runInstanceAction(id, action);
          await refreshInstances();
          showToast(`实例 ${id} 已${action === 'start' ? '启动' : '停止'}`, 'success');
        } catch (error) {
          showToast(error.message, 'error');
        }
        return;
      }
      if (detailBtn) {
        const id = detailBtn.getAttribute('data-instance-id');
        if (!id) return;
        try {
          await showInstanceDetail(id);
          showToast(`已加载实例 ${id} 详情`, 'success');
        } catch (error) {
          showToast(error.message, 'error');
        }
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

    el.sharedAssets.addEventListener('click', async function (evt) {
      const btn = evt.target && evt.target.closest ? evt.target.closest('button[data-shared-bind]') : null;
      if (!btn) return;
      const tenantId = (el.inlineBindTenantId.value || '').trim();
      if (!tenantId) {
        showToast('请先填写目标租户ID', 'error');
        return;
      }
      const assetId = btn.getAttribute('data-asset-id');
      const assetType = btn.getAttribute('data-asset-type') || 'skill';
      if (!assetId) return;
      try {
        await api('/api/control/assets/bindings', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenantId,
            assetId: assetId,
            assetType: assetType,
            actor: (state.me && state.me.username) || 'platform_admin'
          })
        });
        showToast(`已绑定 ${assetId} 到 ${tenantId}`, 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  bindEvents();
  bootstrapFromToken();
})();
