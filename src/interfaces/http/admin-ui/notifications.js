async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

function getNode(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = getNode(id);
  if (node) node.textContent = String(value);
}

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function showStatus(message, isError = false) {
  const node = getNode('noticeStatus');
  if (!node) return;
  node.textContent = String(message || '').trim();
  node.style.color = isError ? '#932727' : '#5e6f8e';
}

function severityClass(level) {
  const value = String(level || '').toLowerCase();
  if (value === 'high') return 'warn';
  if (value === 'medium') return '';
  return 'ok';
}

function renderRows(items = []) {
  const tbody = getNode('noticeRows');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无待处置事项</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td><span class="badge ${severityClass(item.severity)}">${escapeHtml(item.severity || '-')}</span></td>
      <td>${escapeHtml(item.source || '-')}</td>
      <td>${escapeHtml(item.title || '-')}</td>
      <td>${escapeHtml(item.detail || '-')}</td>
      <td><span class="mono">${escapeHtml(item.action || '-')}</span></td>
      <td>${escapeHtml(formatTime(item.at))}</td>
    </tr>
  `).join('');
}

async function load() {
  const out = await api('/api/admin/notifications');
  const items = Array.isArray(out && out.items) ? out.items : [];
  const summary = out && out.summary ? out.summary : {};
  setText('noticeTotal', Number(summary.total || items.length || 0));
  setText('noticeHigh', Number(summary.high || 0));
  setText('noticeMedium', Number(summary.medium || 0));
  setText('noticeLow', Number(summary.low || 0));
  renderRows(items);
  showStatus(`已刷新：${new Date().toLocaleTimeString()}`);
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    await load();
    setInterval(() => {
      load().catch(() => {});
    }, 5000);
  } catch (error) {
    showStatus(`加载失败：${String(error && error.message ? error.message : 'unknown')}`, true);
    renderRows([]);
  }
})();
