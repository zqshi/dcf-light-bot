const { FileStore } = require('../src/infrastructure/persistence/FileStore');
const { ControlPlaneRepository } = require('../src/infrastructure/persistence/ControlPlaneRepository');
const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { newTempStorePath, safeUnlink } = require('./testHelpers');

function isoAgo(days) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

describe('audit retention', () => {
  test('prunes expired/overflow audits and archives removed rows', async () => {
    const filePath = newTempStorePath('audit-retention');
    const store = new FileStore(filePath);
    await store.init();
    const repo = new ControlPlaneRepository(store);
    const service = new AuditService(repo, {
      retentionTtlDays: 7,
      retentionMaxRows: 2,
      archiveEnabled: true,
      archiveMaxRows: 10
    });

    await repo.appendAudit({ id: 'a1', type: 'x', payload: {}, at: isoAgo(40) });
    await repo.appendAudit({ id: 'a2', type: 'x', payload: {}, at: isoAgo(5) });
    await repo.appendAudit({ id: 'a3', type: 'x', payload: {}, at: isoAgo(2) });
    await repo.appendAudit({ id: 'a4', type: 'x', payload: {}, at: isoAgo(1) });

    const stats = await service.pruneRetention('test');
    expect(stats.before).toBe(4);
    expect(stats.kept).toBe(2);
    expect(stats.archived).toBeGreaterThanOrEqual(1);

    const kept = await repo.listAudits(10);
    expect(kept.length).toBe(3);
    const doc = await store.read();
    const archivedIds = (doc.auditArchive || []).map((x) => x.id);
    expect(archivedIds).toContain('a1');
    expect(kept.some((x) => x.type === 'audit.retention.pruned')).toBe(true);

    safeUnlink(filePath);
  });
});
