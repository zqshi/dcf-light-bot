const { nowIso } = require('../../../shared/time');
const { safeJson, maskSecret, summarizeInstanceStates, summarizeAuditWindow, buildDefaultApprovalPolicy } = require('./adminCompatUtils');

function registerAdminCompatRuntimeRoutes(router, context, deps) {
  const listInstances = deps.listInstances;
  const listSharedAssets = deps.listSharedAssets;
  const listSharedAgents = deps.listSharedAgents;
  const openclawConfigState = deps.openclawConfigState;
  const configSnapshots = deps.configSnapshots;
  const MAX_SNAPSHOTS = deps.MAX_SNAPSHOTS;
  const ensureOpenclawConfigHydrated = deps.ensureOpenclawConfigHydrated;
  const buildOpenclawConfigView = deps.buildOpenclawConfigView;
  const syncContextWithOpenclawConfig = deps.syncContextWithOpenclawConfig;
  const applyPersistedOpenclawConfig = deps.applyPersistedOpenclawConfig;
  const userStore = deps.userStore;
  const roleStore = deps.roleStore;

  router.get('/api/admin/overview', async (_req, res) => {
    const [instances, dashboard, audits, sharedSkills, sharedTools, sharedKnowledge, skillBindings, toolBindings, knowledgeBindings, sharedAgents] = await Promise.all([
      listInstances(),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' }),
      context.auditService.list(1000),
      listSharedAssets('skill'),
      listSharedAssets('tool'),
      listSharedAssets('knowledge'),
      (context.assetService || context.skillService).listAssetBindings('skill'),
      (context.assetService || context.skillService).listAssetBindings('tool'),
      (context.assetService || context.skillService).listAssetBindings('knowledge'),
      listSharedAgents()
    ]);
    const instanceSummary = summarizeInstanceStates(instances);
    const totalTasks = audits.filter((x) => {
      const type = String(x.type || '');
      return type.startsWith('instance.') || type.startsWith('admin.instance.');
    }).length;
    const succeededTasks = audits.filter((x) => {
      const type = String(x.type || '');
      return type === 'instance.provisioned' || type === 'admin.instance.started';
    }).length;
    const failedTasks = audits.filter((x) => String(x.type).includes('failed')).length;
    const inProgressTasks = Math.max(0, totalTasks - succeededTasks - failedTasks);
    const successRate = totalTasks ? Math.round((succeededTasks / totalTasks) * 100) : 100;
    const now = Date.now();
    const window24h = summarizeAuditWindow(audits, now - (24 * 60 * 60 * 1000));
    const tenants = new Set(instances.map((x) => String((x && x.tenantId) || '').trim()).filter(Boolean));
    const bindingsTotal = (Array.isArray(skillBindings) ? skillBindings.length : 0)
      + (Array.isArray(toolBindings) ? toolBindings.length : 0)
      + (Array.isArray(knowledgeBindings) ? knowledgeBindings.length : 0);
    const disabledUsers = Array.from(userStore.values()).filter((x) => x && x.disabled).length;
    const pendingReviews = Number(dashboard.pendingTotal || 0);
    const overdueReviews = Number(dashboard.overdueTotal || 0);
    const healthLevel = instanceSummary.abnormal > 0 || overdueReviews > 0 ? 'degraded' : 'healthy';
    const sharedTotal = sharedSkills.length + sharedTools.length + sharedKnowledge.length + sharedAgents.length;
    res.json({
      overview: {
        platform: {
          instancesTotal: instanceSummary.total,
          runningInstances: instanceSummary.running,
          abnormalInstances: instanceSummary.abnormal,
          tenantsTotal: tenants.size,
          matrixBoundInstances: instanceSummary.matrixBound,
          stateBreakdown: instanceSummary.byState,
          healthLevel
        },
        assets: {
          sharedSkills: sharedSkills.length,
          sharedTools: sharedTools.length,
          sharedKnowledge: sharedKnowledge.length,
          sharedAgents: sharedAgents.length,
          sharedTotal,
          bindingsTotal,
          pendingReviews,
          overdueReviews
        },
        operations: {
          auditEvents24h: window24h.total,
          adminEvents24h: window24h.admin,
          instanceEvents24h: window24h.instance,
          assetEvents24h: window24h.asset,
          latestEventAt: window24h.latestAt || ''
        },
        security: {
          usersTotal: userStore.size,
          disabledUsers,
          rolesTotal: roleStore.size
        }
      },
      delivery: {
        employeesTotal: instanceSummary.total,
        totalTasks,
        succeededTasks,
        failedTasks,
        inProgressTasks,
        successRate
      },
      governance: {
        waitingApprovalTasks: pendingReviews,
        compensationPendingTasks: 0,
        rollbackTasks: 0,
        p1Incidents: 0
      },
      assets: {
        skillsTotal: sharedSkills.length,
        findingsTotal: sharedKnowledge.length,
        toolsTotal: sharedTools.length,
        sharedAgents: sharedAgents.length,
        sharedTotal,
        bindingsTotal,
        skillReused: 0,
        recurrenceErrors: 0
      },
      runtime: {
        runtimeEnabled: true,
        dialogueEnabled: true,
        queueQueued: 0,
        queueDone: 0,
        backlog: 0,
        phase: healthLevel,
        cycleCount: Math.max(1, Math.floor(totalTasks / 10)),
        manualReviewRequired: overdueReviews > 0
      },
      focus: [
        `当前运行实例 ${instanceSummary.running}/${instanceSummary.total}，异常 ${instanceSummary.abnormal}。`,
        `资产待审批 ${pendingReviews} 项，逾期 ${overdueReviews} 项，建议优先清理积压。`,
        `共享资产 ${sharedTotal} 项（含共享Agent ${sharedAgents.length}），已绑定 ${bindingsTotal} 次，建议持续推动高频能力复用。`
      ]
    });
  });

  router.get('/api/admin/runtime-status', async (_req, res) => {
    const instances = await listInstances();
    const sharedSkills = await listSharedAssets('skill');
    const sharedFindings = await listSharedAssets('knowledge');
    const reports = await (context.assetService || context.skillService).listReportsByStatus('pending_review');
    res.json({
      runtimeEnabled: true,
      llm: { dialogueEnabled: true },
      counters: {
        employees: instances.length,
        tasks: instances.length,
        skills: sharedSkills.length,
        findings: sharedFindings.length
      },
      queue: {
        researchQueued: 0,
        researchDone: 0
      },
      governance: {
        pendingReviews: reports.length
      },
      bootstrap: {
        phase: 'steady',
        cycleCount: 1,
        manualReviewRequired: reports.length > 0
      }
    });
  });

  router.get('/api/admin/runtime/openclaw-config', async (_req, res) => {
    await ensureOpenclawConfigHydrated();
    res.json(buildOpenclawConfigView());
  });

  router.post('/api/admin/runtime/openclaw-config', async (req, res) => {
    await ensureOpenclawConfigHydrated();

    const snapshotId = 'snap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    configSnapshots.unshift({
      id: snapshotId,
      timestamp: nowIso(),
      author: String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin'),
      config: {
        runtime: safeJson(openclawConfigState.runtime, {}),
        providers: safeJson(openclawConfigState.providers, {}),
        permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {})
      },
      label: 'auto-save'
    });
    if (configSnapshots.length > MAX_SNAPSHOTS) {
      configSnapshots.length = MAX_SNAPSHOTS;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const runtime = body.runtime && typeof body.runtime === 'object' ? body.runtime : {};
    const providers = body.providers && typeof body.providers === 'object' ? body.providers : {};
    const deepseekInput = providers.deepseek && typeof providers.deepseek === 'object' ? providers.deepseek : {};
    const minimaxInput = providers.minimax && typeof providers.minimax === 'object' ? providers.minimax : {};
    const template = body.permissionTemplate && typeof body.permissionTemplate === 'object'
      ? body.permissionTemplate
      : {};

    openclawConfigState.runtime.openclawImage = String(runtime.openclawImage || openclawConfigState.runtime.openclawImage || '').trim();
    openclawConfigState.runtime.openclawRuntimeVersion = String(runtime.openclawRuntimeVersion || openclawConfigState.runtime.openclawRuntimeVersion || '').trim();
    openclawConfigState.runtime.openclawSourcePath = String(runtime.openclawSourcePath || openclawConfigState.runtime.openclawSourcePath || '').trim();

    openclawConfigState.providers.deepseek.enabled = Boolean(deepseekInput.enabled);
    openclawConfigState.providers.deepseek.apiBase = String(deepseekInput.apiBase || openclawConfigState.providers.deepseek.apiBase || '').trim();
    openclawConfigState.providers.deepseek.model = String(deepseekInput.model || openclawConfigState.providers.deepseek.model || '').trim();
    if (String(deepseekInput.apiKey || '').trim()) {
      openclawConfigState.providers.deepseek.apiKey = String(deepseekInput.apiKey || '').trim();
    }

    openclawConfigState.providers.minimax.enabled = Boolean(minimaxInput.enabled);
    openclawConfigState.providers.minimax.apiBase = String(minimaxInput.apiBase || openclawConfigState.providers.minimax.apiBase || '').trim();
    openclawConfigState.providers.minimax.model = String(minimaxInput.model || openclawConfigState.providers.minimax.model || '').trim();
    if (String(minimaxInput.apiKey || '').trim()) {
      openclawConfigState.providers.minimax.apiKey = String(minimaxInput.apiKey || '').trim();
    }

    if (Array.isArray(template.commandAllowlist)) {
      openclawConfigState.permissionTemplate.commandAllowlist = template.commandAllowlist
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 200);
    }
    if (template.approvalByRisk && typeof template.approvalByRisk === 'object') {
      openclawConfigState.permissionTemplate.approvalByRisk = safeJson(
        template.approvalByRisk,
        openclawConfigState.permissionTemplate.approvalByRisk
      );
    }

    openclawConfigState.updatedAt = nowIso();
    openclawConfigState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin');
    syncContextWithOpenclawConfig();
    if (context.repo && typeof context.repo.setPlatformConfig === 'function') {
      await context.repo.setPlatformConfig('openclawConfig', {
        runtime: safeJson(openclawConfigState.runtime, {}),
        providers: {
          deepseek: safeJson(openclawConfigState.providers.deepseek, {}),
          minimax: safeJson(openclawConfigState.providers.minimax, {})
        },
        permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {}),
        updatedAt: openclawConfigState.updatedAt,
        updatedBy: openclawConfigState.updatedBy
      });
    }
    await context.auditService.log('admin.runtime.openclaw_config.updated', {
      actor: openclawConfigState.updatedBy,
      runtime: safeJson(openclawConfigState.runtime, {}),
      providers: {
        deepseek: {
          enabled: openclawConfigState.providers.deepseek.enabled,
          apiBase: openclawConfigState.providers.deepseek.apiBase,
          model: openclawConfigState.providers.deepseek.model,
          hasKey: Boolean(String(openclawConfigState.providers.deepseek.apiKey || '').trim())
        },
        minimax: {
          enabled: openclawConfigState.providers.minimax.enabled,
          apiBase: openclawConfigState.providers.minimax.apiBase,
          model: openclawConfigState.providers.minimax.model,
          hasKey: Boolean(String(openclawConfigState.providers.minimax.apiKey || '').trim())
        }
      }
    });
    res.json(buildOpenclawConfigView());
  });

  router.get('/api/admin/runtime/openclaw-config/snapshots', async (_req, res) => {
    await ensureOpenclawConfigHydrated();
    res.json({ snapshots: configSnapshots });
  });

  router.post('/api/admin/runtime/openclaw-config/snapshots/:id/restore', async (req, res) => {
    await ensureOpenclawConfigHydrated();
    const snap = configSnapshots.find((s) => s.id === req.params.id);
    if (!snap) {
      return res.status(404).json({ error: '快照不存在' });
    }
    applyPersistedOpenclawConfig({
      runtime: safeJson(snap.config.runtime, {}),
      providers: safeJson(snap.config.providers, {}),
      permissionTemplate: safeJson(snap.config.permissionTemplate, {}),
      updatedAt: nowIso(),
      updatedBy: String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin')
    });
    if (context.repo && typeof context.repo.setPlatformConfig === 'function') {
      await context.repo.setPlatformConfig('openclawConfig', {
        runtime: safeJson(openclawConfigState.runtime, {}),
        providers: {
          deepseek: safeJson(openclawConfigState.providers.deepseek, {}),
          minimax: safeJson(openclawConfigState.providers.minimax, {})
        },
        permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {}),
        updatedAt: openclawConfigState.updatedAt,
        updatedBy: openclawConfigState.updatedBy
      });
    }
    await context.auditService.log('admin.runtime.openclaw_config.restored', {
      actor: openclawConfigState.updatedBy,
      snapshotId: snap.id,
      snapshotTimestamp: snap.timestamp
    });
    res.json(buildOpenclawConfigView());
  });

  router.get('/api/admin/runtime/openclaw-config/snapshots/:id1/diff/:id2', async (_req, res) => {
    await ensureOpenclawConfigHydrated();
    const snap1 = configSnapshots.find((s) => s.id === _req.params.id1);
    const snap2 = configSnapshots.find((s) => s.id === _req.params.id2);
    if (!snap1 || !snap2) {
      return res.status(404).json({ error: '快照不存在' });
    }
    const flat1 = {
      runtime: JSON.stringify(snap1.config.runtime),
      providers: JSON.stringify(snap1.config.providers),
      permissionTemplate: JSON.stringify(snap1.config.permissionTemplate)
    };
    const flat2 = {
      runtime: JSON.stringify(snap2.config.runtime),
      providers: JSON.stringify(snap2.config.providers),
      permissionTemplate: JSON.stringify(snap2.config.permissionTemplate)
    };
    const changes = [];
    const allKeys = new Set([...Object.keys(flat1), ...Object.keys(flat2)]);
    for (const key of allKeys) {
      if (flat1[key] !== flat2[key]) {
        changes.push({ field: key, before: JSON.parse(flat1[key] || '{}'), after: JSON.parse(flat2[key] || '{}') });
      }
    }
    res.json({ changes, snapshot1: snap1.id, snapshot2: snap2.id });
  });

  router.get('/api/admin/bootstrap-status', async (_req, res) => {
    const reports = await (context.assetService || context.skillService).listReportsByStatus('pending_review');
    res.json({
      phase: 'steady',
      cycleCount: 1,
      manualReviewRequired: reports.length > 0,
      checks: [
        { key: 'matrix', ok: true, label: 'Matrix relay ready' },
        { key: 'openclaw', ok: true, label: 'OpenClaw runtime ready' },
        { key: 'control', ok: true, label: 'Control-plane ready' }
      ]
    });
  });
}

module.exports = { registerAdminCompatRuntimeRoutes };
