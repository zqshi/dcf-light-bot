async function api(path) {
  if (window.adminApi) return window.adminApi(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function isNotFoundError(error) {
  const msg = String(error && error.message ? error.message : '').toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}

function renderList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!Array.isArray(items) || !items.length) {
    el.innerHTML = '<div class="overview-item">暂无数据</div>';
    return;
  }
  el.innerHTML = items.map((item) => `<div class="overview-item">${item}</div>`).join('');
}

async function checkEndpoint(path, options) {
  try {
    await api(path, options);
    return { ok: true, detail: 'ok' };
  } catch (error) {
    return { ok: false, detail: String((error && error.message) || 'failed') };
  }
}

async function checkAdminCompleteness() {
  const checks = [
    { key: 'instances', label: '员工/实例管理接口', call: () => checkEndpoint('/api/admin/instances') },
    { key: 'skills', label: '技能管理接口', call: () => checkEndpoint('/api/admin/assets/skill') },
    { key: 'tools', label: '工具管理接口', call: () => checkEndpoint('/api/admin/assets/tool') },
    { key: 'logs', label: '行为日志接口', call: () => checkEndpoint('/api/admin/logs') },
    { key: 'auth', label: '权限管理接口', call: () => checkEndpoint('/api/admin/auth/users') },
    { key: 'openclaw', label: '运行时配置接口', call: () => checkEndpoint('/api/admin/runtime/openclaw-config') },
    { key: 'matrix', label: 'Matrix 渠道状态接口', call: () => checkEndpoint('/api/admin/matrix/status') },
    { key: 'sso', label: 'SSO 能力接口', call: () => checkEndpoint('/api/auth/sso/capabilities') }
  ];

  const rows = [];
  for (const item of checks) {
    // eslint-disable-next-line no-await-in-loop
    const result = await item.call();
    rows.push({
      label: item.label,
      ok: Boolean(result.ok),
      detail: result.detail
    });
  }

  const okCount = rows.filter((x) => x.ok).length;
  const failed = rows.length - okCount;
  const summary = failed === 0
    ? `关键能力 ${okCount}/${rows.length} 可用，后台功能逻辑完整度良好。`
    : `关键能力 ${okCount}/${rows.length} 可用，存在 ${failed} 项待补齐。`;
  return { rows, summary, failed };
}

function buildOverviewFromLegacy(runtime = {}, bootstrap = {}, metrics = {}) {
  const counters = runtime.counters || {};
  const queue = runtime.queue || {};
  const b = bootstrap || runtime.bootstrap || {};
  const tasksTotal = Number(counters.tasks || metrics.totalTasks || 0);
  const succeeded = Number(metrics.succeededTasks || 0);
  const failed = Number(metrics.failedTasks || 0);
  const inProgress = Math.max(0, tasksTotal - succeeded - failed);
  const successRate = tasksTotal ? Math.round((succeeded / tasksTotal) * 100) : 100;
  const skillsTotal = Number(counters.skills || 0);
  const findingsTotal = Number(counters.findings || 0);
  const pendingReviews = Number((runtime.governance && runtime.governance.pendingReviews) || 0);

  return {
    overview: {
      platform: {
        instancesTotal: Number(counters.employees || 0),
        runningInstances: Number(counters.employees || 0),
        abnormalInstances: 0,
        tenantsTotal: 0,
        matrixBoundInstances: 0,
        stateBreakdown: { running: Number(counters.employees || 0) },
        healthLevel: 'healthy'
      },
      assets: {
        sharedSkills: skillsTotal,
        sharedTools: 0,
        sharedKnowledge: findingsTotal,
        sharedTotal: skillsTotal + findingsTotal,
        bindingsTotal: 0,
        pendingReviews,
        overdueReviews: 0
      },
      operations: {
        auditEvents24h: Number(metrics.totalTasks || 0),
        adminEvents24h: 0,
        instanceEvents24h: Number(metrics.totalTasks || 0),
        assetEvents24h: 0,
        latestEventAt: ''
      },
      security: {
        usersTotal: 0,
        disabledUsers: 0,
        rolesTotal: 0
      }
    },
    delivery: {
      employeesTotal: Number(counters.employees || 0),
      totalTasks: tasksTotal,
      succeededTasks: succeeded,
      failedTasks: failed,
      inProgressTasks: inProgress,
      successRate
    },
    governance: {
      waitingApprovalTasks: pendingReviews,
      compensationPendingTasks: 0,
      rollbackTasks: 0,
      p1Incidents: 0
    },
    assets: {
      skillsTotal,
      findingsTotal,
      toolsTotal: 0,
      sharedTotal: skillsTotal + findingsTotal,
      bindingsTotal: 0,
      skillReused: Number(metrics.skillReused || 0),
      recurrenceErrors: Number(metrics.recurrenceErrors || 0)
    },
    runtime: {
      runtimeEnabled: runtime.runtimeEnabled === true,
      dialogueEnabled: !!(runtime.llm && runtime.llm.dialogueEnabled),
      queueQueued: Number(queue.researchQueued || 0),
      queueDone: Number(queue.researchDone || 0),
      backlog: Math.max(Number(queue.researchQueued || 0) - Number(queue.researchDone || 0), 0),
      phase: String(b.phase || '-'),
      cycleCount: Number(b.cycleCount || 0),
      manualReviewRequired: !!b.manualReviewRequired
    },
    focus: [
      inProgress > 0
        ? `实例任务处理中 ${inProgress} 项，建议关注失败重试。`
        : '当前没有进行中任务，可按需创建新的数字员工实例。',
      `共享技能 ${skillsTotal} 项，知识 ${findingsTotal} 项。`,
      pendingReviews > 0
        ? `存在 ${pendingReviews} 项待审批资产，建议尽快处理。`
        : '当前无待审批资产，治理状态稳定。'
    ]
  };
}

async function loadOverview() {
  try {
    return await api('/api/admin/overview');
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const [runtime, bootstrap, metrics] = await Promise.all([
      api('/api/admin/runtime-status'),
      api('/api/admin/bootstrap-status'),
      api('/api/metrics')
    ]);
    return buildOverviewFromLegacy(runtime, bootstrap, metrics);
  }
}

function renderPage(overviewPayload) {
  const overview = overviewPayload && overviewPayload.overview && typeof overviewPayload.overview === 'object'
    ? overviewPayload.overview
    : {};
  const platform = overview.platform || {};
  const assets = overview.assets || {};
  const operations = overview.operations || {};
  const security = overview.security || {};

  const instancesTotal = Number(platform.instancesTotal || 0);
  const runningInstances = Number(platform.runningInstances || 0);
  const abnormalInstances = Number(platform.abnormalInstances || 0);
  const pendingReviews = Number(assets.pendingReviews || 0);

  setText('instancesTotal', instancesTotal);
  setText('instancesRunning', runningInstances);
  setText('instancesAbnormal', abnormalInstances);
  setText('pendingReviewsTotal', pendingReviews);

  setText('tenantCount', Number(platform.tenantsTotal || 0));
  setText('sharedAssetsTotal', Number(assets.sharedTotal || 0));
  setText('audit24hTotal', Number(operations.auditEvents24h || 0));
  setText('usersTotal', Number(security.usersTotal || 0));

  const health = String(platform.healthLevel || 'healthy');
  const headline = `平台健康：${health} · 运行实例 ${runningInstances}/${instancesTotal} · 异常 ${abnormalInstances}`;
  setText('statusHeadline', headline);

  const summary = [
    `当前托管 ${instancesTotal} 个租户实例，覆盖 ${Number(platform.tenantsTotal || 0)} 个租户。`,
    `共享资产共 ${Number(assets.sharedTotal || 0)} 项（技能 ${Number(assets.sharedSkills || 0)} / 工具 ${Number(assets.sharedTools || 0)} / 知识 ${Number(assets.sharedKnowledge || 0)}）。`,
    `近 24 小时审计事件 ${Number(operations.auditEvents24h || 0)} 条，账号 ${Number(security.usersTotal || 0)} 个。`
  ].join(' ');
  setText('summary', summary);

  renderList('opsChecklist', [
    `实例状态分布：${Object.entries(platform.stateBreakdown || {}).map(([k, v]) => `${k}:${v}`).join(' / ') || '-'}`,
    `资产治理：待审批 ${pendingReviews} / 逾期 ${Number(assets.overdueReviews || 0)} / 已绑定 ${Number(assets.bindingsTotal || 0)}`,
    `审计结构：后台 ${Number(operations.adminEvents24h || 0)} / 实例 ${Number(operations.instanceEvents24h || 0)} / 资产 ${Number(operations.assetEvents24h || 0)}`
  ]);

  renderList('qualityList', [
    `健康级别：${health}`,
    `异常实例：${abnormalInstances}`,
    `待审资产：${pendingReviews}`,
    `停用账号：${Number(security.disabledUsers || 0)}`
  ]);

  const focus = Array.isArray(overviewPayload && overviewPayload.focus) ? overviewPayload.focus : [];
  renderList('focusList', focus);
}

function renderCompleteness(result) {
  const summaryNode = document.getElementById('completenessSummary');
  if (summaryNode) summaryNode.textContent = result.summary || '-';
  const list = (result.rows || []).map((x) => {
    const status = x.ok ? '已支持' : '未完成';
    return `${x.label}：${status}${x.ok ? '' : `（${x.detail}）`}`;
  });
  renderList('completenessList', list);
}

// ═══════════════════════════════════════
// 仪表板视角切换
// ═══════════════════════════════════════

const VIEW_STORAGE_KEY = 'dcf.admin.dashboard.view';
const VALID_VIEWS = ['ops', 'mgmt', 'audit'];
let mgmtLoaded = false;
let auditLoaded = false;

function initDashboardViews() {
  const saved = localStorage.getItem(VIEW_STORAGE_KEY);
  const initial = VALID_VIEWS.includes(saved) ? saved : 'ops';

  const btns = document.querySelectorAll('.dash-view');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  switchView(initial);
}

function switchView(view) {
  if (!VALID_VIEWS.includes(view)) return;

  document.querySelectorAll('.dash-view').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.dash-panel').forEach((p) => {
    const panelView = p.id.replace('view', '').toLowerCase();
    p.classList.toggle('active', panelView === view);
    p.style.display = panelView === view ? 'block' : 'none';
  });

  localStorage.setItem(VIEW_STORAGE_KEY, view);

  if (view === 'mgmt' && !mgmtLoaded) loadMgmtView();
  if (view === 'audit' && !auditLoaded) loadAuditView();
}

// ═══════════════════════════════════════
// 管理视角
// ═══════════════════════════════════════

function fmtNum(n) {
  return Number(n || 0).toLocaleString('zh-CN');
}
function fmtCost(n) {
  return Number(n || 0).toFixed(4);
}
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

async function loadMgmtView() {
  mgmtLoaded = true;
  try {
    const [costsData, budgetData, overviewData] = await Promise.all([
      api('/api/admin/ai-gateway/costs').catch(() => null),
      api('/api/admin/ai-gateway/budget-status').catch(() => null),
      loadOverview().catch(() => null)
    ]);

    // Token 消耗概览
    if (costsData) {
      setText('mgmtPromptTokens', fmtNum(costsData.totalPromptTokens));
      setText('mgmtCompletionTokens', fmtNum(costsData.totalCompletionTokens));
      setText('mgmtTotalCost', fmtCost(costsData.totalEstimatedCost));
    }

    // 共享资产总数
    if (overviewData && overviewData.overview) {
      const assets = overviewData.overview.assets || {};
      setText('mgmtAssetsTotal', fmtNum(assets.sharedTotal));
    }

    // 部门成本 Top 5
    const deptTbody = document.querySelector('#mgmtDeptTable tbody');
    if (deptTbody && costsData && Array.isArray(costsData.deptSummary)) {
      const top5 = costsData.deptSummary
        .sort((a, b) => (b.estimatedCost || 0) - (a.estimatedCost || 0))
        .slice(0, 5);
      if (top5.length === 0) {
        deptTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8e8e93">暂无数据</td></tr>';
      } else {
        deptTbody.innerHTML = top5.map((d) =>
          `<tr><td>${esc(d.department)}</td><td>${fmtNum(d.count)}</td><td>${fmtNum(d.totalTokens)}</td><td>${fmtCost(d.estimatedCost)}</td></tr>`
        ).join('');
      }
    }

    // 预算使用概况
    const budgetList = document.getElementById('mgmtBudgetList');
    if (budgetList && budgetData && Array.isArray(budgetData.items)) {
      if (budgetData.items.length === 0) {
        budgetList.innerHTML = '<div class="overview-item">暂未配置预算</div>';
      } else {
        budgetList.innerHTML = budgetData.items.map((b) => {
          const pctStr = (b.pct * 100).toFixed(1);
          const color = b.pct >= 1 ? '#d70015' : b.pct >= 0.8 ? '#ff9500' : '#34c759';
          return `<div class="overview-item">${esc(b.name)}（${b.scope}）：已用 $${fmtCost(b.used)} / $${fmtCost(b.monthlyBudget)} <span style="color:${color};font-weight:600">${pctStr}%</span></div>`;
        }).join('');
      }
    }

    // 成员活跃度
    const userTbody = document.querySelector('#mgmtUserTable tbody');
    if (userTbody && costsData && Array.isArray(costsData.userSummary)) {
      const top10 = costsData.userSummary
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 10);
      if (top10.length === 0) {
        userTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8e8e93">暂无数据</td></tr>';
      } else {
        userTbody.innerHTML = top10.map((u) =>
          `<tr><td>${esc(u.userId)}</td><td>${esc(u.department)}</td><td>${fmtNum(u.count)}</td><td>${fmtNum(u.totalTokens)}</td><td>${fmtCost(u.estimatedCost)}</td></tr>`
        ).join('');
      }
    }
  } catch {
    mgmtLoaded = false;
  }
}

// ═══════════════════════════════════════
// 审计视角
// ═══════════════════════════════════════

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return '-';
  const keys = Object.keys(payload);
  if (keys.length === 0) return '-';
  const parts = keys.slice(0, 3).map((k) => `${k}:${String(payload[k]).slice(0, 20)}`);
  return parts.join(', ') + (keys.length > 3 ? '...' : '');
}

async function loadAuditView() {
  auditLoaded = true;
  try {
    const logs = await api('/api/admin/logs').catch(() => []);
    const events = Array.isArray(logs) ? logs : [];

    // 按类型聚合
    const typeMap = {};
    let authCount = 0;
    let securityCount = 0;
    events.forEach((e) => {
      const t = String(e.type || 'unknown');
      typeMap[t] = (typeMap[t] || 0) + 1;
      if (t.includes('auth') || t.includes('permission') || t.includes('role')) authCount++;
      if (t.includes('security') || t.includes('risk') || t.includes('alert')) securityCount++;
    });

    // 概览
    setText('auditTotalCount', fmtNum(events.length));
    setText('auditTypeCount', String(Object.keys(typeMap).length));
    setText('auditAuthCount', fmtNum(authCount));
    setText('auditSecurityCount', fmtNum(securityCount));

    // 按类型分布表格
    const typeTbody = document.querySelector('#auditTypeTable tbody');
    if (typeTbody) {
      const sorted = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) {
        typeTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#8e8e93">暂无数据</td></tr>';
      } else {
        typeTbody.innerHTML = sorted.map(([type, count]) => {
          const pct = events.length ? ((count / events.length) * 100).toFixed(1) : '0.0';
          return `<tr><td>${esc(type)}</td><td>${count}</td><td>${pct}%</td></tr>`;
        }).join('');
      }
    }

    // 最近 10 条
    const recentTbody = document.querySelector('#auditRecentTable tbody');
    if (recentTbody) {
      const recent = events.slice(0, 10);
      if (recent.length === 0) {
        recentTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#8e8e93">暂无数据</td></tr>';
      } else {
        recentTbody.innerHTML = recent.map((e) => {
          const time = e.at ? new Date(e.at).toLocaleString('zh-CN') : '-';
          const actor = e.actor ? (e.actor.username || '-') : '-';
          const detail = summarizePayload(e.payload);
          return `<tr><td style="white-space:nowrap">${esc(time)}</td><td>${esc(e.type || '-')}</td><td>${esc(actor)}</td><td>${esc(detail)}</td></tr>`;
        }).join('');
      }
    }
  } catch {
    auditLoaded = false;
  }
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    initDashboardViews();
    const overview = await loadOverview();
    renderPage(overview);
    const completeness = await checkAdminCompleteness();
    renderCompleteness(completeness);

    // Auto-refresh every 30s
    setInterval(async () => {
      try {
        const fresh = await loadOverview();
        renderPage(fresh);
      } catch {}
    }, 30000);
  } catch (error) {
    setText('summary', '数据加载失败，请检查登录状态或权限配置。');
    setText('statusHeadline', String(error && error.message ? error.message : '加载失败'));
    renderList('opsChecklist', []);
    renderList('qualityList', []);
    renderList('focusList', []);
    renderList('completenessList', []);
    setText('completenessSummary', '功能完备度检查失败，请检查权限或服务状态。');
  }
})();
