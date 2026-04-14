/* ═══════════════════════════════════════════════════════════
   openclaw-monitor.js — Platform Operations Dashboard
   定位：实时运营态势感知 + 平台级聚合指标（成本/SLA/健康/告警）
   数据源：AI Gateway API + Analytics API（实时）
   ═══════════════════════════════════════════════════════════ */

// ── Data（从 API 加载） ──

let HEALTH_METRICS = [];
let ALERTS = [];

// ── API Integration ──

const MODEL_COLORS = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff3b30', '#5ac8fa', '#007aff', '#ff2d55'];

async function loadGatewayStats() {
  try {
    const res = await fetch('/api/admin/ai-gateway/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function loadGatewayCosts() {
  try {
    const res = await fetch('/api/admin/ai-gateway/costs');
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function loadHealthMetrics() {
  try {
    const res = await fetch('/api/admin/analytics/health');
    if (!res.ok) return;
    const data = await res.json();
    HEALTH_METRICS = (data.metrics || []).map(m => ({
      label: m.label,
      value: m.value,
      status: m.status === 'bad' ? 'bad' : m.status === 'warn' ? 'warn' : 'good'
    }));
  } catch (_) {}
}

async function loadAlerts() {
  try {
    const res = await fetch('/api/admin/analytics/alerts');
    if (!res.ok) return;
    const data = await res.json();
    ALERTS = (data.alerts || []).map(a => ({
      level: a.level,
      title: a.title,
      desc: a.desc,
      time: a.time ? new Date(a.time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'
    }));
  } catch (_) {}
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

// ── Renderers ──

function emptyHint(text) {
  return `<div style="font-size:12px;color:#aeaeb2;text-align:center;padding:20px">${text}</div>`;
}

function renderCostOverview(gwCosts) {
  const container = document.getElementById('costOverview');
  if (!container) return;
  if (!gwCosts || !gwCosts.modelSummary || gwCosts.modelSummary.length === 0) {
    container.innerHTML = emptyHint('暂无成本数据');
    return;
  }
  const models = gwCosts.modelSummary;
  const totalCost = models.reduce((s, m) => s + Number(m.totalCost || 0), 0);
  const maxCost = Math.max(...models.map(m => Number(m.totalCost || 0)));
  const colors = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff3b30', '#5ac8fa', '#007aff', '#ff2d55'];

  let html = `<div class="cost-total">
    <div class="cost-total-val">¥${totalCost.toFixed(2)}</div>
    <div class="cost-total-label">总花费（统计周期内）</div>
  </div><div class="cost-bar-list">`;
  html += models.map((m, i) => {
    const cost = Number(m.totalCost || 0);
    const pct = maxCost > 0 ? Math.round(cost / maxCost * 100) : 0;
    const pctOfTotal = totalCost > 0 ? (cost / totalCost * 100).toFixed(1) : '0.0';
    return `<div class="cost-bar-item">
      <div class="cost-bar-name">${m.model}</div>
      <div class="cost-bar-track"><div class="cost-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
      <div class="cost-bar-pct">${pctOfTotal}%</div>
    </div>`;
  }).join('');
  html += '</div>';
  container.innerHTML = html;
}

function renderSLA() {
  const container = document.getElementById('slaDashboard');
  if (!container) return;
  if (HEALTH_METRICS.length === 0) { container.innerHTML = emptyHint('暂无 SLA 数据'); return; }
  // Pick key SLA metrics to display prominently
  const slaKeys = ['实例可用率', 'Gateway 平均延迟', 'Gateway P95 延迟', 'Gateway 错误率', 'Gateway 拦截率', '运行实例'];
  const items = HEALTH_METRICS.filter(m => slaKeys.includes(m.label));
  if (items.length === 0) { container.innerHTML = emptyHint('暂无 SLA 数据'); return; }
  container.innerHTML = '<div class="sla-grid">' + items.map(m => `
    <div class="sla-card">
      <div class="sla-card-val ${m.status}">${m.value}</div>
      <div class="sla-card-label">${m.label}</div>
    </div>
  `).join('') + '</div>';
}

function renderHealth() {
  const container = document.getElementById('healthMetrics');
  if (!container) return;
  if (HEALTH_METRICS.length === 0) { container.innerHTML = emptyHint('暂无健康指标数据'); return; }
  container.innerHTML = HEALTH_METRICS.map(m => `
    <div class="health-card">
      <div class="health-card-val ${m.status}">${m.value}</div>
      <div class="health-card-label">${m.label}</div>
    </div>
  `).join('');
}

function renderAlerts() {
  const container = document.getElementById('alertList');
  if (!container) return;
  if (ALERTS.length === 0) { container.innerHTML = emptyHint('当前无活跃告警'); return; }
  container.innerHTML = ALERTS.map(a => `
    <div class="alert-item">
      <div class="alert-badge ${a.level}"></div>
      <div class="alert-content">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
      </div>
      <div class="alert-time">${a.time}</div>
    </div>
  `).join('');
}

function renderUsageBars(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!data || data.length === 0) { container.innerHTML = emptyHint('暂无使用分布数据'); return; }
  container.innerHTML = data.map(d => `
    <div class="usage-bar-wrap">
      <div class="usage-bar-head">
        <span class="usage-bar-name">${d.name}</span>
        <span class="usage-bar-count">${d.count} 次</span>
      </div>
      <div class="usage-bar-track">
        <div class="usage-bar-fill" style="width:${d.pct}%;background:${d.color}"></div>
      </div>
    </div>
  `).join('');
}

// ── Init ──

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
  } catch (_) { /* auth optional */ }

  // Load real data from AI Gateway API
  const [gwStats, gwCosts] = await Promise.all([
    loadGatewayStats(),
    loadGatewayCosts(),
    loadHealthMetrics(),
    loadAlerts()
  ]);

  // Update hero cards with real data where available
  if (gwStats) {
    const el = document.getElementById('todayConvCount');
    if (el) el.textContent = fmtNum(gwStats.totalTraces);
    const descEl = el && el.nextElementSibling;
    if (descEl) descEl.textContent = `完成 ${gwStats.completed} · 拦截 ${gwStats.blocked} · 失败 ${gwStats.failed}`;
  }

  // Update active users from gateway stats
  const activeUsersEl = document.getElementById('activeUsers');
  if (activeUsersEl) {
    if (gwStats && gwStats.totalTraces > 0) {
      activeUsersEl.textContent = fmtNum(gwStats.completed + gwStats.failed);
      const descEl = activeUsersEl.nextElementSibling;
      if (descEl) descEl.textContent = `共 ${fmtNum(gwStats.totalTraces)} 次调用`;
    } else {
      activeUsersEl.textContent = '0';
      const descEl = activeUsersEl.nextElementSibling;
      if (descEl) descEl.textContent = '暂无数据';
    }
  }

  // Update avg rounds from gateway stats
  const avgRoundsEl = document.getElementById('avgRounds');
  if (avgRoundsEl) {
    if (gwStats && gwStats.totalTraces > 0 && gwStats.completed > 0) {
      const avg = (gwStats.totalTraces / gwStats.completed).toFixed(1);
      avgRoundsEl.textContent = avg;
    } else {
      avgRoundsEl.textContent = '-';
    }
  }

  // Update alert count
  const alertCountEl = document.getElementById('alertCount');
  if (alertCountEl) {
    alertCountEl.textContent = String(ALERTS.length);
    const descEl = alertCountEl.nextElementSibling;
    if (descEl) {
      const critical = ALERTS.filter(a => a.level === 'critical').length;
      const warning = ALERTS.filter(a => a.level === 'warning').length;
      const info = ALERTS.filter(a => a.level === 'info').length;
      const parts = [];
      if (critical > 0) parts.push(`${critical} 严重`);
      if (warning > 0) parts.push(`${warning} 警告`);
      if (info > 0) parts.push(`${info} 信息`);
      descEl.textContent = parts.length > 0 ? parts.join(' · ') : '系统正常';
    }
  }

  renderCostOverview(gwCosts);
  renderSLA();
  renderHealth();
  renderAlerts();

  // Agent usage distribution from real API
  if (gwCosts && gwCosts.modelSummary && gwCosts.modelSummary.length > 0) {
    const maxCount = Math.max(...gwCosts.modelSummary.map(m => m.count));
    const agentUsage = gwCosts.modelSummary.map((m, i) => ({
      name: m.model,
      count: m.count,
      pct: maxCount > 0 ? Math.round(m.count / maxCount * 100) : 0,
      color: MODEL_COLORS[i % MODEL_COLORS.length]
    }));
    renderUsageBars('agentUsage', agentUsage);
  } else {
    const el = document.getElementById('agentUsage');
    if (el) el.innerHTML = emptyHint('暂无 Agent 使用数据');
  }

  // Model usage distribution from real API
  if (gwCosts && gwCosts.modelSummary && gwCosts.modelSummary.length > 0) {
    const maxCount = Math.max(...gwCosts.modelSummary.map(m => m.count));
    const modelUsage = gwCosts.modelSummary.map((m, i) => ({
      name: m.model,
      count: m.count,
      pct: maxCount > 0 ? Math.round(m.count / maxCount * 100) : 0,
      color: MODEL_COLORS[i % MODEL_COLORS.length]
    }));
    renderUsageBars('deptUsage', modelUsage);
  } else {
    const el = document.getElementById('deptUsage');
    if (el) el.innerHTML = emptyHint('暂无模型调用数据');
  }

  // ── 运行时配置 & 权限模板（原配置中心） ──
  initConfigPanel();
})();

// ── 配置面板逻辑 ──

function cfgStatus(msg, isError) {
  const el = document.getElementById('cfgStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#d70015' : '#34c759';
  if (msg) setTimeout(() => { el.textContent = ''; }, 5000);
}

async function loadOpsConfig() {
  try {
    const apiCall = window.adminApi || (async (path, opts) => {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error('请求失败');
      return r.json();
    });
    const data = await apiCall('/api/admin/runtime/openclaw-config');
    const rt = data.runtime || {};
    const tpl = data.permissionTemplate || {};

    const $ = id => document.getElementById(id);
    if ($('cfgImage')) $('cfgImage').value = rt.openclawImage || '';
    if ($('cfgVersion')) $('cfgVersion').value = rt.openclawRuntimeVersion || '';
    if ($('cfgSourcePath')) $('cfgSourcePath').value = rt.openclawSourcePath || '';
    if ($('cfgAllowlist')) $('cfgAllowlist').value = (Array.isArray(tpl.commandAllowlist) ? tpl.commandAllowlist : []).join('\n');
    if ($('cfgApproval')) $('cfgApproval').value = JSON.stringify(tpl.approvalByRisk || {}, null, 2);

    const ret = data.retention || {};
    if ($('cfgRetentionTtl')) $('cfgRetentionTtl').value = String(ret.auditLogTtlDays || 90);
    if ($('cfgRetentionMaxRows')) $('cfgRetentionMaxRows').value = String(ret.auditLogMaxRows || 100000);
    if ($('cfgRetentionRingSize')) $('cfgRetentionRingSize').value = String(ret.archiveRingSize || 3);
    if ($('cfgRetentionArchive')) $('cfgRetentionArchive').checked = ret.archiveEnabled !== false;
  } catch (e) {
    cfgStatus('加载失败: ' + e.message, true);
  }
}

async function saveOpsConfig() {
  try {
    const $ = id => document.getElementById(id);
    let approvalByRisk = {};
    const raw = ($('cfgApproval') && $('cfgApproval').value || '').trim();
    if (raw) {
      try { approvalByRisk = JSON.parse(raw); } catch { throw new Error('审批模板 JSON 格式不正确'); }
    }
    const payload = {
      runtime: {
        openclawImage: ($('cfgImage') && $('cfgImage').value || '').trim(),
        openclawRuntimeVersion: ($('cfgVersion') && $('cfgVersion').value || '').trim(),
        openclawSourcePath: ($('cfgSourcePath') && $('cfgSourcePath').value || '').trim()
      },
      permissionTemplate: {
        commandAllowlist: ($('cfgAllowlist') && $('cfgAllowlist').value || '').split('\n').map(s => s.trim()).filter(Boolean),
        approvalByRisk
      },
      retention: {
        auditLogTtlDays: Number($('cfgRetentionTtl') && $('cfgRetentionTtl').value) || 90,
        auditLogMaxRows: Number($('cfgRetentionMaxRows') && $('cfgRetentionMaxRows').value) || 100000,
        archiveEnabled: $('cfgRetentionArchive') ? $('cfgRetentionArchive').checked : true,
        archiveRingSize: Number($('cfgRetentionRingSize') && $('cfgRetentionRingSize').value) || 3
      }
    };
    const apiCall = window.adminApi || (async (path, opts) => {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error('请求失败');
      return r.json();
    });
    await apiCall('/api/admin/runtime/openclaw-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await loadOpsConfig();
    cfgStatus('配置已保存');
    loadConfigHistory();
  } catch (e) {
    cfgStatus('保存失败: ' + e.message, true);
  }
}

function initConfigPanel() {
  const saveBtn = document.getElementById('btnSaveConfig');
  const reloadBtn = document.getElementById('btnReloadConfig');
  const historyBtn = document.getElementById('btnConfigHistory');
  if (saveBtn) saveBtn.addEventListener('click', saveOpsConfig);
  if (reloadBtn) reloadBtn.addEventListener('click', () => { loadOpsConfig(); cfgStatus('已重新加载'); });
  if (historyBtn) historyBtn.addEventListener('click', toggleConfigHistory);
  loadOpsConfig();
}

// ── 配置版本历史 ──

function toggleConfigHistory() {
  const panel = document.getElementById('configHistoryPanel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? '' : 'none';
  if (isHidden) loadConfigHistory();
}

async function loadConfigHistory() {
  const tbody = document.getElementById('configHistoryRows');
  if (!tbody) return;
  try {
    const apiCall = window.adminApi || (async (path, opts) => {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error('请求失败');
      return r.json();
    });
    const data = await apiCall('/api/admin/runtime/openclaw-config/snapshots');
    const snapshots = data.snapshots || [];
    if (snapshots.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#aeaeb2;font-size:12px">暂无历史版本</td></tr>';
      return;
    }
    tbody.innerHTML = snapshots.map((s, i) => {
      const shortId = s.id.slice(0, 12);
      const time = new Date(s.timestamp).toLocaleString('zh-CN');
      const num = snapshots.length - i;
      return `<tr style="border-bottom:1px solid #f2f2f7">
        <td style="padding:8px 6px;font-family:monospace;font-size:12px;color:#6e6e73">#${num} (${shortId})</td>
        <td style="padding:8px 6px;font-size:12px;color:#3a3a3c">${time}</td>
        <td style="padding:8px 6px;font-size:12px;color:#3a3a3c">${s.author || '-'}</td>
        <td style="padding:8px 6px;text-align:right;white-space:nowrap">
          <button onclick="restoreConfigSnapshot('${s.id}')" style="font-size:11px;padding:4px 10px;border:1px solid #e5e5ea;border-radius:6px;background:#fff;color:#0071e3;cursor:pointer;margin-left:4px">恢复</button>
          <button onclick="diffConfigSnapshot('${s.id}')" style="font-size:11px;padding:4px 10px;border:1px solid #e5e5ea;border-radius:6px;background:#fff;color:#6e6e73;cursor:pointer;margin-left:4px">对比当前</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#d70015;font-size:12px">加载失败: ' + e.message + '</td></tr>';
  }
}

async function restoreConfigSnapshot(snapshotId) {
  if (!confirm('确认恢复到此版本？当前配置将被覆盖。')) return;
  try {
    const apiCall = window.adminApi || (async (path, opts) => {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error('请求失败');
      return r.json();
    });
    await apiCall('/api/admin/runtime/openclaw-config/snapshots/' + snapshotId + '/restore', {
      method: 'POST'
    });
    await loadOpsConfig();
    cfgStatus('已恢复到历史版本');
    loadConfigHistory();
  } catch (e) {
    cfgStatus('恢复失败: ' + e.message, true);
  }
}

async function diffConfigSnapshot(snapshotId) {
  const diffPanel = document.getElementById('configDiffResult');
  const diffContent = document.getElementById('configDiffContent');
  if (!diffPanel || !diffContent) return;
  try {
    const apiCall = window.adminApi || (async (path, opts) => {
      const r = await fetch(path, opts);
      if (!r.ok) throw new Error('请求失败');
      return r.json();
    });
    // 获取当前配置和快照配置进行前端对比
    const [currentData, snapData] = await Promise.all([
      apiCall('/api/admin/runtime/openclaw-config'),
      apiCall('/api/admin/runtime/openclaw-config/snapshots')
    ]);
    const snap = (snapData.snapshots || []).find(s => s.id === snapshotId);
    if (!snap) {
      diffContent.textContent = '快照不存在';
      diffPanel.style.display = '';
      return;
    }
    const current = {
      runtime: JSON.stringify(currentData.runtime || {}, null, 2),
      permissionTemplate: JSON.stringify(currentData.permissionTemplate || {}, null, 2)
    };
    const snapped = {
      runtime: JSON.stringify(snap.config.runtime || {}, null, 2),
      permissionTemplate: JSON.stringify(snap.config.permissionTemplate || {}, null, 2)
    };
    const lines = [];
    for (const key of ['runtime', 'permissionTemplate']) {
      if (current[key] !== snapped[key]) {
        lines.push('[' + key + '] 有变更:');
        lines.push('  快照值: ' + snapped[key]);
        lines.push('  当前值: ' + current[key]);
        lines.push('');
      }
    }
    diffContent.textContent = lines.length > 0 ? lines.join('\n') : '无差异：快照与当前配置一致。';
    diffPanel.style.display = '';
  } catch (e) {
    diffContent.textContent = '对比失败: ' + e.message;
    diffPanel.style.display = '';
  }
}
