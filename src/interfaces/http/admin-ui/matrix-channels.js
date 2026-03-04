async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

let channels = [];
let instances = [];

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

function canWrite() {
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

function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function renderInstanceSelect(selectId, selected = '') {
  const node = getNode(selectId);
  if (!node) return;
  const current = String(selected || '');
  node.innerHTML = [
    '<option value="">选择实例</option>',
    ...instances.map((item) => {
      const id = String(item.id || '');
      const label = [item.name || item.id, item.tenantId].filter(Boolean).join(' / ');
      return `<option value="${escapeHtml(id)}">${escapeHtml(label || id)}</option>`;
    })
  ].join('');
  node.value = current;
}

function renderRows(rows = []) {
  const tbody = getNode('channelRows');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无渠道数据</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, index) => {
    const selectId = `bindInstance-${index}`;
    const stateTone = ['running', 'active'].includes(String(row.instanceState || '').toLowerCase()) ? 'ok' : '';
    return `
      <tr>
        <td><span class="mono">${escapeHtml(row.roomId || '-')}</span></td>
        <td>${row.bound ? escapeHtml(row.instanceName || row.boundInstanceId || '-') : '<span class="badge">未绑定</span>'}</td>
        <td>${escapeHtml(row.tenantId || '-')}</td>
        <td><span class="badge ${stateTone}">${escapeHtml(row.instanceState || '-')}</span></td>
        <td>${Number(row.auditEvents24h || 0)}</td>
        <td>${escapeHtml(formatTime(row.lastEventAt))}</td>
        <td>
          <div class="row-actions">
            <select class="admin-select" id="${selectId}"></select>
            <button type="button" data-action="bind" data-room-id="${escapeHtml(row.roomId || '')}" data-select-id="${selectId}" data-required-permission="admin.employees.write">绑定</button>
            <button type="button" data-action="unbind" data-room-id="${escapeHtml(row.roomId || '')}" data-required-permission="admin.employees.write" ${row.bound ? '' : 'disabled'}>解绑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  rows.forEach((row, index) => {
    renderInstanceSelect(`bindInstance-${index}`, row.boundInstanceId || '');
  });
  applyActionAcl(tbody);
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

async function loadInstances() {
  try {
    const rows = await api('/api/admin/instances');
    instances = Array.isArray(rows) ? rows : [];
  } catch {
    instances = [];
  }
  renderInstanceSelect('newInstanceId', '');
}

async function loadChannels() {
  const out = await api(buildListUrl());
  channels = Array.isArray(out && out.rows) ? out.rows : [];
  const summary = out && out.summary ? out.summary : {};
  setText('channelCount', Number(summary.channels || channels.length || 0));
  setText('boundCount', Number(summary.bound || 0));
  setText('unboundCount', Number(summary.unbound || 0));
  setText('events24h', Number(summary.auditEvents24h || 0));
  renderRows(channels);
}

async function bindRoom(roomId, instanceId) {
  const rid = String(roomId || '').trim();
  const iid = String(instanceId || '').trim();
  if (!rid || !iid) throw new Error('roomId 和 instanceId 不能为空');
  await api(`/api/admin/matrix/channels/${encodeURIComponent(rid)}/bind-instance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceId: iid })
  });
}

async function unbindRoom(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) throw new Error('roomId 不能为空');
  await api(`/api/admin/matrix/channels/${encodeURIComponent(rid)}/unbind`, { method: 'POST' });
}

function bindEvents() {
  const tbody = getNode('channelRows');
  const keyword = getNode('channelKeyword');
  const status = getNode('channelStatus');
  const bindNewBtn = getNode('bindNewChannelBtn');

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

  if (bindNewBtn) {
    bindNewBtn.disabled = !canWrite();
    bindNewBtn.addEventListener('click', async () => {
      if (!canWrite()) return;
      const roomId = String((getNode('newRoomId') && getNode('newRoomId').value) || '').trim();
      const instanceId = String((getNode('newInstanceId') && getNode('newInstanceId').value) || '').trim();
      try {
        await bindRoom(roomId, instanceId);
        showStatus(`已绑定房间 ${roomId} -> ${instanceId}`);
        await loadChannels();
      } catch (error) {
        showStatus(`绑定失败：${error.message}`, true);
      }
    });
  }

  if (tbody) {
    tbody.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button[data-action][data-room-id]');
      if (!button) return;
      const action = String(button.getAttribute('data-action') || '').trim();
      const roomId = String(button.getAttribute('data-room-id') || '').trim();
      if (!roomId || !canWrite()) return;
      try {
        button.disabled = true;
        if (action === 'bind') {
          const selectId = String(button.getAttribute('data-select-id') || '').trim();
          const select = selectId ? getNode(selectId) : null;
          const instanceId = String((select && select.value) || '').trim();
          await bindRoom(roomId, instanceId);
          showStatus(`已绑定房间 ${roomId} -> ${instanceId}`);
        } else if (action === 'unbind') {
          await unbindRoom(roomId);
          showStatus(`已解绑房间 ${roomId}`);
        }
        await loadChannels();
      } catch (error) {
        showStatus(`操作失败：${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    });
  }
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    bindEvents();
    await loadInstances();
    await loadChannels();
    setInterval(() => {
      loadChannels().catch(() => {});
    }, 4000);
  } catch (error) {
    showStatus(`初始化失败：${error.message}`, true);
  }
})();
