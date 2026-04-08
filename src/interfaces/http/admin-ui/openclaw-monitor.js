/* ═══════════════════════════════════════════════════════════
   openclaw-monitor.js — Platform Operations Dashboard
   定位：实时运营态势感知 + 待处置事件（决策/告警）
   数据源：AI Gateway API + Analytics API（实时） + 本地 mock（决策）
   ═══════════════════════════════════════════════════════════ */

// ── Data（Agent 效能/健康/告警从 API 加载，决策暂用 mock） ──

let AGENT_PERF = [];
let HEALTH_METRICS = [];
let ALERTS = [];
let AGENT_USAGE = [];

const DECISIONS = [
  {
    id: 'dec-001', title: 'API 网关熔断策略升级', agent: '运维助手', urgency: 'critical',
    context: '检测到支付服务异常率从 0.1% 升至 2.3%，建议立即启用熔断策略，将错误率阈值从 5% 降至 1%。',
    recommendation: '立即启用，预计可在 30 秒内止损', time: '5 分钟前',
  },
  {
    id: 'dec-002', title: '数据库连接池扩容', agent: '运维助手', urgency: 'high',
    context: '数据库连接池使用率持续高于 85%，高峰时段出现排队等待。建议将最大连接数从 50 提升至 100。',
    recommendation: '扩容至 100 连接，需同步检查数据库最大连接数配置', time: '18 分钟前',
  },
  {
    id: 'dec-003', title: '第三方依赖升级（axios 1.x → 1.7）', agent: '代码助手', urgency: 'normal',
    context: 'axios 1.7 修复了 SSRF 漏洞（CVE-2024-39338）。当前项目使用 axios 1.3.6，建议在下次迭代中升级。',
    recommendation: '纳入下个 Sprint 升级，预计影响 12 个文件', time: '1 小时前',
  },
];

// (HEALTH_METRICS, ALERTS, AGENT_USAGE declared above — populated by API calls)

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

async function loadAgentPerformance() {
  try {
    const res = await fetch('/api/admin/analytics/agent-performance');
    if (!res.ok) return;
    const data = await res.json();
    const colors = ['#0071e3', '#34c759', '#af52de', '#ff9500', '#ff3b30', '#5ac8fa'];
    AGENT_PERF = (data.rows || []).map((a, i) => ({
      name: a.name,
      icon: '&#x1F916;',
      sessions: a.taskCount,
      completion: a.successRate,
      satisfaction: '-',
      avgTime: a.totalTokens > 0 ? fmtNum(a.totalTokens) + ' tok' : '-',
      color: colors[i % colors.length]
    }));
    AGENT_USAGE = AGENT_PERF.map((a) => {
      const maxSessions = AGENT_PERF.length > 0 ? AGENT_PERF[0].sessions : 1;
      return {
        name: a.name,
        count: a.sessions,
        pct: maxSessions > 0 ? Math.round(a.sessions / maxSessions * 100) : 0,
        color: a.color
      };
    });
  } catch (_) {}
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

function renderAgentPerf() {
  const container = document.getElementById('agentPerfList');
  if (!container) return;
  if (AGENT_PERF.length === 0) { container.innerHTML = emptyHint('暂无 Agent 效能数据'); return; }
  container.innerHTML = AGENT_PERF.map(a => `
    <div class="agent-perf-item">
      <div class="agent-perf-avatar" style="background:${a.color}15;color:${a.color}">${a.icon}</div>
      <div class="agent-perf-info">
        <div class="agent-perf-name">${a.name}</div>
        <div class="agent-perf-meta">${a.sessions} 次会话 · 平均响应 ${a.avgTime}</div>
      </div>
      <div class="agent-perf-stats">
        <div class="agent-perf-stat">
          <div class="agent-perf-stat-val" style="color:${a.completion >= 95 ? '#34c759' : a.completion >= 90 ? '#0071e3' : '#ff9500'}">${a.completion}%</div>
          <div class="agent-perf-stat-label">完成率</div>
        </div>
        <div class="agent-perf-stat">
          <div class="agent-perf-stat-val">${a.satisfaction}</div>
          <div class="agent-perf-stat-label">满意度</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderDecisions() {
  const container = document.getElementById('decisionList');
  if (!container) return;
  container.innerHTML = DECISIONS.map(d => `
    <div class="decision-item">
      <div class="decision-dot ${d.urgency}"></div>
      <div class="decision-info">
        <div class="decision-title">${d.title}</div>
        <div class="decision-meta">${d.agent} · ${d.time}</div>
        <div class="decision-context">${d.context}</div>
        <div class="decision-rec">建议：${d.recommendation}</div>
      </div>
    </div>
  `).join('');
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
    loadAgentPerformance(),
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

  // Update active users from agent performance data
  const activeUsersEl = document.getElementById('activeUsers');
  if (activeUsersEl) {
    activeUsersEl.textContent = AGENT_PERF.length > 0 ? String(AGENT_PERF.length) : '0';
    const descEl = activeUsersEl.nextElementSibling;
    const totalSessions = AGENT_PERF.reduce((s, a) => s + a.sessions, 0);
    if (descEl) descEl.textContent = totalSessions > 0 ? `共 ${fmtNum(totalSessions)} 次会话` : '暂无数据';
  }

  // Update avg rounds from gateway stats
  const avgRoundsEl = document.getElementById('avgRounds');
  if (avgRoundsEl) {
    if (gwStats && gwStats.totalTraces > 0 && AGENT_PERF.length > 0) {
      const totalSessions = AGENT_PERF.reduce((s, a) => s + a.sessions, 0);
      const avg = totalSessions > 0 ? (gwStats.totalTraces / totalSessions).toFixed(1) : '-';
      avgRoundsEl.textContent = avg;
    } else {
      avgRoundsEl.textContent = '-';
    }
  }

  // Update pending decisions count
  const pendingDecisionsEl = document.getElementById('pendingDecisions');
  if (pendingDecisionsEl) {
    pendingDecisionsEl.textContent = String(DECISIONS.length);
    const descEl = pendingDecisionsEl.nextElementSibling;
    if (descEl) {
      const critical = DECISIONS.filter(d => d.urgency === 'critical').length;
      const high = DECISIONS.filter(d => d.urgency === 'high').length;
      const normal = DECISIONS.filter(d => d.urgency === 'normal').length;
      const parts = [];
      if (critical > 0) parts.push(`${critical} 紧急`);
      if (high > 0) parts.push(`${high} 重要`);
      if (normal > 0) parts.push(`${normal} 一般`);
      descEl.textContent = parts.length > 0 ? parts.join(' · ') : '无待处理';
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

  renderAgentPerf();
  renderDecisions();
  renderHealth();
  renderAlerts();
  renderUsageBars('agentUsage', AGENT_USAGE);

  // Model usage distribution from real API (replaces mock dept usage)
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
    if (el) el.innerHTML = '<div style="font-size:12px;color:#aeaeb2;text-align:center;padding:20px">暂无模型调用数据</div>';
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
