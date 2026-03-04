const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { OpenClawProvisioner } = require('../src/infrastructure/k8s/OpenClawProvisioner');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { InstanceService } = require('../src/contexts/tenant-instance/application/InstanceService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('InstanceService lifecycle', () => {
  test('supports rebuild and remove', async () => {
    const filePath = newTempStorePath('instance-lifecycle');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const cfg = {
      kubernetesSimulationMode: true,
      kubernetesNamespacePrefix: 'dcf',
      platformBaseUrl: 'http://localhost:3000',
      tenantDefaultCpu: '200m',
      tenantDefaultMemory: '512Mi',
      tenantDefaultStorage: '20Gi',
      openclawImage: 'openclaw/openclaw:2026.2.27',
      openclawSourcePath: '/Users/zqs/Downloads/project/dependencies/openclaw'
    };
    const provisioner = new OpenClawProvisioner(cfg);
    const service = new InstanceService(repo, provisioner, audit, cfg);

    const created = await service.createFromMatrix({ name: 'ops-agent', creator: '@u:matrix' });
    expect(created.state).toBe('running');

    const rebuilt = await service.rebuild(created.id);
    expect(rebuilt.id).toBe(created.id);
    expect(rebuilt.state).toBe('running');

    const removed = await service.remove(created.id);
    expect(removed).toEqual({ id: created.id, deleted: true });

    const rows = await service.list();
    expect(rows).toHaveLength(0);

    safeUnlink(filePath);
  });
});

