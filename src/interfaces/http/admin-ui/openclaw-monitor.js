/* ═══════════════════════════════════════════════════════════
   openclaw-monitor.js — Platform Operations Dashboard
   ═══════════════════════════════════════════════════════════ */

// ── Mock Data ──

const AGENT_PERF = [
  { name: '代码助手', icon: '&#x1F4BB;', sessions: 86, completion: 96, satisfaction: 4.8, avgTime: '1.2s', color: '#0071e3' },
  { name: '安全巡检员', icon: '&#x1F6E1;', sessions: 42, completion: 98, satisfaction: 4.7, avgTime: '0.8s', color: '#34c759' },
  { name: '数据分析师', icon: '&#x1F4CA;', sessions: 38, completion: 93, satisfaction: 4.6, avgTime: '2.1s', color: '#af52de' },
  { name: '流程助理', icon: '&#x2699;', sessions: 34, completion: 88, satisfaction: 4.3, avgTime: '1.5s', color: '#ff9500' },
  { name: '报表助理', icon: '&#x1F4C4;', sessions: 28, completion: 91, satisfaction: 4.4, avgTime: '1.8s', color: '#5ac8fa' },
  { name: '运维助手', icon: '&#x1F527;', sessions: 24, completion: 95, satisfaction: 4.5, avgTime: '0.9s', color: '#ff3b30' },
];

const DECISIONS = [
  {
    id: 'dec-001',
    title: 'API 网关熔断策略升级',
    agent: '运维助手',
    urgency: 'critical',
    context: '检测到支付服务异常率从 0.1% 升至 2.3%，建议立即启用熔断策略，将错误率阈值从 5% 降至 1%。',
    recommendation: '立即启用，预计可在 30 秒内止损',
    time: '5 分钟前',
  },
  {
    id: 'dec-002',
    title: '数据库连接池扩容',
    agent: '运维助手',
    urgency: 'high',
    context: '数据库连接池使用率持续高于 85%，高峰时段出现排队等待。建议将最大连接数从 50 提升至 100。',
    recommendation: '扩容至 100 连接，需同步检查数据库最大连接数配置',
    time: '18 分钟前',
  },
  {
    id: 'dec-003',
    title: '第三方依赖升级（axios 1.x → 1.7）',
    agent: '代码助手',
    urgency: 'normal',
    context: 'axios 1.7 修复了 SSRF 漏洞（CVE-2024-39338）。当前项目使用 axios 1.3.6，建议在下次迭代中升级。',
    recommendation: '纳入下个 Sprint 升级，预计影响 12 个文件',
    time: '1 小时前',
  },
];

const HEALTH_METRICS = [
  { label: 'API 可用率', value: '99.7%', status: 'good' },
  { label: '平均响应时间', value: '1.4s', status: 'good' },
  { label: 'P95 响应时间', value: '3.2s', status: 'warn' },
  { label: '错误率', value: '0.8%', status: 'good' },
  { label: '超时率', value: '0.3%', status: 'good' },
  { label: 'Token 使用率', value: '72%', status: 'warn' },
  { label: '并发会话峰值', value: '18', status: 'good' },
  { label: '队列积压', value: '0', status: 'good' },
];

const ALERTS = [
  { level: 'critical', title: '支付服务异常率升高', desc: '错误率从 0.1% 升至 2.3%，已触发熔断预警', time: '5 分钟前' },
  { level: 'warning', title: 'Token 日消耗接近配额', desc: '今日已使用 72% 的日配额（5,040K / 7,000K）', time: '32 分钟前' },
  { level: 'info', title: '数据库连接池使用率偏高', desc: '当前使用率 87%，建议在低峰期扩容', time: '1 小时前' },
  { level: 'info', title: '安全巡检完成', desc: '例行安全扫描完成，发现 0 个新漏洞', time: '2 小时前' },
];

const AGENT_USAGE = [
  { name: '代码助手', count: 86, pct: 100, color: '#0071e3' },
  { name: '安全巡检员', count: 42, pct: 49, color: '#34c759' },
  { name: '数据分析师', count: 38, pct: 44, color: '#af52de' },
  { name: '流程助理', count: 34, pct: 40, color: '#ff9500' },
  { name: '报表助理', count: 28, pct: 33, color: '#5ac8fa' },
  { name: '运维助手', count: 24, pct: 28, color: '#ff3b30' },
];

const DEPT_USAGE = [
  { name: '技术研发部', count: 128, pct: 100, color: '#0071e3' },
  { name: '安全运维部', count: 72, pct: 56, color: '#34c759' },
  { name: '产品运营部', count: 58, pct: 45, color: '#af52de' },
  { name: '市场营销部', count: 36, pct: 28, color: '#ff9500' },
  { name: '人力资源部', count: 24, pct: 19, color: '#5ac8fa' },
  { name: '财务管理部', count: 18, pct: 14, color: '#ff3b30' },
];

// ── Renderers ──

function renderAgentPerf() {
  const container = document.getElementById('agentPerfList');
  if (!container) return;
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

  renderAgentPerf();
  renderDecisions();
  renderHealth();
  renderAlerts();
  renderUsageBars('agentUsage', AGENT_USAGE);
  renderUsageBars('deptUsage', DEPT_USAGE);
})();
