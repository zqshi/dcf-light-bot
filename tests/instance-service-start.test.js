const { InstanceService } = require('../src/contexts/tenant-instance/application/InstanceService');

describe('InstanceService.start', () => {
  test('uses provisioner.provision to rebuild runtime before running', async () => {
    const repo = {
      getInstance: async () => ({
        id: 'inst1',
        tenantId: 't1',
        name: 'agent1',
        state: 'stopped',
        runtime: { endpoint: 'http://old' }
      }),
      saveInstance: async (row) => row
    };
    const provisioner = {
      provision: async () => ({
        endpoint: 'http://new',
        namespace: 'dcf-t1'
      })
    };
    const auditEvents = [];
    const audit = { log: async (type) => auditEvents.push(type) };
    const service = new InstanceService(repo, provisioner, audit, { platformBaseUrl: 'http://localhost:3000' });

    const out = await service.start('inst1');
    expect(out.state).toBe('running');
    expect(out.runtime.endpoint).toBe('http://new');
    expect(auditEvents).toContain('instance.started');
  });
});
