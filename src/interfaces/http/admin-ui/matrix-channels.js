async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

let channels = [];

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

function showStatus(message, isError = false) {
  const node = getNode('channelStatusText');
  if (!node) return;
  node.textContent = String(message || '').trim();
  node.style.color = isError ? '#932727' : '#5e6f8e';
}

function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function renderRows(rows = []) {
  const tbody = getNode('channelRows');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无渠道数据</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const stateTone = ['running', 'active'].includes(String(row.instanceState || '').toLowerCase()) ? 'ok' : '';
    return `
      <tr>
        <td><span class="mono">${escapeHtml(row.roomId || '-')}</span></td>
        <td>${row.bound ? escapeHtml(row.instanceName || row.boundInstanceId || '-') : '<span class="badge">未映射</span>'}</td>
        <td>${escapeHtml(row.tenantId || '-')}</td>
        <td><span class="badge ${stateTone}">${escapeHtml(row.instanceState || '-')}</span></td>
        <td>${Number(row.auditEvents24h || 0)}</td>
        <td>${escapeHtml(formatTime(row.lastEventAt))}</td>
      </tr>
    `;
  }).join('');
}

function readFilters() {
  return {
    keyword: String((getNode('channelKeyword') && getNode('channelKeyword').value) || '').trim(),
    status: String((getNode('channelStatus') && getNode('channelStatus').value) || '').trim()
  };
}

function buildListUrl() {
  const filters = readFilters();
  const params = new URLSearchParams();
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();
  return query ? `/api/admin/matrix/channels?${query}` : '/api/admin/matrix/channels';
}

async function loadChannels() {
  const out = await api(buildListUrl());
  channels = Array.isArray(out && out.rows) ? out.rows : [];
  const summary = out && out.summary ? out.summary : {};
  const status = out && out.status ? out.status : {};
  setText('channelCount', Number(summary.channels || channels.length || 0));
  setText('boundCount', Number(summary.bound || 0));
  setText('unboundCount', Number(summary.unbound || 0));
  setText('events24h', Number(summary.auditEvents24h || 0));
  setText('botOnline', status.botOnline ? 'online' : 'offline');
  setText('deliveryRate', `${Math.max(0, Number(status.deliverySuccessRate24h || 0))}%`);
  const stateHint = [
    `relay=${status.relayOnline ? 'online' : 'offline'}`,
    `inbound24h=${Number(status.inbound24h || 0)}`,
    `delivery_ok=${Number(status.deliverySucceeded24h || 0)}`,
    `delivery_fail=${Number(status.deliveryFailed24h || 0)}`,
    `cmd_ok=${Number(status.commandSucceeded24h || 0)}`,
    `cmd_fail=${Number(status.commandFailed24h || 0)}`
  ].join(' | ');
  showStatus(stateHint);
  renderRows(channels);
}

function bindEvents() {
  const keyword = getNode('channelKeyword');
  const status = getNode('channelStatus');

  if (keyword) {
    keyword.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      loadChannels().catch((error) => showStatus(`加载失败：${error.message}`, true));
    });
  }
  if (status) {
    status.addEventListener('change', () => {
      loadChannels().catch((error) => showStatus(`加载失败：${error.message}`, true));
    });
  }
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    bindEvents();
    await loadChannels();
    setInterval(() => {
      loadChannels().catch(() => {});
    }, 4000);
  } catch (error) {
    showStatus(`初始化失败：${error.message}`, true);
  }
})();
