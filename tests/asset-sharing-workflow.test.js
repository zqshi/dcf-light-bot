const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { SkillService } = require('../src/contexts/shared-assets/application/SkillService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('Asset sharing workflow', () => {
  test('tool asset report -> approve -> bind', async () => {
    const filePath = newTempStorePath('asset-sharing');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const service = new SkillService(repo, audit);

    const report = await service.reportAsset({
      assetType: 'tool',
      sourceTenantId: 'tenant_tool_a',
      sourceInstanceId: 'inst_tool_a',
      name: 'pdf-extractor',
      description: 'extract text from pdf'
    });
    expect(report.assetType).toBe('tool');

    const approved = await service.approveReport(report.id, 'reviewer_2');
    expect(approved.sharedSkill.assetType).toBe('tool');

    const binding = await service.bindSharedAsset('tenant_tool_b', approved.sharedSkill.id, 'tool', 'reviewer_2');
    expect(binding.assetType).toBe('tool');

    const sharedTools = await service.listSharedAssets('tool');
    expect(sharedTools.length).toBe(1);

    safeUnlink(filePath);
  });
});
