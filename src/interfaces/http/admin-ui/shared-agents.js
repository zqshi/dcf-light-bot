async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body.error || body.message || 'request failed'));
  return body;
}

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value == null ? '' : value);
}

function value(id) {
  const node = document.getElementById(id);
  return node ? String(node.value || '').trim() : '';
}

function setStatus(message, isError = false) {
  const node = document.getElementById('sharedAgentStatus');
  if (!node) return;
  node.textContent = String(message || '');
  node.style.color = isError ? '#932727' : '#5e6f8e';
}

function queryPath() {
  const params = new URLSearchParams();
  const keyword = value('sharedAgentKeyword');
  const status = value('sharedAgentStatusFilter');
  if (keyword) params.set('keyword', keyword);
  if (status) params.set('status', status);
  const q = params.toString();
  return q ? `/api/admin/agents/shared?${q}` : '/api/admin/agents/shared';
}

function renderRows(rows = []) {
  const body = document.getElementById('sharedAgentRows');
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty">暂无共享Agent</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row) => `
    <tr>
      <td><span class="mono">${escapeHtml(row.id || '-')}</span></td>
      <td>${escapeHtml(row.name || '-')}</td>
      <td><span class="mono">${escapeHtml(row.capabilitySignature || '-')}</span></td>
      <td>${escapeHtml(row.ownerEmployeeId || '共享')}</td>
      <td>${escapeHtml(row.spawnedBy || '-')}</td>
      <td>${escapeHtml(row.source || '-')}</td>
      <td>${escapeHtml((Array.isArray(row.tags) ? row.tags : []).join(', ') || '-')}</td>
      <td>${Number(row.usageCount) || 0}</td>
      <td><span class="badge ${String(row.status) === 'active' ? 'ok' : ''}">${escapeHtml(row.status || '-')}</span></td>
    </tr>
  `).join('');
}

async function loadSharedAgents() {
  const out = await api(queryPath());
  const rows = Array.isArray(out && out.rows)
    ? out.rows
    : (Array.isArray(out) ? out : []);
  const summary = (out && out.summary && typeof out.summary === 'object')
    ? out.summary
    : { total: rows.length };
  text('agentTotal', Number(summary.total) || 0);
  text('agentActive', Number(summary.active) || 0);
  text('agentPaused', Number(summary.paused) || 0);
  text('agentShared', Number(summary.shared) || 0);
  renderRows(rows);
  if (typeof window.__refreshGlobalTablePagination === 'function') {
    window.__refreshGlobalTablePagination();
  }
}

function bindEvents() {
  const reloadBtn = document.getElementById('reloadSharedAgentsBtn');
  if (reloadBtn) reloadBtn.onclick = () => loadSharedAgents().catch((error) => setStatus(error.message, true));

  ['sharedAgentKeyword', 'sharedAgentStatusFilter'].forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener('change', () => loadSharedAgents().catch((error) => setStatus(error.message, true)));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      loadSharedAgents().catch((error) => setStatus(error.message, true));
    });
  });
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    bindEvents();
    await loadSharedAgents();
    setStatus('数据已加载（只读运营视图，来源：runtime/openclaw）');
  } catch (error) {
    setStatus(error && error.message ? error.message : '加载失败', true);
  }
})();
