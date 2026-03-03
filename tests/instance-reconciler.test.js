const { InstanceReconciler } = require('../src/contexts/tenant-instance/application/InstanceReconciler');
const { STATE } = require('../src/contexts/tenant-instance/domain/Instance');

function oldIso(msOffset) {
  return new Date(Date.now() - msOffset).toISOString();
}

describe('InstanceReconciler', () => {
  test('marks timed-out provisioning instance as failed and rolls back', async () => {
    const rows = [
      { id: 'inst1', tenantId: 't1', state: STATE.PROVISIONING, updatedAt: oldIso(20000), createdAt: oldIso(20000) }
    ];
    const saved = [];
    const audits = [];
    const repo = {
      listInstances: async () => rows,
      saveInstance: async (row) => saved.push({ ...row })
    };
    const audit = { log: async (type, payload) => audits.push({ type, payload }) };
    const provisioner = { rollback: async () => ({ ok: true }) };
    const reconciler = new InstanceReconciler(repo, audit, provisioner, { timeoutMs: 1000 });

    await reconciler.tick();

    expect(saved).toHaveLength(1);
    expect(saved[0].state).toBe(STATE.FAILED);
    expect(audits.map((x) => x.type)).toEqual([
      'instance.reconciler.rollback',
      'instance.reconciler.timeout'
    ]);
  });

  test('reconciles running instances and records repaired drift', async () => {
    const rows = [
      {
        id: 'inst2',
        tenantId: 't2',
        state: STATE.RUNNING,
        runtime: { namespace: 'ns2' },
        updatedAt: oldIso(100),
        createdAt: oldIso(100)
      }
    ];
    const audits = [];
    const repo = {
      listInstances: async () => rows,
      saveInstance: async () => {}
    };
    const audit = { log: async (type, payload) => audits.push({ type, payload }) };
    const provisioner = {
      reconcile: async () => ({ driftRepaired: true, names: { namespace: 'ns2' } })
    };
    const reconciler = new InstanceReconciler(repo, audit, provisioner, { timeoutMs: 1000 });

    await reconciler.tick();
    expect(audits.map((x) => x.type)).toContain('instance.reconciler.reconciled');
  });
});
