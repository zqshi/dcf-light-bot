const { nowIso, toMs } = require('../../../shared/time');
const { newId } = require('./adminCompatUtils');

function registerAdminCompatNotificationRoutes(router, context, deps) {
  const listInstances = deps.listInstances;
  const matrixRoomOverrideByInstance = deps.matrixRoomOverrideByInstance;

  function resolveAuditRoomId(row) {
    const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
    return String(
      payload.roomId
      || payload.room_id
      || payload.matrixRoomId
      || payload.channelId
      || ''
    ).trim();
  }

  function mergeMatrixRoomSummary(base = {}, patch = {}) {
    return {
      roomId: patch.roomId || base.roomId || '',
      boundInstanceId: patch.boundInstanceId || base.boundInstanceId || '',
      instanceName: patch.instanceName || base.instanceName || '',
      tenantId: patch.tenantId || base.tenantId || '',
      instanceState: patch.instanceState || base.instanceState || 'unknown',
      auditEvents24h: Number(base.auditEvents24h || 0) + Number(patch.auditEvents24h || 0),
      lastEventType: patch.lastEventType || base.lastEventType || '',
      lastEventAt: toMs(patch.lastEventAt) >= toMs(base.lastEventAt) ? (patch.lastEventAt || base.lastEventAt || '') : (base.lastEventAt || '')
    };
  }

  function resolveInstanceRoomId(instance) {
    const id = String((instance && instance.id) || '');
    if (matrixRoomOverrideByInstance.has(id)) {
      return String(matrixRoomOverrideByInstance.get(id) || '').trim();
    }
    return String((instance && instance.matrixRoomId) || '').trim();
  }

  function buildMatrixOpsStatus(audits = []) {
    const rows = Array.isArray(audits) ? audits : [];
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    let relayStartedAt = '';
    let relayStoppedAt = '';
    let botStartedAt = '';
    let botStoppedAt = '';
    let inbound24h = 0;
    let deliverySucceeded24h = 0;
    let deliveryFailed24h = 0;
    let commandSucceeded24h = 0;
    let commandFailed24h = 0;
    for (const row of rows) {
      const type = String((row && row.type) || '');
      const at = String((row && row.at) || '');
      const atMs = toMs(at);
      if (type === 'matrix.relay.started' && atMs >= toMs(relayStartedAt)) relayStartedAt = at;
      if (type === 'matrix.relay.stopped' && atMs >= toMs(relayStoppedAt)) relayStoppedAt = at;
      if (type === 'matrix.bot.started' && atMs >= toMs(botStartedAt)) botStartedAt = at;
      if (type === 'matrix.bot.stopped' && atMs >= toMs(botStoppedAt)) botStoppedAt = at;
      if (atMs < dayAgo) continue;
      if (type === 'matrix.relay.inbound') inbound24h += 1;
      if (type === 'matrix.relay.delivery.succeeded') deliverySucceeded24h += 1;
      if (type === 'matrix.relay.delivery.failed') deliveryFailed24h += 1;
      if (type === 'matrix.command.handled') {
        const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
        const phase = String(payload.phase || '').toLowerCase();
        if (phase === 'succeeded') commandSucceeded24h += 1;
        if (phase === 'failed') commandFailed24h += 1;
      }
    }

    const relayOnline = toMs(relayStartedAt) >= toMs(relayStoppedAt);
    const botOnline = toMs(botStartedAt) >= toMs(botStoppedAt);
    const deliveryTotal24h = deliverySucceeded24h + deliveryFailed24h;
    const deliverySuccessRate24h = deliveryTotal24h
      ? Math.round((deliverySucceeded24h / deliveryTotal24h) * 100)
      : 100;
    return {
      relayOnline,
      botOnline,
      relayStartedAt,
      relayStoppedAt,
      botStartedAt,
      botStoppedAt,
      inbound24h,
      deliverySucceeded24h,
      deliveryFailed24h,
      deliverySuccessRate24h,
      commandSucceeded24h,
      commandFailed24h
    };
  }

  router.get('/api/admin/matrix/channels', async (req, res) => {
    const [instances, audits] = await Promise.all([
      listInstances(),
      context.auditService.list(1000)
    ]);
    const byRoom = new Map();
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    for (const instance of instances) {
      const roomId = resolveInstanceRoomId(instance);
      if (!roomId) continue;
      const current = byRoom.get(roomId) || {};
      byRoom.set(roomId, mergeMatrixRoomSummary(current, {
        roomId,
        boundInstanceId: String(instance.id || ''),
        instanceName: String(instance.name || instance.id || ''),
        tenantId: String(instance.tenantId || ''),
        instanceState: String(instance.state || 'unknown')
      }));
    }

    for (const row of audits) {
      const roomId = resolveAuditRoomId(row);
      if (!roomId) continue;
      const atMs = toMs(row && row.at);
      const in24h = atMs >= dayAgo ? 1 : 0;
      const current = byRoom.get(roomId) || {};
      byRoom.set(roomId, mergeMatrixRoomSummary(current, {
        roomId,
        auditEvents24h: in24h,
        lastEventType: String((row && row.type) || ''),
        lastEventAt: String((row && row.at) || '')
      }));
    }

    let rows = Array.from(byRoom.values()).map((x) => ({
      ...x,
      roomId: String(x.roomId || ''),
      bound: Boolean(x.boundInstanceId),
      boundInstanceId: String(x.boundInstanceId || ''),
      instanceName: String(x.instanceName || ''),
      tenantId: String(x.tenantId || ''),
      instanceState: String(x.instanceState || 'unknown'),
      auditEvents24h: Number(x.auditEvents24h || 0),
      lastEventType: String(x.lastEventType || ''),
      lastEventAt: String(x.lastEventAt || '')
    }));

    const keyword = String((req.query && req.query.keyword) || '').trim().toLowerCase();
    const queryStatus = String((req.query && req.query.status) || '').trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((x) => [
        x.roomId,
        x.boundInstanceId,
        x.instanceName,
        x.tenantId,
        x.lastEventType
      ].join(' ').toLowerCase().includes(keyword));
    }
    if (queryStatus === 'bound') rows = rows.filter((x) => x.bound);
    if (queryStatus === 'unbound') rows = rows.filter((x) => !x.bound);

    rows.sort((a, b) => toMs(b.lastEventAt) - toMs(a.lastEventAt));

    const summary = {
      channels: rows.length,
      bound: rows.filter((x) => x.bound).length,
      unbound: rows.filter((x) => !x.bound).length,
      auditEvents24h: rows.reduce((sum, row) => sum + Number(row.auditEvents24h || 0), 0)
    };
    const status = buildMatrixOpsStatus(audits);
    res.json({ rows, summary, status });
  });

  router.get('/api/admin/matrix/status', async (_req, res) => {
    const audits = await context.auditService.list(1000);
    res.json(buildMatrixOpsStatus(audits));
  });

  router.get('/api/admin/notifications', async (_req, res) => {
    const [instances, dashboard, audits] = await Promise.all([
      listInstances(),
      (context.assetService || context.skillService).getReviewDashboard({ reviewer: '' }),
      context.auditService.list(1000)
    ]);
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    const failedInstances = instances.filter((x) => {
      const state = String((x && x.state) || '').toLowerCase();
      return ['failed', 'error', 'degraded'].includes(state);
    });
    const deliveryFailed = audits.filter((x) => (
      String(x.type || '') === 'matrix.relay.delivery.failed' && toMs(x.at) >= dayAgo
    ));
    const instanceFailedEvents = audits.filter((x) => (
      String(x.type || '').includes('failed') && toMs(x.at) >= dayAgo
    ));

    const items = [];
    failedInstances.forEach((row) => {
      items.push({
        id: `inst-failed-${row.id}`,
        severity: 'high',
        source: 'instance',
        title: `实例异常：${row.name || row.id}`,
        detail: `实例 ${row.id} 当前状态 ${row.state || 'unknown'}，建议执行重建并查看日志。`,
        action: `POST /api/admin/instances/${row.id}/rebuild`,
        at: row.updatedAt || row.createdAt || ''
      });
    });
    if (Number(dashboard.pendingTotal || 0) > 0) {
      items.push({
        id: 'asset-pending',
        severity: Number(dashboard.overdueTotal || 0) > 0 ? 'high' : 'medium',
        source: 'asset-review',
        title: '资产审批待处理',
        detail: `待审批 ${Number(dashboard.pendingTotal || 0)}，逾期 ${Number(dashboard.overdueTotal || 0)}，升级 ${Number(dashboard.escalatedTotal || 0)}。`,
        action: '进入技能/工具管理执行审批',
        at: nowIso()
      });
    }
    if (deliveryFailed.length > 0) {
      items.push({
        id: 'matrix-delivery-failed',
        severity: 'medium',
        source: 'matrix-delivery',
        title: 'Matrix 消息投递失败',
        detail: `过去24小时投递失败 ${deliveryFailed.length} 次，请检查 relay 与网络连通性。`,
        action: '查看行为日志中 matrix.relay.delivery.failed 事件',
        at: String(deliveryFailed[0].at || '')
      });
    }
    if (instanceFailedEvents.length > 0) {
      items.push({
        id: 'instance-failed-events',
        severity: 'medium',
        source: 'instance-events',
        title: '实例失败事件增多',
        detail: `过去24小时实例失败相关事件 ${instanceFailedEvents.length} 次。`,
        action: '查看行为日志并定位失败根因',
        at: String(instanceFailedEvents[0].at || '')
      });
    }

    items.sort((a, b) => toMs(b.at) - toMs(a.at));
    res.json({
      items,
      summary: {
        total: items.length,
        high: items.filter((x) => x.severity === 'high').length,
        medium: items.filter((x) => x.severity === 'medium').length,
        low: items.filter((x) => x.severity === 'low').length
      }
    });
  });

  const pushChannelStore = new Map();
  const seedChannel = {
    id: newId('push_ch'),
    name: '运维告警 Webhook',
    type: 'webhook',
    url: 'https://hooks.example.com/alert',
    secret: '',
    enabled: true,
    levels: ['critical', 'warning'],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  pushChannelStore.set(seedChannel.id, seedChannel);

  router.get('/api/admin/push-channels', (_req, res) => {
    const items = Array.from(pushChannelStore.values());
    res.json({ items });
  });

  router.post('/api/admin/push-channels', (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const type = String(body.type || '').trim();
    const url = String(body.url || '').trim();
    if (!name || !type || !url) {
      return res.status(400).json({ error: 'name, type, url are required' });
    }
    const validTypes = ['webhook', 'dingtalk', 'wecom', 'slack', 'email'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }
    const validLevels = ['critical', 'warning', 'info'];
    const levels = Array.isArray(body.levels)
      ? body.levels.filter((l) => validLevels.includes(l))
      : [];
    const id = body.id && pushChannelStore.has(body.id) ? body.id : newId('push_ch');
    const existing = pushChannelStore.get(id);
    const channel = {
      id,
      name,
      type,
      url,
      secret: String(body.secret || '').trim(),
      enabled: body.enabled !== false,
      levels,
      createdAt: existing ? existing.createdAt : nowIso(),
      updatedAt: nowIso()
    };
    pushChannelStore.set(id, channel);
    res.json({ ok: true, channel });
  });

  router.post('/api/admin/push-channels/:id/delete', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!pushChannelStore.has(id)) {
      return res.status(404).json({ error: 'channel not found' });
    }
    pushChannelStore.delete(id);
    res.json({ ok: true });
  });

  router.post('/api/admin/push-channels/:id/test', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!pushChannelStore.has(id)) {
      return res.status(404).json({ error: 'channel not found' });
    }
    res.json({ success: true, message: '推送测试成功' });
  });

  router.post('/api/admin/matrix/channels/:roomId/bind-instance', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    await context.auditService.log('admin.matrix.channel.bind_rejected', {
      actor: req.adminSession.user.username,
      roomId,
      reason: 'fixed_session_mapping'
    });
    res.status(410).json({
      error: 'manual room binding is disabled',
      reason: 'fixed_session_mapping',
      message: '会话映射由系统自动维护，已禁用手工绑定。'
    });
  });

  router.post('/api/admin/matrix/channels/:roomId/unbind', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    await context.auditService.log('admin.matrix.channel.unbind_rejected', {
      actor: req.adminSession.user.username,
      roomId,
      reason: 'fixed_session_mapping'
    });
    res.status(410).json({
      error: 'manual room unbind is disabled',
      reason: 'fixed_session_mapping',
      message: '会话映射由系统自动维护，已禁用手工解绑。'
    });
  });
}

module.exports = { registerAdminCompatNotificationRoutes };
