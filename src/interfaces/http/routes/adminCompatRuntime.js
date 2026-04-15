const { nowIso } = require('../../../shared/time');
const { safeJson, summarizeInstanceStates } = require('./adminCompatUtils');

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

  router.get('/api/admin/overview', async (req, res) => {
    const [instances, dashboard] = await Promise.all([
      listInstances(req.tenantId),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' })
    ]);
    const instanceSummary = summarizeInstanceStates(instances);
    const disabledUsers = Array.from(userStore.values()).filter((x) => x && x.disabled).length;
    const pendingReviews = Number(dashboard.pendingTotal || 0);
    const overdueReviews = Number(dashboard.overdueTotal || 0);
    const healthLevel = instanceSummary.abnormal > 0 || overdueReviews > 0 ? 'degraded' : 'healthy';

    const tips = [];
    const providers = (openclawConfigState && openclawConfigState.providers) || {};
    const dsOk = providers.deepseek && providers.deepseek.enabled && String(providers.deepseek.apiKey || '').trim();
    const mmOk = providers.minimax && providers.minimax.enabled && String(providers.minimax.apiKey || '').trim();
    if (!dsOk && !mmOk) {
      tips.push('DeepSeek 和 MiniMax 均未启用或缺少 API Key，AI 能力不可用，请前往运行时配置页面完成接入。');
    } else if (!dsOk) {
      tips.push('DeepSeek 未启用或缺少 API Key，建议在运行时配置中补齐。');
    } else if (!mmOk) {
      tips.push('MiniMax 未启用或缺少 API Key，安全模型通道不可用。');
    }
    const gwStores = context.gwStores || {};
    if (gwStores.riskRuleStore) {
      const disabledHigh = [];
      for (const rule of gwStores.riskRuleStore.values()) {
        if (!rule.isEnabled && rule.severity === 'high') disabledHigh.push(rule.displayName || rule.ruleId);
      }
      if (disabledHigh.length) {
        tips.push(`${disabledHigh.length} 条高危风控规则已禁用（${disabledHigh.slice(0, 3).join('、')}），存在安全风险。`);
      }
    }
    if (instanceSummary.abnormal > 0) {
      tips.push(`${instanceSummary.abnormal} 个实例处于异常状态，建议立即排查。`);
    }
    if (overdueReviews > 0) {
      tips.push(`${overdueReviews} 项资产审批已逾期，建议优先处理。`);
    } else if (pendingReviews > 3) {
      tips.push(`待审批资产 ${pendingReviews} 项，建议及时清理积压。`);
    }
    if (tips.length === 0) {
      tips.push('系统运行正常，各项指标无异常。');
    }

    res.json({
      overview: {
        platform: {
          instancesTotal: instanceSummary.total,
          runningInstances: instanceSummary.running,
          abnormalInstances: instanceSummary.abnormal,
          healthLevel
        },
        assets: { pendingReviews, overdueReviews },
        security: { disabledUsers }
      },
      focus: tips
    });
  });

  router.get('/api/admin/runtime-status', async (req, res) => {
    const instances = await listInstances(req.tenantId);
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
        permissionTemplate: safeJson(openclawConfigState.permissionTemplate, {}),
        retention: safeJson(openclawConfigState.retention, {})
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

    const retentionInput = body.retention && typeof body.retention === 'object' ? body.retention : null;
    if (retentionInput) {
      const prev = openclawConfigState.retention || {};
      const ttl = Number(retentionInput.auditLogTtlDays);
      const maxRows = Number(retentionInput.auditLogMaxRows);
      const ringSize = Number(retentionInput.archiveRingSize);
      openclawConfigState.retention = {
        auditLogTtlDays: Number.isFinite(ttl) && ttl > 0 ? Math.round(ttl) : (prev.auditLogTtlDays || 90),
        auditLogMaxRows: Number.isFinite(maxRows) && maxRows > 0 ? Math.round(maxRows) : (prev.auditLogMaxRows || 100000),
        archiveEnabled: retentionInput.archiveEnabled !== false,
        archiveRingSize: Number.isFinite(ringSize) && ringSize > 0 ? Math.round(ringSize) : (prev.archiveRingSize || 3)
      };
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
        retention: safeJson(openclawConfigState.retention, {}),
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
      retention: safeJson(snap.config.retention, {}),
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
        retention: safeJson(openclawConfigState.retention, {}),
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
