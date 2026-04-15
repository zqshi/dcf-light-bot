(function () {
  'use strict';

  const { apiFetch } = window.__platformAuth;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function typeBadge(type) {
    const cls = /error|fail/i.test(type) ? 'fail'
      : /warn|suspend/i.test(type) ? 'warn'
      : 'info';
    return `<span class="badge ${cls}">${esc(type)}</span>`;
  }

  async function loadAuditLogs() {
    const res = await apiFetch('/api/control/audits?limit=200');
    const data = await res.json();
    const rows = data.data || data || [];
    const body = document.getElementById('auditBody');

    document.getElementById('auditCount').textContent = rows.length;

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty">暂无审计日志</td></tr>';
      return;
    }
    body.innerHTML = rows.slice(0, 200).map((row) => {
      const payload = row.payload || {};
      const actor = esc(payload.actor || payload.username || '-');
      const details = esc(JSON.stringify(payload).slice(0, 140));
      const time = row.at ? new Date(row.at).toLocaleString('zh-CN') : '-';
      return `<tr>
        <td style="white-space:nowrap;">${time}</td>
        <td>${typeBadge(row.type)}</td>
        <td>${actor}</td>
        <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${details}">${details}</td>
      </tr>`;
    }).join('');
  }

  async function init() {
    await window.__platformReady;
    await loadAuditLogs();
  }

  init();
})();
