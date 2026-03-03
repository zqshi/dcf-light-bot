const { AuditService } = require('../src/contexts/audit-observability/application/AuditService');
const { runWithRequestContext } = require('../src/shared/requestContext');

describe('AuditService', () => {
  test('captures request context and supports filtering', async () => {
    const events = [];
    const repo = {
      appendAudit: async (event) => events.unshift(event),
      listAudits: async (limit) => events.slice(0, limit)
    };
    const service = new AuditService(repo);

    await runWithRequestContext(
      { requestId: 'req_1', traceId: 'tr_1', correlationId: 'co_1', actor: { username: 'admin', role: 'platform_admin' } },
      async () => {
        await service.log('instance.started', { tenantId: 't1' });
      }
    );
    await service.log('instance.stopped', { tenantId: 't2' });

    const all = await service.list(10);
    expect(all).toHaveLength(2);
    const one = all.find((x) => x.type === 'instance.started');
    expect(one.requestId).toBe('req_1');
    expect(one.actor.username).toBe('admin');

    const filtered = await service.list(10, { tenantId: 't1', actor: 'admin' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('instance.started');
  });

  test('supports incremental filters and cursor pagination', async () => {
    const events = [
      { id: 'a5', type: 'x', at: '2026-03-03T10:05:00.000Z', payload: { tenantId: 't1' } },
      { id: 'a4', type: 'x', at: '2026-03-03T10:04:00.000Z', payload: { tenantId: 't1' } },
      { id: 'a3', type: 'x', at: '2026-03-03T10:03:00.000Z', payload: { tenantId: 't1' } },
      { id: 'a2', type: 'x', at: '2026-03-03T10:02:00.000Z', payload: { tenantId: 't1' } },
      { id: 'a1', type: 'x', at: '2026-03-03T10:01:00.000Z', payload: { tenantId: 't1' } }
    ];
    const repo = {
      appendAudit: async () => {},
      listAudits: async (limit) => events.slice(0, limit)
    };
    const service = new AuditService(repo);

    const p1 = await service.queryPage(2, { sinceId: 'a3' }, '0');
    expect(p1.rows.map((x) => x.id)).toEqual(['a5', 'a4']);
    expect(p1.nextCursor).toBeNull();

    const p2 = await service.queryPage(2, {}, '0');
    expect(p2.rows.map((x) => x.id)).toEqual(['a5', 'a4']);
    expect(p2.nextCursor).toBe('2');

    const p3 = await service.queryPage(2, {}, p2.nextCursor);
    expect(p3.rows.map((x) => x.id)).toEqual(['a3', 'a2']);
  });
});
