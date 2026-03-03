const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { SkillService } = require('../src/contexts/shared-assets/application/SkillService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

function isoAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

describe('Asset review SLA', () => {
  test('escalates overdue pending reviews and exposes dashboard', async () => {
    const filePath = newTempStorePath('asset-review-sla');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const audit = new AuditService(repo);
    const service = new SkillService(repo, audit);

    const report = await service.reportAsset({
      assetType: 'skill',
      sourceTenantId: 'tenant_sla',
      sourceInstanceId: 'inst_sla',
      name: 'sla-check',
      description: 'sla check',
      requiredApprovals: 2,
      slaHours: 1
    });
    report.createdAt = isoAgo(3);
    report.slaDueAt = isoAgo(2);
    await repo.updateAssetReport(report);

    const out = await service.escalateOverdueReviews({
      slaHours: 1,
      maxLevel: 3,
      cooldownHours: 0,
      escalateTo: 'platform_admin',
      trigger: 'test'
    });
    expect(out.escalated).toBe(1);

    const updated = await repo.getAssetReport(report.id);
    expect(updated.reviewEscalationLevel).toBe(1);
    expect(updated.lastEscalatedAt).toBeTruthy();

    const dashboard = await service.getReviewDashboard({ slaHours: 1, reviewer: 'reviewer_1' });
    expect(dashboard.pendingTotal).toBe(1);
    expect(dashboard.overdueTotal).toBe(1);
    expect(dashboard.escalatedTotal).toBe(1);
    expect(dashboard.reviewerQueue).toBe(1);

    safeUnlink(filePath);
  });
});
