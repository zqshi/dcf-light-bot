const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { OpenClawProvisioner } = require('../src/infrastructure/k8s/OpenClawProvisioner');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { InstanceService } = require('../src/contexts/tenant-instance/application/InstanceService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('InstanceService', () => {
  test('creates running instance in simulation mode', async () => {
    const filePath = newTempStorePath('instance');
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

    const instance = await service.createFromMatrix({ name: 'ops-agent', creator: '@u:matrix' });
    expect(instance.state).toBe('running');
    expect(instance.runtime.namespace).toContain('dcf-tenant_');

    const rows = await service.list();
    expect(rows.length).toBe(1);
    const card = service.buildMatrixCard(instance);
    expect(card.schema).toBe('dcf.employee-card/v1');
    expect(card.cardType).toBe('digital_employee');
    expect(Array.isArray(card.actions)).toBe(true);
    expect(card.actions[0].type).toBe('open_chat');
    expect(card.instanceId).toBe(instance.id);

    safeUnlink(filePath);
  });
});
