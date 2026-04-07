const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${String(prefix || 'id')}_${crypto.randomBytes(8).toString('hex')}`;
}

function toMs(value) {
  if (!value) return 0;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function actorOf(req) {
  return (req.adminSession && req.adminSession.user && req.adminSession.user.username) || 'admin';
}

function normalizeTagList(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 30)
  ));
}

function normalizeSharedAgent(input = {}, seed = {}) {
  const now = nowIso();
  const merged = { ...seed, ...input };
  const source = String(merged.source || seed.source || 'runtime/openclaw').trim();
  const ownerEmployeeId = String(merged.ownerEmployeeId || seed.ownerEmployeeId || '').trim() || null;
  return {
    id: String(seed.id || input.id || newId('shared_agent')),
    name: String(merged.name || '').trim(),
    capabilitySignature: String(merged.capabilitySignature || '').trim(),
    ownerEmployeeId,
    ownerType: String(merged.ownerType || 'shared').trim(),
    source,
    spawnedBy: String(merged.spawnedBy || seed.spawnedBy || '').trim() || null,
    status: String(merged.status || 'active').trim(),
    tags: normalizeTagList(Array.isArray(merged.tags) ? merged.tags : []),
    jobCodes: normalizeTagList(Array.isArray(merged.jobCodes) ? merged.jobCodes : []),
    description: String(merged.description || '').trim(),
    usageCount: Math.max(0, Number(merged.usageCount || seed.usageCount || 0)),
    createdAt: seed.createdAt || now,
    updatedAt: now
  };
}

function parseRuntimeSharedAgentEvent(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  const candidate = payload.agent && typeof payload.agent === 'object' ? payload.agent : payload;
  const name = String(candidate.name || payload.name || '').trim();
  const capabilitySignatureRaw = String(candidate.capabilitySignature || payload.capabilitySignature || '').trim();
  const tags = normalizeTagList(
    Array.isArray(candidate.tags) ? candidate.tags : (Array.isArray(payload.tags) ? payload.tags : [])
  );
  const jobCodes = normalizeTagList(
    Array.isArray(candidate.jobCodes) ? candidate.jobCodes : (Array.isArray(payload.jobCodes) ? payload.jobCodes : [])
  );
  const capabilitySignature = capabilitySignatureRaw || `${name || 'runtime-agent'}:${jobCodes.join(',') || 'general'}`;
  if (!name && !capabilitySignatureRaw) return null;
  return {
    id: String(candidate.id || payload.agentId || '').trim() || undefined,
    name: name || String(candidate.label || payload.label || '子数字员工').trim(),
    capabilitySignature,
    ownerEmployeeId: String(payload.ownerEmployeeId || payload.instanceId || payload.employeeId || payload.sourceInstanceId || '').trim() || null,
    ownerType: 'employee',
    source: 'runtime/openclaw',
    spawnedBy: String(payload.spawnedBy || payload.sender || payload.actor || '').trim() || null,
    status: 'active',
    tags,
    jobCodes,
    description: String(candidate.description || payload.description || '').trim()
  };
}

function registerAdminCompatSharedAgentRoutes(router, context, deps) {
  const sharedAgentStore = deps.sharedAgentStore;
  const sharedAgentRuntimeEventIds = deps.sharedAgentRuntimeEventIds;
  const sharedAgentRuntimeEventIdLimit = deps.sharedAgentRuntimeEventIdLimit;
  let sharedAgentHydrated = false;
  let sharedAgentHydrating = null;

  async function ensureSharedAgentsHydrated() {
    if (sharedAgentHydrated) return;
    if (sharedAgentHydrating) {
      await sharedAgentHydrating;
      return;
    }
    sharedAgentHydrating = (async () => {
      if (context.repo && typeof context.repo.getPlatformConfig === 'function') {
        const persisted = await context.repo.getPlatformConfig('sharedAgentHall');
        const rows = Array.isArray(persisted && persisted.agents) ? persisted.agents : [];
        rows.forEach((row) => {
          const normalized = normalizeSharedAgent(row);
          if (!normalized.name) return;
          sharedAgentStore.set(normalized.id, normalized);
        });
        const processed = Array.isArray(persisted && persisted.runtime && persisted.runtime.processedAuditEventIds)
          ? persisted.runtime.processedAuditEventIds
          : [];
        processed.forEach((id) => {
          const eventId = String(id || '').trim();
          if (!eventId) return;
          sharedAgentRuntimeEventIds.add(eventId);
        });
      }
      sharedAgentHydrated = true;
      sharedAgentHydrating = null;
    })().catch((error) => {
      sharedAgentHydrating = null;
      throw error;
    });
    await sharedAgentHydrating;
  }

  async function persistSharedAgents(actor = 'system') {
    if (!context.repo || typeof context.repo.setPlatformConfig !== 'function') return;
    await context.repo.setPlatformConfig('sharedAgentHall', {
      agents: Array.from(sharedAgentStore.values()),
      runtime: {
        processedAuditEventIds: Array.from(sharedAgentRuntimeEventIds).slice(-sharedAgentRuntimeEventIdLimit)
      },
      updatedAt: nowIso(),
      updatedBy: actor
    });
  }

  function upsertSharedAgentBySignature(input = {}) {
    const normalizedInput = normalizeSharedAgent(input);
    if (!normalizedInput.name || !normalizedInput.capabilitySignature) return { changed: false, row: null };
    const signature = String(normalizedInput.capabilitySignature || '').toLowerCase();
    const existed = Array.from(sharedAgentStore.values()).find((x) => (
      String(x.capabilitySignature || '').toLowerCase() === signature
      && String(x.status || '').toLowerCase() !== 'deleted'
    ));
    if (existed) {
      const next = normalizeSharedAgent({
        ...existed,
        name: existed.name || normalizedInput.name,
        ownerEmployeeId: normalizedInput.ownerEmployeeId || existed.ownerEmployeeId || null,
        ownerType: normalizedInput.ownerType || existed.ownerType || 'employee',
        source: 'runtime/openclaw',
        spawnedBy: normalizedInput.spawnedBy || existed.spawnedBy || null,
        tags: normalizeTagList([...(Array.isArray(existed.tags) ? existed.tags : []), ...(Array.isArray(normalizedInput.tags) ? normalizedInput.tags : [])]),
        jobCodes: normalizeTagList([...(Array.isArray(existed.jobCodes) ? existed.jobCodes : []), ...(Array.isArray(normalizedInput.jobCodes) ? normalizedInput.jobCodes : [])]),
        description: normalizedInput.description || existed.description || '',
        usageCount: Math.max(0, Number(existed.usageCount || 0)) + 1,
        status: 'active'
      }, existed);
      sharedAgentStore.set(existed.id, next);
      return { changed: true, row: next, created: false };
    }
    const created = normalizeSharedAgent({
      ...normalizedInput,
      source: 'runtime/openclaw',
      ownerType: normalizedInput.ownerType || 'employee',
      usageCount: 1,
      status: 'active'
    });
    sharedAgentStore.set(created.id, created);
    return { changed: true, row: created, created: true };
  }

  async function reconcileSharedAgentsFromRuntimeEvents() {
    if (!context.auditService || typeof context.auditService.list !== 'function') return;
    const events = await context.auditService.list(1000);
    const ordered = Array.isArray(events) ? events.slice().reverse() : [];
    let changed = false;
    for (const event of ordered) {
      const type = String(event && event.type || '').trim();
      const eventId = String(event && event.id || '').trim();
      if (!eventId || sharedAgentRuntimeEventIds.has(eventId)) continue;
      if (type !== 'runtime.openclaw.shared_agent.discovered') continue;
      const parsed = parseRuntimeSharedAgentEvent(event);
      if (!parsed) {
        sharedAgentRuntimeEventIds.add(eventId);
        continue;
      }
      const result = upsertSharedAgentBySignature(parsed);
      if (result.changed) changed = true;
      sharedAgentRuntimeEventIds.add(eventId);
      while (sharedAgentRuntimeEventIds.size > sharedAgentRuntimeEventIdLimit) {
        const first = sharedAgentRuntimeEventIds.values().next().value;
        if (!first) break;
        sharedAgentRuntimeEventIds.delete(first);
      }
    }
    if (changed) {
      await persistSharedAgents('runtime/openclaw');
      await context.auditService.log('runtime.openclaw.shared_agent.synced', {
        changed: true,
        total: sharedAgentStore.size
      });
    }
  }

  async function listSharedAgents() {
    await ensureSharedAgentsHydrated();
    await reconcileSharedAgentsFromRuntimeEvents();
    return Array.from(sharedAgentStore.values()).sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
  }

  router.get('/api/admin/agents/shared', async (req, res) => {
    let rows = await listSharedAgents();
    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    const status = String((req.query && req.query.status) || '').trim().toLowerCase();
    const owner = String((req.query && req.query.ownerEmployeeId) || '').trim();
    if (keyword) {
      rows = rows.filter((x) => [
        x.id,
        x.name,
        x.capabilitySignature,
        x.description,
        ...(Array.isArray(x.tags) ? x.tags : [])
      ].join(' ').toLowerCase().includes(keyword));
    }
    if (status) rows = rows.filter((x) => String(x.status || '').toLowerCase() === status);
    if (owner) rows = rows.filter((x) => String(x.ownerEmployeeId || '') === owner);

    const summary = {
      total: rows.length,
      active: rows.filter((x) => String(x.status || '').toLowerCase() === 'active').length,
      paused: rows.filter((x) => String(x.status || '').toLowerCase() === 'paused').length,
      owned: rows.filter((x) => String(x.ownerEmployeeId || '').trim()).length,
      shared: rows.filter((x) => !String(x.ownerEmployeeId || '').trim()).length
    };
    res.json({ rows, summary });
  });

  router.post('/api/admin/agents/shared/register', async (_req, res) => {
    res.status(410).json({
      error: 'manual_register_disabled',
      message: '共享Agent改为运行时自动沉淀模式，不支持后台手工注册。'
    });
  });

  router.post('/api/admin/agents/shared/runtime-events', async (req, res) => {
    await ensureSharedAgentsHydrated();
    const actor = actorOf(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const events = Array.isArray(body.events) ? body.events : [body.event || body];
    let upserted = 0;
    const rows = [];
    for (const item of events) {
      const parsed = parseRuntimeSharedAgentEvent({ payload: item });
      if (!parsed) continue;
      const result = upsertSharedAgentBySignature(parsed);
      if (!result.changed || !result.row) continue;
      upserted += 1;
      rows.push(result.row);
    }
    if (upserted > 0) {
      await persistSharedAgents(`runtime:${actor}`);
      await context.auditService.log('runtime.openclaw.shared_agent.upserted', {
        actor,
        upserted,
        source: 'runtime-events-api'
      });
    }
    res.json({ success: true, upserted, rows });
  });

  router.post('/api/admin/agents/shared/:id', async (_req, res) => {
    res.status(410).json({
      error: 'manual_update_disabled',
      message: '共享Agent改为只读运营视图，不支持后台手工更新。'
    });
  });

  router.post('/api/admin/agents/shared/:id/delete', async (_req, res) => {
    res.status(410).json({
      error: 'manual_delete_disabled',
      message: '共享Agent改为只读运营视图，不支持后台手工删除。'
    });
  });

  router.get('/api/admin/agents/shared/recommend', async (req, res) => {
    const jobCode = String((req.query && req.query.jobCode) || '').trim().toLowerCase();
    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    let rows = (await listSharedAgents()).filter((x) => String(x.status || '').toLowerCase() === 'active');
    if (jobCode) {
      rows = rows.filter((x) => (
        Array.isArray(x.jobCodes) && x.jobCodes.map((k) => String(k || '').toLowerCase()).includes(jobCode)
      ));
    }
    if (keyword) {
      rows = rows.filter((x) => [
        x.name,
        x.capabilitySignature,
        ...(Array.isArray(x.tags) ? x.tags : [])
      ].join(' ').toLowerCase().includes(keyword));
    }
    rows.sort((a, b) => (Number(b.usageCount || 0) - Number(a.usageCount || 0)) || (toMs(b.updatedAt) - toMs(a.updatedAt)));
    res.json({
      rows: rows.slice(0, 30),
      summary: {
        total: rows.length,
        jobCode: jobCode || null,
        keyword: keyword || null
      }
    });
  });

  router.post('/api/admin/agents/shared/auto-bind/:employeeId', async (_req, res) => {
    res.status(410).json({
      error: 'manual_bind_disabled',
      message: '共享Agent改为运行时自动绑定模式，不支持后台手工绑定。'
    });
  });

  return { listSharedAgents, ensureSharedAgentsHydrated };
}

module.exports = { registerAdminCompatSharedAgentRoutes, normalizeTagList, normalizeSharedAgent };
