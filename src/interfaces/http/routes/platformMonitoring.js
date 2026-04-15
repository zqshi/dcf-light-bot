const express = require('express');

/* ── K8s resource string → numeric helpers ── */
function parseCpuMillis(s) {
  if (!s) return 0;
  const str = String(s);
  if (str.endsWith('m')) return parseInt(str, 10) || 0;
  return (parseFloat(str) || 0) * 1000;
}

function parseMemoryMB(s) {
  if (!s) return 0;
  const str = String(s);
  if (str.endsWith('Gi')) return (parseFloat(str) || 0) * 1024;
  if (str.endsWith('Mi')) return parseInt(str, 10) || 0;
  if (str.endsWith('G')) return (parseFloat(str) || 0) * 1000;
  if (str.endsWith('M')) return parseInt(str, 10) || 0;
  return parseInt(str, 10) || 0;
}

function pct(used, total) {
  if (!total || total <= 0) return 0;
  return Math.round((used / total) * 100);
}

function buildPlatformMonitoringRouter(context, requirePermission) {
  const router = express.Router();

  /* ── Platform overview ── */
  router.get('/overview', requirePermission('platform:monitoring:read'), async (req, res, next) => {
    try {
      const tenants = await context.tenantService.list();
      const instances = await context.repo.listInstances();
      const runningInstances = instances.filter((i) => i.state === 'running');
      const failedInstances = instances.filter((i) => i.state === 'failed');

      let totalCpuMillis = 0;
      let totalMemoryMB = 0;
      for (const inst of runningInstances) {
        const r = inst.resources || {};
        totalCpuMillis += parseCpuMillis(r.cpu);
        totalMemoryMB += parseMemoryMB(r.memory);
      }

      res.json({
        success: true,
        data: {
          tenants: {
            total: tenants.length,
            active: tenants.filter((t) => t.status === 'active').length,
            suspended: tenants.filter((t) => t.status === 'suspended').length,
            archived: tenants.filter((t) => t.status === 'archived').length
          },
          instances: {
            total: instances.length,
            running: runningInstances.length,
            stopped: instances.filter((i) => i.state === 'stopped').length,
            failed: failedInstances.length
          },
          resources: {
            allocatedCpuMillis: totalCpuMillis,
            allocatedMemoryMB: totalMemoryMB
          },
          healthLevel: failedInstances.length > 0 ? 'degraded' : 'healthy'
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /* ── Per-tenant resource allocation & quota utilization ── */
  router.get('/resources', requirePermission('platform:monitoring:read'), async (req, res, next) => {
    try {
      const tenants = await context.tenantService.list();
      const instances = await context.repo.listInstances();

      const tenantMap = new Map();
      for (const t of tenants) {
        tenantMap.set(t.id, {
          tenantId: t.id,
          tenantName: t.name,
          slug: t.slug,
          plan: t.plan,
          status: t.status,
          quotas: t.quotas || {},
          modelAccess: t.modelAccess || {},
          instances: { total: 0, running: 0, failed: 0 },
          allocated: { cpuMillis: 0, memoryMB: 0 }
        });
      }

      for (const inst of instances) {
        const entry = tenantMap.get(inst.tenantId);
        if (!entry) continue;
        entry.instances.total++;
        if (inst.state === 'running') {
          entry.instances.running++;
          const r = inst.resources || {};
          entry.allocated.cpuMillis += parseCpuMillis(r.cpu);
          entry.allocated.memoryMB += parseMemoryMB(r.memory);
        }
        if (inst.state === 'failed') entry.instances.failed++;
      }

      const tenantResources = [];
      for (const entry of tenantMap.values()) {
        if (entry.status === 'archived') continue;
        const q = entry.quotas;
        const maxCpuMillis = parseCpuMillis(q.instanceCpu) * (q.maxConcurrentInstances || q.maxInstances || 1);
        const maxMemoryMB = parseMemoryMB(q.instanceMemory) * (q.maxConcurrentInstances || q.maxInstances || 1);

        tenantResources.push({
          ...entry,
          utilization: {
            instances: pct(entry.instances.total, q.maxInstances),
            concurrent: pct(entry.instances.running, q.maxConcurrentInstances || q.maxInstances),
            cpu: pct(entry.allocated.cpuMillis, maxCpuMillis),
            memory: pct(entry.allocated.memoryMB, maxMemoryMB),
            storage: pct(0, q.maxStorageMB)
          }
        });
      }

      res.json({ success: true, data: { tenantResources } });
    } catch (error) {
      next(error);
    }
  });

  /* ── Per-tenant health (enhanced with tenant names) ── */
  router.get('/health', requirePermission('platform:monitoring:read'), async (req, res, next) => {
    try {
      const tenants = await context.tenantService.list();
      const instances = await context.repo.listInstances();

      const nameMap = new Map();
      for (const t of tenants) nameMap.set(t.id, t.name);

      const byTenant = new Map();
      for (const inst of instances) {
        const tid = inst.tenantId || 'unknown';
        if (!byTenant.has(tid)) byTenant.set(tid, { total: 0, running: 0, failed: 0 });
        const bucket = byTenant.get(tid);
        bucket.total++;
        if (inst.state === 'running') bucket.running++;
        if (inst.state === 'failed') bucket.failed++;
      }

      const tenantHealth = [];
      for (const [tenantId, stats] of byTenant) {
        tenantHealth.push({
          tenantId,
          tenantName: nameMap.get(tenantId) || tenantId,
          ...stats,
          health: stats.failed > 0 ? 'degraded' : 'healthy'
        });
      }
      res.json({ success: true, data: { tenantHealth } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildPlatformMonitoringRouter };
