function actorOf(req) {
  return (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeType(raw) {
  const type = String(raw || '').trim().toLowerCase();
  if (['skill', 'skills'].includes(type)) return 'skill';
  if (['tool', 'tools'].includes(type)) return 'tool';
  if (['knowledge', 'oss'].includes(type)) return 'knowledge';
  return type;
}

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function matchKeyword(row, keyword) {
  if (!keyword) return true;
  const needle = String(keyword || '').toLowerCase();
  const hay = [
    row.id,
    row.name,
    row.assetType,
    row.status,
    row.sourceTenantId,
    row.sourceReportId
  ].map((x) => String(x || '').toLowerCase()).join(' ');
  return hay.includes(needle);
}

function filterRows(rows, query = {}) {
  const keyword = String(query.keyword || '').trim();
  const status = String(query.status || '').trim().toLowerCase();
  const sourceTenantId = String(query.sourceTenantId || '').trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (status && String(row.status || '').toLowerCase() !== status) return false;
    if (sourceTenantId && !String(row.sourceTenantId || '').toLowerCase().includes(sourceTenantId)) return false;
    return matchKeyword(row, keyword);
  });
}

function registerAdminCompatAssetRoutes(router, context, deps) {
  const listSharedAssets = deps.listSharedAssets;
  const listAssetReportsByType = deps.listAssetReportsByType;
  const toolServiceStore = deps.toolServiceStore;
  const hydrateToolServices = deps.hydrateToolServices;
  const ossCaseState = deps.ossCaseState;

  router.get('/api/admin/assets/:type', async (req, res) => {
    const type = normalizeType(req.params.type);
    if (!['skill', 'tool', 'knowledge'].includes(type)) {
      res.status(400).json({ error: 'unsupported asset type' });
      return;
    }

    if (type === 'tool' && typeof hydrateToolServices === 'function') {
      await hydrateToolServices();
    }

    const reportsRaw = await listAssetReportsByType(type);
    const reportsPatched = type === 'knowledge'
      ? reportsRaw.map((x) => {
        const patch = ossCaseState.get(String(x.id)) || {};
        return {
          ...x,
          status: patch.status || x.status,
          updatedAt: patch.updatedAt || x.updatedAt
        };
      })
      : reportsRaw;
    const reports = filterRows(reportsPatched, req.query || {});
    const sharedAssets = filterRows(await listSharedAssets(type), req.query || {});
    const bindings = filterRows(await (context.assetService || context.skillService).listAssetBindings(type), req.query || {});
    const toolServices = type === 'tool'
      ? Array.from(toolServiceStore.values()).map((x) => ({ ...x, serviceId: x.id }))
      : [];

    res.json({
      type,
      reports,
      sharedAssets,
      bindings,
      toolServices,
      summary: {
        reports: reports.length,
        sharedAssets: sharedAssets.length,
        bindings: bindings.length,
        toolServices: toolServices.length
      }
    });
  });

  router.get('/api/admin/assets/:type/:id', async (req, res) => {
    const type = normalizeType(req.params.type);
    const id = String(req.params.id || '').trim();
    if (!['skill', 'tool', 'knowledge'].includes(type)) {
      res.status(400).json({ error: 'unsupported asset type' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: 'asset/report id is required' });
      return;
    }

    if (type === 'tool' && typeof hydrateToolServices === 'function') {
      await hydrateToolServices();
    }
    const reportsRaw = await listAssetReportsByType(type);
    const shared = await listSharedAssets(type);
    const bindings = await (context.assetService || context.skillService).listAssetBindings(type);
    const reports = type === 'knowledge'
      ? reportsRaw.map((x) => {
        const patch = ossCaseState.get(String(x.id)) || {};
        return { ...x, status: patch.status || x.status, updatedAt: patch.updatedAt || x.updatedAt };
      })
      : reportsRaw;

    const report = reports.find((x) => String(x.id) === id) || null;
    const sharedAsset = shared.find((x) => String(x.id) === id || String(x.sourceReportId || '') === id) || null;
    const relatedBindings = (Array.isArray(bindings) ? bindings : []).filter((x) => (
      String(x.assetId || '') === id || String(sharedAsset && sharedAsset.id || '') === String(x.assetId || '')
    ));
    const toolService = type === 'tool'
      ? Array.from(toolServiceStore.values()).find((x) => String(x.id) === id) || null
      : null;

    const detail = report || sharedAsset || toolService;
    if (!detail) {
      res.status(404).json({ error: 'asset not found' });
      return;
    }
    res.json({
      type,
      id,
      report,
      sharedAsset,
      bindings: relatedBindings,
      toolService,
      detail
    });
  });

  router.post('/api/admin/assets/:type/reports', async (req, res) => {
    const type = normalizeType(req.params.type);
    if (!['skill', 'tool', 'knowledge'].includes(type)) {
      res.status(400).json({ error: 'unsupported asset type' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const report = await (context.assetService || context.skillService).reportAsset({
      ...body,
      assetType: type
    });
    await context.auditService.log('admin.asset.reported', {
      actor: actorOf(req),
      type,
      reportId: report && report.id
    });
    res.status(201).json({ success: true, report });
  });

  router.post('/api/admin/assets/:type/:id/:action', async (req, res) => {
    const type = normalizeType(req.params.type);
    const id = String(req.params.id || '').trim();
    const action = String(req.params.action || '').trim().toLowerCase();
    const actor = actorOf(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const svc = context.assetService || context.skillService;

    if (!['skill', 'tool', 'knowledge'].includes(type)) {
      res.status(400).json({ error: 'unsupported asset type' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: 'asset/report id is required' });
      return;
    }

    let out = null;
    if (action === 'approve') {
      out = await svc.approveReport(id, actor, String(body.opinion || body.note || '').trim());
      if (type === 'knowledge') {
        const decision = String(body.decision || '').trim();
        if (decision === 'introduce_oss') {
          ossCaseState.set(id, { status: 'approved_introduce', updatedAt: nowIso(), action: 'approve', decision });
        } else if (decision === 'build_in_house') {
          ossCaseState.set(id, { status: 'approved_build', updatedAt: nowIso(), action: 'approve', decision });
        } else if (decision === 'reject') {
          ossCaseState.set(id, { status: 'rejected', updatedAt: nowIso(), action: 'approve', decision });
        }
      }
      await context.auditService.log('admin.asset.approved', { actor, type, id });
      res.json({ success: true, action, type, id, data: out });
      return;
    }
    if (action === 'reject') {
      out = await svc.rejectReport(id, actor, String(body.reason || body.opinion || '').trim());
      await context.auditService.log('admin.asset.rejected', { actor, type, id });
      res.json({ success: true, action, type, id, data: out });
      return;
    }
    if (action === 'publish') {
      const shared = await listSharedAssets(type);
      const existed = shared.find((x) => String(x.sourceReportId || '') === id) || null;
      if (existed) {
        out = { report: { id, status: 'approved' }, sharedAsset: existed, publishState: 'already_published' };
      } else {
        const approved = await svc.approveReport(id, actor, String(body.opinion || 'publish via admin assets api'));
        out = {
          ...approved,
          publishState: 'published'
        };
      }
      await context.auditService.log('admin.asset.published', { actor, type, id });
      res.json({ success: true, action, type, id, data: out });
      return;
    }
    if (action === 'deploy') {
      if (type === 'knowledge') {
        ossCaseState.set(id, { status: 'deploying', updatedAt: nowIso(), action: 'deploy' });
      }
      await context.auditService.log('admin.asset.deployed', { actor, type, id });
      res.json({ success: true, action, type, id, status: type === 'knowledge' ? 'deploying' : 'deployed' });
      return;
    }
    if (action === 'verify') {
      if (type === 'knowledge') {
        ossCaseState.set(id, { status: 'completed', updatedAt: nowIso(), action: 'verify' });
      }
      await context.auditService.log('admin.asset.verified', { actor, type, id });
      res.json({ success: true, action, type, id, status: type === 'knowledge' ? 'completed' : 'verified' });
      return;
    }
    if (action === 'rollback') {
      if (type === 'knowledge') {
        ossCaseState.set(id, { status: 'rolled_back', updatedAt: nowIso(), action: 'rollback' });
      }
      await context.auditService.log('admin.asset.rolled_back', {
        actor,
        type,
        id,
        reason: String(body.reason || '').trim()
      });
      res.json({ success: true, action, type, id, status: 'rollback' });
      return;
    }
    if (action === 'bind') {
      const tenantId = String(body.tenantId || '').trim();
      if (!hasText(tenantId)) {
        res.status(400).json({ error: 'tenantId is required for bind action' });
        return;
      }
      out = await svc.bindSharedAsset(tenantId, id, type, actor);
      await context.auditService.log('admin.asset.bound', { actor, type, id, tenantId });
      res.json({ success: true, action, type, id, tenantId, data: out });
      return;
    }

    res.status(400).json({ error: 'unsupported action' });
  });
}

module.exports = { registerAdminCompatAssetRoutes };
