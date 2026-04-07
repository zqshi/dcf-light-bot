/**
 * Analytics API 路由
 * 从审计日志、实例状态、AI Gateway traces 聚合真实数据，
 * 供 monitor / statistics 页面消费。
 */
const express = require('express');

function buildAdminAnalyticsRouter(context) {
  const router = express.Router();

  // ── helpers ──
  function gwTraces() {
    const stores = context.gwStores;
    if (!stores || !stores.traceStore) return [];
    return Array.from(stores.traceStore.values());
  }

  // ── scope helpers (mirrors frontend isAdminLogType / isServiceLogType / isAgentLogType) ──
  function isAdminLogType(type) {
    const t = String(type || '');
    return t.startsWith('auth.') || t.startsWith('admin.') || t.startsWith('audit.');
  }
  function isServiceLogType(type) {
    const t = String(type || '');
    return t.startsWith('matrix.') || t.startsWith('instance.') || t.startsWith('bootstrap.')
      || t.startsWith('integration.') || t.startsWith('runtime.') || t.startsWith('employee.');
  }
  function isAgentLogType(type) {
    const t = String(type || '');
    return t.startsWith('task.') || t.startsWith('skill.')
      || t.startsWith('runtime.task.') || t.startsWith('integration.compensation.');
  }
  function filterByScope(events, scope) {
    if (scope === 'admin') return events.filter(e => isAdminLogType(e.type));
    if (scope === 'service') return events.filter(e => !isAdminLogType(e.type) && isServiceLogType(e.type));
    if (scope === 'agent') return events.filter(e => isAgentLogType(e.type));
    return events;
  }

  // ── GET /api/admin/analytics/log-stats ──
  router.get('/api/admin/analytics/log-stats', async (req, res) => {
    try {
      const scope = String(req.query.scope || '').trim().toLowerCase();
      const events = await context.auditService.list(5000);
      const scoped = filterByScope(events, scope);

      // --- typeCounts: top 10 event types ---
      const typeMap = new Map();
      for (const evt of scoped) {
        const t = String(evt.type || 'unknown');
        typeMap.set(t, (typeMap.get(t) || 0) + 1);
      }
      const typeCounts = [...typeMap.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // --- hourlyTrend: last 24h by hour ---
      const now = Date.now();
      const h24Ago = now - 24 * 3600 * 1000;
      const hourBuckets = new Map();
      for (let i = 0; i < 24; i++) {
        const d = new Date(now - (23 - i) * 3600 * 1000);
        const key = String(d.getHours()).padStart(2, '0') + ':00';
        hourBuckets.set(key, 0);
      }
      for (const evt of scoped) {
        const at = Date.parse(String(evt.at || ''));
        if (!Number.isFinite(at) || at < h24Ago) continue;
        const d = new Date(at);
        const key = String(d.getHours()).padStart(2, '0') + ':00';
        if (hourBuckets.has(key)) {
          hourBuckets.set(key, hourBuckets.get(key) + 1);
        }
      }
      const hourlyTrend = [...hourBuckets.entries()].map(([hour, count]) => ({ hour, count }));

      // --- actorCounts: top 5 actors ---
      const actorMap = new Map();
      for (const evt of scoped) {
        const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {};
        const actor = String(
          payload.actor_name || payload.updatedBy || payload.actor
          || payload.username || payload.creator || (evt.actor && evt.actor.username) || ''
        ).trim();
        if (!actor) continue;
        actorMap.set(actor, (actorMap.get(actor) || 0) + 1);
      }
      const actorCounts = [...actorMap.entries()]
        .map(([actor, count]) => ({ actor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // --- anomalies: types where last-1h count > 2x average of prior hours ---
      const h1Ago = now - 3600 * 1000;
      const recentTypeMap = new Map();
      const priorTypeMap = new Map();
      let priorHours = 0;
      for (const evt of scoped) {
        const at = Date.parse(String(evt.at || ''));
        if (!Number.isFinite(at)) continue;
        const t = String(evt.type || 'unknown');
        if (at >= h1Ago) {
          recentTypeMap.set(t, (recentTypeMap.get(t) || 0) + 1);
        } else if (at >= h24Ago) {
          priorTypeMap.set(t, (priorTypeMap.get(t) || 0) + 1);
        }
      }
      // prior period spans 23 hours (24h minus the latest 1h)
      priorHours = 23;
      const anomalies = [];
      for (const [type, recentCount] of recentTypeMap.entries()) {
        const priorCount = priorTypeMap.get(type) || 0;
        const avgPerHour = priorHours > 0 ? priorCount / priorHours : 0;
        if (avgPerHour > 0 && recentCount > avgPerHour * 2) {
          anomalies.push({ type, recentCount, avgPerHour: Math.round(avgPerHour * 100) / 100 });
        }
      }

      res.json({ typeCounts, hourlyTrend, actorCounts, anomalies });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/admin/analytics/agent-performance ──
  router.get('/api/admin/analytics/agent-performance', async (req, res) => {
    try {
      const events = await context.auditService.list(2000);
      const agentMap = new Map();

      for (const evt of events) {
        const type = String(evt.type || '');
        if (!type.startsWith('task.')) continue;
        const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {};
        const agentId = String(payload.employeeId || payload.actor || 'unknown');
        if (!agentMap.has(agentId)) agentMap.set(agentId, { name: agentId, succeeded: 0, failed: 0, totalTokens: 0 });
        const agent = agentMap.get(agentId);
        if (type === 'task.succeeded') agent.succeeded++;
        else if (type === 'task.failed') agent.failed++;
      }

      // Enrich with AI Gateway token data
      for (const trace of gwTraces()) {
        const userId = String(trace.userId || '');
        if (agentMap.has(userId)) {
          agentMap.get(userId).totalTokens += Number(trace.totalTokens || 0);
        }
      }

      const rows = [...agentMap.values()].map(a => ({
        name: a.name,
        taskCount: a.succeeded + a.failed,
        succeeded: a.succeeded,
        failed: a.failed,
        successRate: (a.succeeded + a.failed) > 0 ? Math.round(a.succeeded / (a.succeeded + a.failed) * 100) : 100,
        totalTokens: a.totalTokens
      })).sort((a, b) => b.taskCount - a.taskCount).slice(0, 10);

      res.json({ rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/admin/analytics/alerts ──
  router.get('/api/admin/analytics/alerts', async (req, res) => {
    try {
      const alerts = [];
      const now = new Date();
      const oneHourAgo = Date.now() - 3600000;

      // Check instance failures
      const instances = await context.instanceService.list();
      const failedInstances = instances.filter(i => String(i.state) === 'failed' || String(i.state) === 'error');
      if (failedInstances.length > 0) {
        alerts.push({
          level: failedInstances.length >= 3 ? 'critical' : 'warning',
          title: `${failedInstances.length} 个实例处于异常状态`,
          desc: `异常实例: ${failedInstances.slice(0, 3).map(i => i.name || i.id).join(', ')}${failedInstances.length > 3 ? '...' : ''}`,
          time: now.toISOString()
        });
      }

      // Check overdue asset reviews
      if (context.skillService && typeof context.skillService.getReviewDashboard === 'function') {
        try {
          const dashboard = await context.skillService.getReviewDashboard({ reviewer: '' });
          const overdue = Number(dashboard.overdueTotal || 0);
          const pending = Number(dashboard.pendingTotal || 0);
          if (overdue > 0) {
            alerts.push({
              level: overdue >= 5 ? 'critical' : 'warning',
              title: `${overdue} 项资产审批逾期`,
              desc: `共 ${pending} 项待审批，其中 ${overdue} 项已超期`,
              time: now.toISOString()
            });
          }
        } catch (_) { /* service may not exist */ }
      }

      // Check recent audit failures (last 1 hour)
      const events = await context.auditService.list(500);
      const recentFailures = events.filter(e => {
        const at = Date.parse(String(e.at || ''));
        return Number.isFinite(at) && at >= oneHourAgo && String(e.type || '').includes('failed');
      });
      if (recentFailures.length >= 5) {
        alerts.push({
          level: recentFailures.length >= 10 ? 'critical' : 'warning',
          title: `近 1 小时 ${recentFailures.length} 次失败事件`,
          desc: `主要失败类型: ${[...new Set(recentFailures.slice(0, 5).map(e => e.type))].join(', ')}`,
          time: now.toISOString()
        });
      }

      // Check AI Gateway blocked requests
      const traces = gwTraces();
      let blockedCount = 0;
      for (const trace of traces) {
        const at = Date.parse(String(trace.createdAt || ''));
        if (Number.isFinite(at) && at >= oneHourAgo && trace.status === 'blocked') blockedCount++;
      }
      if (blockedCount > 0) {
        alerts.push({
          level: blockedCount >= 5 ? 'warning' : 'info',
          title: `AI Gateway 近 1 小时拦截 ${blockedCount} 次请求`,
          desc: '风险规则命中，请关注是否存在异常调用模式',
          time: now.toISOString()
        });
      }

      // Info: system healthy if no other alerts
      if (alerts.length === 0) {
        alerts.push({ level: 'info', title: '系统运行正常', desc: '当前无异常告警', time: now.toISOString() });
      }

      alerts.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return (order[a.level] || 3) - (order[b.level] || 3);
      });

      res.json({ alerts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/admin/analytics/health ──
  router.get('/api/admin/analytics/health', async (req, res) => {
    try {
      const metrics = [];
      const events = await context.auditService.list(1000);
      const instances = await context.instanceService.list();

      const running = instances.filter(i => String(i.state) === 'running').length;
      const failed = instances.filter(i => String(i.state) === 'failed' || String(i.state) === 'error').length;
      const total = instances.length;

      const availability = total > 0 ? ((total - failed) / total * 100).toFixed(1) + '%' : '100%';
      metrics.push({ label: '实例可用率', value: availability, status: failed === 0 ? 'good' : failed >= 3 ? 'bad' : 'warn' });

      // Compute from AI Gateway traces
      const traces = gwTraces();
      let gwAvg = '-', gwP95 = '-', gwErr = '-', gwBlocked = '-', gwTotal = 0;
      if (traces.length > 0) {
        gwTotal = traces.length;
        const latencies = traces.filter(t => t.latencyMs > 0).map(t => t.latencyMs).sort((a, b) => a - b);
        if (latencies.length > 0) {
          const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
          gwAvg = (avg / 1000).toFixed(1) + 's';
          gwP95 = (latencies[Math.floor(latencies.length * 0.95)] / 1000).toFixed(1) + 's';
        }
        const failedTraces = traces.filter(t => t.status === 'failed').length;
        const blockedTraces = traces.filter(t => t.status === 'blocked').length;
        gwErr = (failedTraces / traces.length * 100).toFixed(1) + '%';
        gwBlocked = (blockedTraces / traces.length * 100).toFixed(1) + '%';
      }

      metrics.push({ label: 'Gateway 平均延迟', value: gwAvg, status: 'good' });
      metrics.push({ label: 'Gateway P95 延迟', value: gwP95, status: gwP95 !== '-' && parseFloat(gwP95) > 5 ? 'warn' : 'good' });
      metrics.push({ label: 'Gateway 错误率', value: gwErr, status: gwErr !== '-' && parseFloat(gwErr) > 5 ? 'warn' : 'good' });
      metrics.push({ label: 'Gateway 拦截率', value: gwBlocked, status: 'good' });
      metrics.push({ label: 'Gateway 总调用', value: String(gwTotal), status: 'good' });
      metrics.push({ label: '运行实例', value: `${running}/${total}`, status: failed > 0 ? 'warn' : 'good' });

      // Audit event rate
      const oneHourAgo = Date.now() - 3600000;
      const recentEvents = events.filter(e => {
        const at = Date.parse(String(e.at || ''));
        return Number.isFinite(at) && at >= oneHourAgo;
      });
      metrics.push({ label: '近 1h 审计事件', value: String(recentEvents.length), status: 'good' });

      res.json({ metrics });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/admin/analytics/dau-trend ──
  router.get('/api/admin/analytics/dau-trend', async (req, res) => {
    try {
      const events = await context.auditService.list(5000);
      const dayActors = new Map();
      const dayMsgCount = new Map();

      for (const evt of events) {
        const at = evt.at ? new Date(evt.at) : null;
        if (!at || Number.isNaN(at.getTime())) continue;
        const day = at.toISOString().slice(5, 10);
        const payload = evt.payload && typeof evt.payload === 'object' ? evt.payload : {};
        const actor = String(payload.actor || payload.actor_name || payload.username || payload.employeeId || '').trim();

        if (!dayActors.has(day)) dayActors.set(day, new Set());
        if (actor) dayActors.get(day).add(actor);
        dayMsgCount.set(day, (dayMsgCount.get(day) || 0) + 1);
      }

      const rows = [...dayActors.entries()]
        .map(([day, actors]) => ({ day, dau: actors.size, msg: dayMsgCount.get(day) || 0 }))
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-14);

      res.json({ rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/admin/analytics/latency-trend ──
  router.get('/api/admin/analytics/latency-trend', async (req, res) => {
    try {
      const dayLatencies = new Map();
      for (const trace of gwTraces()) {
        const at = trace.createdAt ? new Date(trace.createdAt) : null;
        if (!at || Number.isNaN(at.getTime())) continue;
        const day = at.toISOString().slice(5, 10);
        if (!dayLatencies.has(day)) dayLatencies.set(day, { latencies: [], errors: 0, total: 0 });
        const bucket = dayLatencies.get(day);
        bucket.total++;
        if (trace.latencyMs > 0) bucket.latencies.push(trace.latencyMs);
        if (trace.status === 'failed') bucket.errors++;
      }

      const rows = [...dayLatencies.entries()]
        .map(([day, bucket]) => {
          const sorted = bucket.latencies.sort((a, b) => a - b);
          const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] / 1000 : 0;
          const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] / 1000 : 0;
          const avg = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length / 1000 : 0;
          const errRate = bucket.total > 0 ? (bucket.errors / bucket.total * 100) : 0;
          return {
            day,
            p50: Math.round(p50 * 10) / 10,
            p95: Math.round(p95 * 10) / 10,
            avg: Math.round(avg * 10) / 10,
            err: Math.round(errRate * 10) / 10,
            timeout: 0
          };
        })
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-14);

      res.json({ rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { buildAdminAnalyticsRouter };
