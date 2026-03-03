const express = require('express');
const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function safeJson(input, fallback) {
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return fallback;
  }
}

function normalizePromptLayers(inputLayers = {}) {
  const layers = inputLayers && typeof inputLayers === 'object' ? inputLayers : {};
  return {
    platform: layers.platform && typeof layers.platform === 'object'
      ? { ...layers.platform, id: 'platform', content: String(layers.platform.content || '') }
      : { id: 'platform', content: '' },
    roleTemplates: layers.roleTemplates && typeof layers.roleTemplates === 'object' ? layers.roleTemplates : {},
    tenantPolicies: layers.tenantPolicies && typeof layers.tenantPolicies === 'object' ? layers.tenantPolicies : {},
    userProfiles: layers.userProfiles && typeof layers.userProfiles === 'object' ? layers.userProfiles : {}
  };
}

function buildCompiledPrompt(center) {
  const layers = center && center.layers && typeof center.layers === 'object' ? center.layers : {};
  const platform = layers.platform && typeof layers.platform === 'object' ? String(layers.platform.content || '') : '';
  const roleTemplates = layers.roleTemplates && typeof layers.roleTemplates === 'object' ? Object.values(layers.roleTemplates) : [];
  const tenantPolicies = layers.tenantPolicies && typeof layers.tenantPolicies === 'object' ? Object.values(layers.tenantPolicies) : [];
  const userProfiles = layers.userProfiles && typeof layers.userProfiles === 'object' ? Object.values(layers.userProfiles) : [];
  const parts = [platform.trim()];
  if (roleTemplates.length) parts.push(`# Role Templates\n${roleTemplates.map((x) => String(x.content || '')).join('\n')}`);
  if (tenantPolicies.length) parts.push(`# Tenant Policies\n${tenantPolicies.map((x) => String(x.content || '')).join('\n')}`);
  if (userProfiles.length) parts.push(`# User Profiles\n${userProfiles.map((x) => String(x.content || '')).join('\n')}`);
  return parts.filter(Boolean).join('\n\n').trim();
}

function newId(prefix) {
  return `${String(prefix || 'id')}_${crypto.randomBytes(8).toString('hex')}`;
}

function buildPromptStrategyCompatRouter(context) {
  const router = express.Router();

  const strategyCenterState = {
    maxLoopSteps: 5,
    maxTaskRuntimeMs: 120000,
    retryLimit: 2,
    retryBackoffMs: 3000,
    promptPublishRequiresApproval: true,
    blockOnHighRiskWithoutApproval: true,
    updatedBy: 'system',
    updatedAt: nowIso()
  };
  const promptCenterState = {
    layers: {
      platform: {
        id: 'platform',
        content: ''
      },
      roleTemplates: {},
      tenantPolicies: {},
      userProfiles: {}
    },
    updatedBy: 'system',
    updatedAt: nowIso()
  };
  const promptVersionsState = {
    activeVersionId: '',
    items: []
  };
  const autoevolveRuns = [];

  function ensurePromptVersionSnapshot(name, source = 'manual') {
    const versionId = newId('pv');
    const now = nowIso();
    const row = {
      id: versionId,
      name: String(name || `Prompt ${now}`),
      source: String(source || 'manual'),
      status: strategyCenterState.promptPublishRequiresApproval ? 'pending_approval' : 'published',
      createdAt: now,
      snapshot: safeJson(promptCenterState, promptCenterState)
    };
    promptVersionsState.items.unshift(row);
    if (!promptVersionsState.activeVersionId || row.status === 'published') {
      promptVersionsState.activeVersionId = row.id;
    }
    return row;
  }

  router.get('/api/admin/strategy-center', (_req, res) => {
    res.json(strategyCenterState);
  });

  router.post('/api/admin/strategy-center', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    strategyCenterState.maxLoopSteps = Math.max(1, Number(body.maxLoopSteps || strategyCenterState.maxLoopSteps));
    strategyCenterState.maxTaskRuntimeMs = Math.max(1000, Number(body.maxTaskRuntimeMs || strategyCenterState.maxTaskRuntimeMs));
    strategyCenterState.retryLimit = Math.max(0, Number(body.retryLimit || strategyCenterState.retryLimit));
    strategyCenterState.retryBackoffMs = Math.max(100, Number(body.retryBackoffMs || strategyCenterState.retryBackoffMs));
    strategyCenterState.promptPublishRequiresApproval = body.promptPublishRequiresApproval !== false;
    strategyCenterState.blockOnHighRiskWithoutApproval = body.blockOnHighRiskWithoutApproval !== false;
    strategyCenterState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system');
    strategyCenterState.updatedAt = nowIso();
    await context.auditService.log('admin.strategy.updated', {
      updatedBy: strategyCenterState.updatedBy,
      maxLoopSteps: strategyCenterState.maxLoopSteps,
      maxTaskRuntimeMs: strategyCenterState.maxTaskRuntimeMs,
      retryLimit: strategyCenterState.retryLimit,
      retryBackoffMs: strategyCenterState.retryBackoffMs,
      promptPublishRequiresApproval: strategyCenterState.promptPublishRequiresApproval,
      blockOnHighRiskWithoutApproval: strategyCenterState.blockOnHighRiskWithoutApproval
    });
    res.json(strategyCenterState);
  });

  router.get('/api/admin/prompt-center', (_req, res) => {
    res.json(promptCenterState);
  });

  router.post('/api/admin/prompt-center', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const layers = normalizePromptLayers(body.layers);
    promptCenterState.layers = layers;
    promptCenterState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system');
    promptCenterState.updatedAt = nowIso();
    await context.auditService.log('admin.prompt.center.updated', {
      updatedBy: promptCenterState.updatedBy
    });
    res.json(promptCenterState);
  });

  router.post('/api/admin/prompt-center/compile', (_req, res) => {
    const content = buildCompiledPrompt(promptCenterState);
    res.json({
      content,
      digest: crypto.createHash('sha256').update(content).digest('hex'),
      generatedAt: nowIso()
    });
  });

  router.get('/api/admin/prompt-versions', (_req, res) => {
    res.json({
      activeVersionId: promptVersionsState.activeVersionId,
      items: promptVersionsState.items.map((x) => ({
        id: x.id,
        name: x.name,
        source: x.source,
        status: x.status,
        createdAt: x.createdAt
      }))
    });
  });

  router.post('/api/admin/prompt-versions/publish', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const row = ensurePromptVersionSnapshot(body.name || '', body.source || 'manual');
    if (row.status === 'published') {
      promptCenterState.updatedAt = nowIso();
      promptCenterState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system');
    }
    await context.auditService.log('admin.prompt.version.published', {
      versionId: row.id,
      name: row.name,
      status: row.status
    });
    res.json({
      id: row.id,
      status: row.status,
      activeVersionId: promptVersionsState.activeVersionId
    });
  });

  router.post('/api/admin/prompt-versions/approve', async (req, res) => {
    const versionId = String((req.body && req.body.versionId) || '').trim();
    const row = promptVersionsState.items.find((x) => x.id === versionId);
    if (!row) {
      res.status(404).json({ error: 'version not found' });
      return;
    }
    row.status = 'published';
    promptVersionsState.activeVersionId = row.id;
    promptCenterState.layers = normalizePromptLayers(row.snapshot && row.snapshot.layers);
    promptCenterState.updatedAt = nowIso();
    promptCenterState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system');
    await context.auditService.log('admin.prompt.version.approved', { versionId: row.id });
    res.json({ success: true, activeVersionId: promptVersionsState.activeVersionId });
  });

  router.post('/api/admin/prompt-versions/rollback', async (req, res) => {
    const versionId = String((req.body && req.body.versionId) || '').trim();
    const row = promptVersionsState.items.find((x) => x.id === versionId);
    if (!row) {
      res.status(404).json({ error: 'version not found' });
      return;
    }
    promptVersionsState.activeVersionId = row.id;
    promptCenterState.layers = normalizePromptLayers(row.snapshot && row.snapshot.layers);
    promptCenterState.updatedAt = nowIso();
    promptCenterState.updatedBy = String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system');
    await context.auditService.log('admin.prompt.version.rolled_back', { versionId: row.id });
    res.json({ success: true, activeVersionId: promptVersionsState.activeVersionId });
  });

  router.get('/api/admin/autoevolve/runs', (_req, res) => {
    res.json(autoevolveRuns.map((x) => ({ ...x })));
  });

  router.post('/api/admin/autoevolve/run', async (req, res) => {
    const row = {
      id: newId('run'),
      status: 'completed',
      baseVersionId: promptVersionsState.activeVersionId || '',
      quality: { scoreGain: 0 },
      createdBy: String((req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'system'),
      createdAt: nowIso()
    };
    autoevolveRuns.unshift(row);
    await context.auditService.log('admin.autoevolve.run.created', { runId: row.id, baseVersionId: row.baseVersionId });
    res.json(row);
  });

  router.post('/api/admin/autoevolve/promote', async (req, res) => {
    const runId = String((req.body && req.body.runId) || '').trim();
    const row = autoevolveRuns.find((x) => x.id === runId);
    if (!row) {
      res.status(404).json({ error: 'run not found' });
      return;
    }
    row.status = 'promoted';
    row.promotedAt = nowIso();
    await context.auditService.log('admin.autoevolve.run.promoted', { runId: row.id });
    res.json({ success: true, runId: row.id });
  });

  router.post('/api/admin/autoevolve/revert', async (req, res) => {
    const runId = String((req.body && req.body.runId) || '').trim();
    const row = autoevolveRuns.find((x) => x.id === runId);
    if (!row) {
      res.status(404).json({ error: 'run not found' });
      return;
    }
    row.status = 'reverted';
    row.revertedAt = nowIso();
    await context.auditService.log('admin.autoevolve.run.reverted', { runId: row.id });
    res.json({ success: true, runId: row.id });
  });

  return router;
}

module.exports = { buildPromptStrategyCompatRouter };
