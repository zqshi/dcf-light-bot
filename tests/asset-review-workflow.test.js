const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { SkillService } = require('../src/contexts/shared-assets/application/SkillService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

describe('Asset multi-level review workflow', () => {
  test('requires two approvals before publishing shared asset', async () => {
    const filePath = newTempStorePath('asset-review');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const service = new SkillService(repo, audit);

    const report = await service.reportAsset({
      assetType: 'knowledge',
      sourceTenantId: 'tenant_ka',
      sourceInstanceId: 'inst_ka',
      name: 'policy-manual',
      description: 'policy docs',
      requiredApprovals: 2
    });
    expect(report.status).toBe('pending_review');

    const r1 = await service.approveReport(report.id, 'reviewer_1', 'looks good');
    expect(r1.report.status).toBe('pending_review');
    expect(r1.stage.remainingApprovals).toBe(1);
    expect(r1.sharedSkill).toBeNull();

    const r2 = await service.approveReport(report.id, 'reviewer_2', 'approved for publish');
    expect(r2.report.status).toBe('approved');
    expect(r2.stage.remainingApprovals).toBe(0);
    expect(r2.sharedSkill).toBeTruthy();

    const history = await service.listReviewHistory(report.id);
    expect(history.length).toBe(2);
    expect(history[0].opinion).toBe('looks good');

    safeUnlink(filePath);
  });
});
