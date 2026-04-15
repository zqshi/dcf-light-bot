(function () {
  'use strict';

  const { apiFetch } = window.__platformAuth;

  const PLAN_LABELS = { free: '免费版', standard: '标准版', enterprise: '企业版' };
  const HEALTH_LABELS = { healthy: '健康', degraded: '降级', critical: '异常' };

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function healthBadge(level) {
    const cls = level === 'healthy' ? 'ok' : level === 'degraded' ? 'warn' : 'fail';
    return `<span class="badge ${cls}">${HEALTH_LABELS[level] || level}</span>`;
  }

  function fmtNum(n) { return n == null ? '-' : Number(n).toLocaleString('zh-CN'); }

  function fmtCpu(millis) {
    if (millis >= 1000) return (millis / 1000).toFixed(1) + ' 核';
    return millis + 'm';
  }

  function fmtMem(mb) {
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
    return mb + ' MB';
  }

  function utilBar(pct) {
    const p = Math.min(100, Math.max(0, pct));
    const cls = p >= 90 ? 'danger' : p >= 70 ? 'warn' : 'ok';
    return `<div class="util-cell">
      <div class="util-bar"><div class="util-bar-fill ${cls}" style="width:${p}%"></div></div>
      <span class="util-text">${p}%</span>
    </div>`;
  }

  function resCard(label, value, sub) {
    return `<div class="mon-res-card">
      <span class="mon-res-label">${esc(label)}</span>
      <span class="mon-res-value">${esc(String(value))}</span>
      ${sub ? `<span class="mon-res-sub">${esc(sub)}</span>` : ''}
    </div>`;
  }

  /* ── Platform overview ── */
  async function loadOverview() {
    const res = await apiFetch('/api/platform/monitoring/overview');
    const { data } = await res.json();

    document.getElementById('statTenants').textContent = data.tenants.total;
    document.getElementById('statInstances').textContent = data.instances.total;
    document.getElementById('statRunning').textContent = data.instances.running;
    document.getElementById('statHealth').innerHTML = healthBadge(data.healthLevel);

    const r = data.resources || {};
    const grid = document.getElementById('resourceOverview');
    grid.innerHTML = [
      resCard('活跃租户', data.tenants.active, `已暂停 ${data.tenants.suspended}`),
      resCard('运行中实例', data.instances.running, `总计 ${data.instances.total}`),
      resCard('异常实例', data.instances.failed, data.instances.failed > 0 ? '需要关注' : '全部正常'),
      resCard('已分配 CPU', fmtCpu(r.allocatedCpuMillis || 0), '所有运行中实例'),
      resCard('已分配内存', fmtMem(r.allocatedMemoryMB || 0), '所有运行中实例'),
      resCard('已停止实例', data.instances.stopped, '可回收资源')
    ].join('');
  }

  /* ── Per-tenant quota utilization ── */
  async function loadResources() {
    const res = await apiFetch('/api/platform/monitoring/resources');
    const { data } = await res.json();
    const body = document.getElementById('quotaBody');

    if (!data.tenantResources || !data.tenantResources.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">暂无租户数据</td></tr>';
      return;
    }

    body.innerHTML = data.tenantResources.map((t) => {
      const q = t.quotas || {};
      const u = t.utilization || {};
      const a = t.allocated || {};
      const statusCls = t.status === 'active' ? 'ok' : t.status === 'suspended' ? 'warn' : 'fail';

      return `<tr>
        <td>
          <strong>${esc(t.tenantName)}</strong>
          <div style="font-size:11px;color:var(--text-soft);">${esc(t.slug)}</div>
        </td>
        <td>${esc(PLAN_LABELS[t.plan] || t.plan)}</td>
        <td>
          <div style="font-size:13px;font-weight:600;">${t.instances.total} / ${q.maxInstances || '-'}</div>
          ${utilBar(u.instances)}
        </td>
        <td>
          <div style="font-size:13px;font-weight:600;">${t.instances.running} / ${q.maxConcurrentInstances || '-'}</div>
          ${utilBar(u.concurrent)}
        </td>
        <td>
          <div style="font-size:13px;font-weight:600;">${fmtCpu(a.cpuMillis || 0)}</div>
          ${utilBar(u.cpu)}
          <span style="font-size:10px;color:var(--text-soft);">单实例 ${esc(q.instanceCpu || '-')}</span>
        </td>
        <td>
          <div style="font-size:13px;font-weight:600;">${fmtMem(a.memoryMB || 0)}</div>
          ${utilBar(u.memory)}
          <span style="font-size:10px;color:var(--text-soft);">单实例 ${esc(q.instanceMemory || '-')}</span>
        </td>
        <td>
          <div class="quota-mini">
            <span class="quota-chip">${fmtNum(q.tokenBudgetMonthly)} Token/月</span>
            <span class="quota-chip">${fmtNum(q.rateLimitPerMinute)} 次/分</span>
          </div>
        </td>
        <td><span class="badge ${statusCls}">${esc(t.status === 'active' ? '活跃' : t.status === 'suspended' ? '已暂停' : t.status)}</span></td>
      </tr>`;
    }).join('');
  }

  /* ── Health table ── */
  async function loadHealth() {
    const res = await apiFetch('/api/platform/monitoring/health');
    const { data } = await res.json();
    const body = document.getElementById('healthBody');

    if (!data.tenantHealth || !data.tenantHealth.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">暂无实例运行数据</td></tr>';
      return;
    }

    body.innerHTML = data.tenantHealth.map((t) => `
      <tr>
        <td><strong>${esc(t.tenantName || t.tenantId)}</strong></td>
        <td>${t.total}</td>
        <td>${t.running}</td>
        <td style="${t.failed > 0 ? 'color:#ef4444;font-weight:700;' : ''}">${t.failed}</td>
        <td>${healthBadge(t.health)}</td>
      </tr>
    `).join('');
  }

  /* ── Init ── */
  async function init() {
    await window.__platformReady;
    await Promise.all([loadOverview(), loadResources(), loadHealth()]);
  }

  init();
})();
