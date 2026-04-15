const { TenantService } = require('../src/contexts/tenant-management/application/TenantService');

function createMockRepo() {
  const tenants = [];
  const instances = [];
  return {
    tenants,
    instances,
    listTenants: async () => [...tenants],
    getTenant: async (id) => tenants.find((t) => t.id === id) || null,
    saveTenant: async (t) => {
      const idx = tenants.findIndex((x) => x.id === t.id);
      if (idx >= 0) tenants[idx] = t;
      else tenants.push(t);
      return t;
    },
    deleteTenant: async (id) => {
      const idx = tenants.findIndex((x) => x.id === id);
      if (idx >= 0) { tenants.splice(idx, 1); return true; }
      return false;
    },
    listInstances: async (tenantId) => {
      if (tenantId) return instances.filter((i) => i.tenantId === tenantId);
      return [...instances];
    }
  };
}

describe('TenantService', () => {
  let service, repo;

  beforeEach(() => {
    repo = createMockRepo();
    service = new TenantService(repo);
  });

  it('creates a tenant', async () => {
    const t = await service.create({ name: 'Acme', slug: 'acme' });
    expect(t.id).toMatch(/^tn_/);
    expect(t.name).toBe('Acme');
    expect(t.status).toBe('active');
    expect(repo.tenants).toHaveLength(1);
  });

  it('rejects duplicate slug', async () => {
    await service.create({ name: 'A', slug: 'dup' });
    await expect(service.create({ name: 'B', slug: 'dup' })).rejects.toThrow('already exists');
  });

  it('lists tenants with filters', async () => {
    await service.create({ name: 'A', slug: 'aa', plan: 'free' });
    await service.create({ name: 'B', slug: 'bb', plan: 'standard' });
    const free = await service.list({ plan: 'free' });
    expect(free).toHaveLength(1);
    expect(free[0].name).toBe('A');
  });

  it('gets tenant by id', async () => {
    const t = await service.create({ name: 'X', slug: 'xx' });
    const found = await service.getById(t.id);
    expect(found.name).toBe('X');
  });

  it('throws on non-existent id', async () => {
    await expect(service.getById('tn_ghost')).rejects.toThrow('tenant not found');
  });

  it('suspends a tenant', async () => {
    const t = await service.create({ name: 'S', slug: 'ss' });
    const s = await service.suspend(t.id);
    expect(s.status).toBe('suspended');
  });

  it('activates a suspended tenant', async () => {
    const t = await service.create({ name: 'A', slug: 'act' });
    await service.suspend(t.id);
    const a = await service.activate(t.id);
    expect(a.status).toBe('active');
  });

  it('archives a tenant', async () => {
    const t = await service.create({ name: 'A', slug: 'arch' });
    const a = await service.archive(t.id);
    expect(a.status).toBe('archived');
  });

  it('cannot update archived tenant', async () => {
    const t = await service.create({ name: 'A', slug: 'arc2' });
    await service.archive(t.id);
    await expect(service.update(t.id, { name: 'New' })).rejects.toThrow('cannot update archived');
  });

  it('gets usage with instance count', async () => {
    const t = await service.create({ name: 'U', slug: 'usage' });
    repo.instances.push(
      { id: 'i1', tenantId: t.id, state: 'running' },
      { id: 'i2', tenantId: t.id, state: 'stopped' },
      { id: 'i3', tenantId: 'other', state: 'running' }
    );
    const usage = await service.getUsage(t.id);
    expect(usage.usage.instances).toBe(2);
    expect(usage.usage.runningInstances).toBe(1);
  });

  it('checks quota passes when under limit', async () => {
    const t = await service.create({ name: 'Q', slug: 'quota' });
    repo.instances.push({ id: 'i1', tenantId: t.id, state: 'running' });
    const ok = await service.checkQuota(t.id, 'instance');
    expect(ok).toBe(true);
  });

  it('checks quota rejects when exceeded', async () => {
    const t = await service.create({ name: 'Q', slug: 'quota2', plan: 'free' });
    // free plan maxInstances = 3
    repo.instances.push(
      { id: 'i1', tenantId: t.id },
      { id: 'i2', tenantId: t.id },
      { id: 'i3', tenantId: t.id }
    );
    await expect(service.checkQuota(t.id, 'instance')).rejects.toThrow('quota exceeded');
  });

  it('checks quota rejects suspended tenant', async () => {
    const t = await service.create({ name: 'Q', slug: 'quota3' });
    await service.suspend(t.id);
    await expect(service.checkQuota(t.id, 'instance')).rejects.toThrow('not active');
  });
});
