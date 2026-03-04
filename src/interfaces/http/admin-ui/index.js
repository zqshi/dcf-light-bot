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
    { key: 'openclaw', label: 'OpenClaw 配置接口', call: () => checkEndpoint('/api/admin/runtime/openclaw-config') },
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

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    const overview = await loadOverview();
    renderPage(overview);
    const completeness = await checkAdminCompleteness();
    renderCompleteness(completeness);
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
