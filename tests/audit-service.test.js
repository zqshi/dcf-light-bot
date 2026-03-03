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
});
