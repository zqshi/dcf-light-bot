const { STATE } = require('../domain/Instance');
const { nowIso } = require('../../../shared/time');

class InstanceReconciler {
  constructor(repo, auditService, provisioner, options = {}) {
    this.repo = repo;
    this.auditService = auditService;
    this.provisioner = provisioner || null;
    this.timeoutMs = Math.max(10_000, Number(options.timeoutMs || 120000));
    this.reconcileRunning = options.reconcileRunning !== false;
    this.rollbackOnTimeout = options.rollbackOnTimeout !== false;
  }

  async tick() {
    const rows = await this.repo.listInstances();
    const now = Date.now();

    for (const row of rows) {
      if (row.state !== STATE.PROVISIONING) continue;
      const updatedAtMs = Date.parse(String(row.updatedAt || row.createdAt || ''));
      if (!Number.isFinite(updatedAtMs)) continue;
      if ((now - updatedAtMs) < this.timeoutMs) continue;

      if (this.rollbackOnTimeout && this.provisioner && typeof this.provisioner.rollback === 'function') {
        try {
          await this.provisioner.rollback(row);
          await this.auditService.log('instance.reconciler.rollback', {
            instanceId: row.id,
            tenantId: row.tenantId,
            reason: 'provision_timeout'
          });
        } catch (rollbackError) {
          await this.auditService.log('instance.reconciler.rollback.failed', {
            instanceId: row.id,
            tenantId: row.tenantId,
            error: String(rollbackError.message || rollbackError)
          });
        }
      }

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

    if (!this.reconcileRunning || !this.provisioner || typeof this.provisioner.reconcile !== 'function') {
      return;
    }

    for (const row of rows) {
      if (row.state !== STATE.RUNNING) continue;
      try {
        const result = await this.provisioner.reconcile(row);
        if (result && result.driftRepaired) {
          await this.auditService.log('instance.reconciler.reconciled', {
            instanceId: row.id,
            tenantId: row.tenantId,
            namespace: result.names && result.names.namespace ? result.names.namespace : row.runtime.namespace
          });
        }
      } catch (error) {
        row.state = STATE.FAILED;
        row.lastError = `reconcile failed: ${String(error.message || error)}`;
        row.updatedAt = nowIso();
        await this.repo.saveInstance(row);
        await this.auditService.log('instance.reconciler.failed', {
          instanceId: row.id,
          tenantId: row.tenantId,
          error: String(error.message || error)
        });
      }
    }
  }
}

module.exports = { InstanceReconciler };
