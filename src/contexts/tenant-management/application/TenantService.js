const bcrypt = require('bcryptjs');
const { AppError } = require('../../../shared/errors');
const { nowIso } = require('../../../shared/time');
const {
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  archiveTenant,
  TENANT_STATUS
} = require('../domain/Tenant');

class TenantService {
  constructor(repository) {
    this.repo = repository;
  }

  async list(filters) {
    const all = await this.repo.listTenants();
    if (!filters) return all;
    let result = all;
    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.plan) {
      result = result.filter((t) => t.plan === filters.plan);
    }
    if (filters.q) {
      const q = String(filters.q).toLowerCase();
      result = result.filter((t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.slug || '').toLowerCase().includes(q)
      );
    }
    return result;
  }

  async getById(tenantId) {
    const tenant = await this.repo.getTenant(tenantId);
    if (!tenant) throw new AppError('tenant not found', 404, 'TENANT_NOT_FOUND');
    return tenant;
  }

  async getBySlug(slug) {
    const all = await this.repo.listTenants();
    const tenant = all.find((t) => t.slug === slug && t.status !== TENANT_STATUS.ARCHIVED);
    if (!tenant) throw new AppError('tenant not found', 404, 'TENANT_NOT_FOUND');
    return tenant;
  }

  async create(input) {
    const all = await this.repo.listTenants();
    const existing = all.find((t) => t.slug === input.slug);
    if (existing) throw new AppError(`slug "${input.slug}" already exists`, 409, 'TENANT_SLUG_CONFLICT');
    const tenant = createTenant(input);
    await this.repo.saveTenant(tenant);

    let adminCreated = false;
    if (input.initialAdmin && input.initialAdmin.username) {
      const admin = input.initialAdmin;
      const uname = String(admin.username || '').trim();
      const password = String(admin.password || '').trim();
      if (uname && password) {
        const hash = await bcrypt.hash(password, 10);
        const now = nowIso();
        await this.repo.savePlatformUser({
          username: uname,
          displayName: String(admin.displayName || '').trim(),
          email: String(admin.email || '').trim(),
          role: 'tenant_admin',
          scope: 'tenant',
          tenantId: tenant.id,
          disabled: false,
          password: `bcrypt:${hash}`,
          source: 'dynamic',
          createdAt: now,
          updatedAt: now
        });
        adminCreated = true;
      }
    }

    return { tenant, adminCreated };
  }

  async update(tenantId, patch) {
    const tenant = await this.getById(tenantId);
    if (tenant.status === TENANT_STATUS.ARCHIVED) {
      throw new AppError('cannot update archived tenant', 400, 'TENANT_ARCHIVED');
    }
    if (patch.slug && patch.slug !== tenant.slug) {
      const all = await this.repo.listTenants();
      const conflict = all.find((t) => t.slug === patch.slug && t.id !== tenantId);
      if (conflict) throw new AppError(`slug "${patch.slug}" already exists`, 409, 'TENANT_SLUG_CONFLICT');
    }
    const updated = updateTenant(tenant, patch);
    await this.repo.saveTenant(updated);
    return updated;
  }

  async suspend(tenantId) {
    const tenant = await this.getById(tenantId);
    const suspended = suspendTenant(tenant);
    await this.repo.saveTenant(suspended);
    return suspended;
  }

  async activate(tenantId) {
    const tenant = await this.getById(tenantId);
    const activated = activateTenant(tenant);
    await this.repo.saveTenant(activated);
    return activated;
  }

  async archive(tenantId) {
    const tenant = await this.getById(tenantId);
    const archived = archiveTenant(tenant);
    await this.repo.saveTenant(archived);
    return archived;
  }

  async getUsage(tenantId) {
    const tenant = await this.getById(tenantId);
    const instances = await this.repo.listInstances(tenantId);
    return {
      tenantId,
      tenantName: tenant.name,
      quotas: tenant.quotas,
      usage: {
        instances: instances.length,
        runningInstances: instances.filter((i) => i.state === 'running').length
      }
    };
  }

  async checkQuota(tenantId, resource) {
    const tenant = await this.getById(tenantId);
    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw new AppError('tenant is not active', 403, 'TENANT_NOT_ACTIVE');
    }
    if (resource === 'instance') {
      const instances = await this.repo.listInstances(tenantId);
      if (instances.length >= tenant.quotas.maxInstances) {
        throw new AppError(
          `instance quota exceeded: ${instances.length}/${tenant.quotas.maxInstances}`,
          403,
          'TENANT_QUOTA_EXCEEDED'
        );
      }
    }
    return true;
  }
}

module.exports = { TenantService };
