const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { OpenClawProvisioner } = require('../src/infrastructure/k8s/OpenClawProvisioner');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { InstanceService } = require('../src/contexts/tenant-instance/application/InstanceService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('InstanceService idempotency', () => {
  test('returns same instance with same requestId', async () => {
    const filePath = newTempStorePath('instance-idempotent');
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

    const a = await service.createFromMatrix({ name: 'ops-agent', creator: '@u:matrix', requestId: 'mx-1' });
    const b = await service.createFromMatrix({ name: 'ops-agent', creator: '@u:matrix', requestId: 'mx-1' });

    expect(a.id).toBe(b.id);
    expect((await service.list()).length).toBe(1);

    safeUnlink(filePath);
  });
});
