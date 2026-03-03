const { STATE } = require('../domain/Instance');
const { nowIso } = require('../../../shared/time');

class InstanceReconciler {
  constructor(repo, auditService, timeoutMs) {
    this.repo = repo;
    this.auditService = auditService;
    this.timeoutMs = Math.max(10_000, Number(timeoutMs || 120000));
  }

  async tick() {
    const rows = await this.repo.listInstances();
    const now = Date.now();

    for (const row of rows) {
      if (row.state !== STATE.PROVISIONING) continue;
      const updatedAtMs = Date.parse(String(row.updatedAt || row.createdAt || ''));
      if (!Number.isFinite(updatedAtMs)) continue;
      if ((now - updatedAtMs) < this.timeoutMs) continue;

      row.state = STATE.FAILED;
      row.lastError = `provision timeout after ${this.timeoutMs}ms`;
      row.updatedAt = nowIso();
      await this.repo.saveInstance(row);
      await this.auditService.log('instance.reconciler.timeout', {
        instanceId: row.id,
        tenantId: row.tenantId,
        timeoutMs: this.timeoutMs
      });
    }
  }
}

module.exports = { InstanceReconciler };
