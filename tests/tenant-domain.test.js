const {
  TENANT_STATUS,
  TENANT_PLAN,
  DEFAULT_QUOTAS,
  validateSlug,
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  archiveTenant
} = require('../src/contexts/tenant-management/domain/Tenant');

describe('Tenant domain', () => {
  describe('validateSlug', () => {
    it('accepts valid slug', () => {
      expect(validateSlug('acme-corp').valid).toBe(true);
      expect(validateSlug('abc123').valid).toBe(true);
    });

    it('rejects empty slug', () => {
      expect(validateSlug('').valid).toBe(false);
      expect(validateSlug(null).valid).toBe(false);
    });

    it('rejects slug starting or ending with hyphen', () => {
      expect(validateSlug('-acme').valid).toBe(false);
      expect(validateSlug('acme-').valid).toBe(false);
    });

    it('rejects uppercase', () => {
      expect(validateSlug('AcmeCorp').valid).toBe(false);
    });

    it('rejects too short slug', () => {
      expect(validateSlug('a').valid).toBe(false);
    });
  });

  describe('createTenant', () => {
    it('creates with required fields', () => {
      const t = createTenant({ name: 'Test Co', slug: 'test-co' });
      expect(t.id).toMatch(/^tn_/);
      expect(t.name).toBe('Test Co');
      expect(t.slug).toBe('test-co');
      expect(t.plan).toBe(TENANT_PLAN.STANDARD);
      expect(t.status).toBe(TENANT_STATUS.ACTIVE);
      expect(t.quotas).toEqual(DEFAULT_QUOTAS[TENANT_PLAN.STANDARD]);
      expect(t.createdAt).toBeDefined();
    });

    it('accepts custom plan and quotas', () => {
      const t = createTenant({
        name: 'Big Co',
        slug: 'big-co',
        plan: 'enterprise',
        quotas: { maxInstances: 200, maxUsers: 1000, maxStorageMB: 500000 }
      });
      expect(t.plan).toBe('enterprise');
      expect(t.quotas.maxInstances).toBe(200);
    });

    it('throws on missing name', () => {
      expect(() => createTenant({ slug: 'no-name' })).toThrow('tenant name is required');
    });

    it('throws on invalid slug', () => {
      expect(() => createTenant({ name: 'X', slug: '' })).toThrow();
    });
  });

  describe('updateTenant', () => {
    it('updates name', () => {
      const t = createTenant({ name: 'Old', slug: 'old' });
      // Force a different timestamp by modifying createdAt
      t.updatedAt = '2020-01-01T00:00:00.000Z';
      const u = updateTenant(t, { name: 'New' });
      expect(u.name).toBe('New');
      expect(u.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    });

    it('updates plan', () => {
      const t = createTenant({ name: 'A', slug: 'aa' });
      const u = updateTenant(t, { plan: 'enterprise' });
      expect(u.plan).toBe('enterprise');
    });

    it('throws on empty name', () => {
      const t = createTenant({ name: 'A', slug: 'aa' });
      expect(() => updateTenant(t, { name: '' })).toThrow('tenant name cannot be empty');
    });

    it('throws on invalid plan', () => {
      const t = createTenant({ name: 'A', slug: 'aa' });
      expect(() => updateTenant(t, { plan: 'ultra' })).toThrow('invalid plan');
    });
  });

  describe('status transitions', () => {
    it('suspends active tenant', () => {
      const t = createTenant({ name: 'A', slug: 'aa' });
      const s = suspendTenant(t);
      expect(s.status).toBe(TENANT_STATUS.SUSPENDED);
    });

    it('activates suspended tenant', () => {
      const t = suspendTenant(createTenant({ name: 'A', slug: 'aa' }));
      const a = activateTenant(t);
      expect(a.status).toBe(TENANT_STATUS.ACTIVE);
    });

    it('archives tenant', () => {
      const t = createTenant({ name: 'A', slug: 'aa' });
      const a = archiveTenant(t);
      expect(a.status).toBe(TENANT_STATUS.ARCHIVED);
    });

    it('cannot suspend archived tenant', () => {
      const t = archiveTenant(createTenant({ name: 'A', slug: 'aa' }));
      expect(() => suspendTenant(t)).toThrow('cannot suspend archived tenant');
    });

    it('cannot activate archived tenant', () => {
      const t = archiveTenant(createTenant({ name: 'A', slug: 'aa' }));
      expect(() => activateTenant(t)).toThrow('cannot activate archived tenant');
    });
  });
});
