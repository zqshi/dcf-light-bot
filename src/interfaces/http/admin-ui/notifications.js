async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

function getNode(id) { return document.getElementById(id); }
function setText(id, value) { const n = getNode(id); if (n) n.textContent = String(value); }
function escapeHtml(input) {
  return String(input || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}
function showStatus(message, isError = false) {
  const n = getNode('noticeStatus');
  if (!n) return;
  n.textContent = String(message || '').trim();
  n.style.color = isError ? '#932727' : '#5e6f8e';
}
function severityClass(level) {
  const v = String(level || '').toLowerCase();
  if (v === 'high') return 'warn';
  if (v === 'medium') return '';
  return 'ok';
}

// ── State persistence ──
function noticeKey(item) {
  return `${item.source || ''}|${item.title || ''}|${item.detail || ''}`;
}

function loadDismissed() {
  try { return JSON.parse(localStorage.getItem('dcf.admin.notifications.dismissed') || '{}'); } catch { return {}; }
}
function saveDismissed(map) {
  try { localStorage.setItem('dcf.admin.notifications.dismissed', JSON.stringify(map)); } catch {}
}
function loadSnoozed() {
  try { return JSON.parse(localStorage.getItem('dcf.admin.notifications.snoozed') || '{}'); } catch { return {}; }
}
function saveSnoozed(map) {
  try { localStorage.setItem('dcf.admin.notifications.snoozed', JSON.stringify(map)); } catch {}
}

function dismissNotice(key) {
  const d = loadDismissed();
  d[key] = { status: 'dismissed', at: new Date().toISOString() };
  saveDismissed(d);
  load();
}
function escalateNotice(key) {
  const d = loadDismissed();
  d[key] = { status: 'escalated', at: new Date().toISOString() };
  saveDismissed(d);
  load();
}
function snoozeNotice(key, hours) {
  const s = loadSnoozed();
  s[key] = Date.now() + hours * 3600 * 1000;
  saveSnoozed(s);
  load();
}
function restoreNotice(key) {
  const d = loadDismissed();
  delete d[key];
  saveDismissed(d);
  const s = loadSnoozed();
  delete s[key];
  saveSnoozed(s);
  load();
}

// Clean expired snoozes
function cleanSnoozed() {
  const s = loadSnoozed();
  const now = Date.now();
  let changed = false;
  for (const [k, expiry] of Object.entries(s)) {
    if (expiry <= now) { delete s[k]; changed = true; }
  }
  if (changed) saveSnoozed(s);
  return s;
}

function renderRows(items = []) {
  const tbody = getNode('noticeRows');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无待处置事项</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item) => {
    const key = escapeHtml(noticeKey(item));
    return `
    <tr>
      <td><span class="badge ${severityClass(item.severity)}">${escapeHtml(item.severity || '-')}</span></td>
      <td>${escapeHtml(item.source || '-')}</td>
      <td>${escapeHtml(item.title || '-')}</td>
      <td>${escapeHtml(item.detail || '-')}</td>
      <td><span class="mono">${escapeHtml(item.action || '-')}</span></td>
      <td>${escapeHtml(formatTime(item.at))}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button onclick="dismissNotice('${key}')" style="font-size:11px;padding:3px 8px;border:1px solid #e5e5ea;border-radius:5px;background:#fff;cursor:pointer;color:#248a3d" title="确认处理">确认</button>
          <select onchange="if(this.value){snoozeNotice('${key}',Number(this.value));this.value='';}" style="font-size:11px;padding:3px 6px;border:1px solid #e5e5ea;border-radius:5px;background:#fff;cursor:pointer;color:#5e6f8e">
            <option value="">延后</option>
            <option value="1">1h</option>
            <option value="4">4h</option>
            <option value="24">24h</option>
          </select>
          <button onclick="escalateNotice('${key}')" style="font-size:11px;padding:3px 8px;border:1px solid rgba(255,59,48,0.3);border-radius:5px;background:#fff;cursor:pointer;color:#d70015" title="升级处理">升级</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderDismissed() {
  const dismissed = loadDismissed();
  const entries = Object.entries(dismissed);
  setText('dismissedCount', entries.length);
  const tbody = getNode('dismissedRows');
  if (!tbody) return;
  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无已处理通知</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(([key, info]) => {
    const parts = key.split('|');
    const source = parts[0] || '-';
    const title = parts[1] || '-';
    const statusLabel = info.status === 'escalated' ? '已升级' : '已确认';
    const statusStyle = info.status === 'escalated' ? 'color:#d70015' : 'color:#248a3d';
    const safeKey = escapeHtml(key);
    return `
    <tr>
      <td>-</td>
      <td>${escapeHtml(source)}</td>
      <td>${escapeHtml(title)}</td>
      <td><span style="${statusStyle};font-weight:600;font-size:12px">${statusLabel}</span></td>
      <td><button onclick="restoreNotice('${safeKey}')" style="font-size:11px;padding:3px 8px;border:1px solid #e5e5ea;border-radius:5px;background:#fff;cursor:pointer">恢复</button></td>
    </tr>`;
  }).join('');
}

async function load() {
  const out = await api('/api/admin/notifications');
  const allItems = Array.isArray(out && out.items) ? out.items : [];

  const dismissed = loadDismissed();
  const snoozed = cleanSnoozed();

  // Filter out dismissed and snoozed items
  const items = allItems.filter(item => {
    const key = noticeKey(item);
    if (dismissed[key]) return false;
    if (snoozed[key] && snoozed[key] > Date.now()) return false;
    return true;
  });

  setText('noticeTotal', Number(items.length));
  setText('noticeHigh', items.filter(i => String(i.severity).toLowerCase() === 'high').length);
  setText('noticeMedium', items.filter(i => String(i.severity).toLowerCase() === 'medium').length);
  setText('noticeLow', items.filter(i => !['high', 'medium'].includes(String(i.severity).toLowerCase())).length);

  renderRows(items);
  renderDismissed();
  showStatus(`已刷新：${new Date().toLocaleTimeString()}`);
}

// ── Push Channels ──
const TYPE_LABELS = { webhook: 'Webhook', dingtalk: '钉钉', wecom: '企微', slack: 'Slack', email: 'Email' };

async function loadPushChannels() {
  const out = await api('/api/admin/push-channels');
  const items = Array.isArray(out && out.items) ? out.items : [];
  const tbody = getNode('channelRows');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无推送渠道</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((ch) => {
    const enabledBadge = ch.enabled
      ? '<span style="color:#248a3d;font-weight:600">启用</span>'
      : '<span style="color:#8e8e93">禁用</span>';
    const levelTags = (ch.levels || []).map((l) =>
      `<span class="badge" style="font-size:11px;margin-right:2px">${escapeHtml(l)}</span>`
    ).join('');
    return `<tr>
      <td>${escapeHtml(ch.name)}</td>
      <td>${escapeHtml(TYPE_LABELS[ch.type] || ch.type)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(ch.url)}">${escapeHtml(ch.url)}</td>
      <td>${enabledBadge}</td>
      <td>${levelTags || '-'}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button onclick="testPushChannel('${escapeHtml(ch.id)}')" style="font-size:11px;padding:3px 8px;border:1px solid #e5e5ea;border-radius:5px;background:#fff;cursor:pointer;color:#007AFF">测试</button>
          <button onclick="openPushChannelForm(channelCache['${escapeHtml(ch.id)}'])" style="font-size:11px;padding:3px 8px;border:1px solid #e5e5ea;border-radius:5px;background:#fff;cursor:pointer;color:#5e6f8e">编辑</button>
          <button onclick="deletePushChannel('${escapeHtml(ch.id)}')" style="font-size:11px;padding:3px 8px;border:1px solid rgba(255,59,48,0.3);border-radius:5px;background:#fff;cursor:pointer;color:#d70015">删除</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  // Cache for edit
  window.channelCache = {};
  items.forEach((ch) => { window.channelCache[ch.id] = ch; });
}

function openPushChannelForm(channel) {
  const area = getNode('channelFormArea');
  if (!area) return;
  area.style.display = '';
  getNode('chFormId').value = channel ? channel.id : '';
  getNode('chFormName').value = channel ? channel.name : '';
  getNode('chFormType').value = channel ? channel.type : 'webhook';
  getNode('chFormUrl').value = channel ? channel.url : '';
  getNode('chFormSecret').value = channel ? (channel.secret || '') : '';
  getNode('chFormEnabled').checked = channel ? channel.enabled : true;
  const levels = channel ? (channel.levels || []) : [];
  getNode('chLevelCritical').checked = levels.includes('critical');
  getNode('chLevelWarning').checked = levels.includes('warning');
  getNode('chLevelInfo').checked = levels.includes('info');
}

function closePushChannelForm() {
  const area = getNode('channelFormArea');
  if (area) area.style.display = 'none';
}

async function savePushChannel() {
  const levels = [];
  if (getNode('chLevelCritical').checked) levels.push('critical');
  if (getNode('chLevelWarning').checked) levels.push('warning');
  if (getNode('chLevelInfo').checked) levels.push('info');
  const id = getNode('chFormId').value || undefined;
  const payload = {
    id,
    name: getNode('chFormName').value,
    type: getNode('chFormType').value,
    url: getNode('chFormUrl').value,
    secret: getNode('chFormSecret').value,
    enabled: getNode('chFormEnabled').checked,
    levels
  };
  await api('/api/admin/push-channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  closePushChannelForm();
  await loadPushChannels();
}

async function deletePushChannel(id) {
  if (!confirm('确认删除该推送渠道？')) return;
  await api(`/api/admin/push-channels/${id}/delete`, { method: 'POST' });
  await loadPushChannels();
}

async function testPushChannel(id) {
  const out = await api(`/api/admin/push-channels/${id}/test`, { method: 'POST' });
  alert(out && out.message ? out.message : '测试完成');
}

function initPushChannelUI() {
  const btnAdd = getNode('btnAddChannel');
  if (btnAdd) btnAdd.addEventListener('click', () => openPushChannelForm(null));
  const btnSave = getNode('btnSaveChannel');
  if (btnSave) btnSave.addEventListener('click', () => savePushChannel().catch((e) => alert('保存失败：' + e.message)));
  const btnCancel = getNode('btnCancelChannel');
  if (btnCancel) btnCancel.addEventListener('click', closePushChannelForm);
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    initPushChannelUI();
    await load();
    await loadPushChannels();
    setInterval(() => { load().catch(() => {}); }, 5000);
  } catch (error) {
    showStatus(`加载失败：${String(error && error.message ? error.message : 'unknown')}`, true);
    renderRows([]);
  }
})();
