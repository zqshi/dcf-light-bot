const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { SkillService } = require('../src/contexts/shared-assets/application/SkillService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('Skill sharing workflow', () => {
  test('report -> approve -> bind', async () => {
    const filePath = newTempStorePath('skill-sharing');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const service = new SkillService(repo, audit);

    const report = await service.report({
      sourceTenantId: 'tenant_a',
      sourceInstanceId: 'inst_a',
      name: 'quote-builder',
      description: 'create quote drafts'
    });

    const approved = await service.approveReport(report.id, 'reviewer_1');
    expect(approved.report.status).toBe('approved');
    expect(approved.sharedSkill).toBeTruthy();

    const binding = await service.bindSharedSkill('tenant_b', approved.sharedSkill.id, 'reviewer_1');
    expect(binding.tenantId).toBe('tenant_b');

    const shared = await service.listSharedSkills();
    const bindings = await service.listBindings();
    expect(shared.length).toBe(1);
    expect(bindings.length).toBe(1);

    safeUnlink(filePath);
  });
});
