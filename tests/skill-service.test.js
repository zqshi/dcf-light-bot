const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { SkillService } = require('../src/contexts/shared-assets/application/SkillService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('SkillService', () => {
  test('accepts tenant pod skill report', async () => {
    const filePath = newTempStorePath('skill');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const service = new SkillService(repo, audit);

    const report = await service.report({
      sourceTenantId: 'tenant_1',
      sourceInstanceId: 'inst_1',
      name: 'invoice-parser',
      description: 'parse invoices'
    });

    expect(report.status).toBe('pending_review');
    const rows = await service.listReports();
    expect(rows.length).toBe(1);

    safeUnlink(filePath);
  });
});
