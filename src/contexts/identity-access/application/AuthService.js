const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../../../shared/errors');

const PLATFORM_ROLE_PERMISSIONS = {
  platform_admin: ['platform:*'],
  platform_ops: [
    'platform:tenant:read',
    'platform:monitoring:read',
    'platform:config:read',
    'platform:audit:read'
  ]
};

const TENANT_ROLE_PERMISSIONS = {
  tenant_admin: [
    'tenant:instance:read', 'tenant:instance:write',
    'tenant:asset:read', 'tenant:asset:write', 'tenant:asset:review',
    'tenant:skill:read', 'tenant:skill:write', 'tenant:skill:review',
    'tenant:user:read', 'tenant:user:write',
    'tenant:audit:read',
    'tenant:gateway:read', 'tenant:gateway:write',
    // Control API compat
    'control:instance:read', 'control:instance:write', 'control:instance:invoke',
    'control:skill:read', 'control:skill:write', 'control:skill:review',
    'control:asset:read', 'control:asset:write', 'control:asset:review', 'control:asset:bind',
    'control:audit:read', 'control:audit:export',
    'control:runtime:read', 'control:runtime:write',
    'control:release:read'
  ],
  tenant_ops: [
    'tenant:instance:read', 'tenant:instance:write',
    'tenant:asset:read', 'tenant:skill:read',
    // Control API compat
    'control:instance:read', 'control:instance:write', 'control:instance:invoke',
    'control:skill:read',
    'control:asset:read', 'control:asset:write', 'control:asset:bind',
    'control:runtime:read', 'control:runtime:write',
    'control:release:read'
  ],
  tenant_auditor: [
    'tenant:instance:read',
    'tenant:asset:read', 'tenant:skill:read',
    'tenant:audit:read',
    // Control API compat
    'control:instance:read', 'control:skill:read',
    'control:asset:read', 'control:asset:review',
    'control:audit:read', 'control:audit:export'
  ]
};

// Legacy roles mapped to new system for backward compatibility
const LEGACY_ROLE_MAP = {
  platform_admin: { scope: 'platform', role: 'platform_admin' },
  ops_admin: { scope: 'tenant', role: 'tenant_ops' },
  reviewer: { scope: 'tenant', role: 'tenant_admin' },
  auditor: { scope: 'tenant', role: 'tenant_auditor' }
};

const ROLE_PERMISSIONS = {
  ...PLATFORM_ROLE_PERMISSIONS,
  ...TENANT_ROLE_PERMISSIONS,
  // Legacy compat — keep old role names working during migration
  ops_admin: TENANT_ROLE_PERMISSIONS.tenant_ops,
  reviewer: TENANT_ROLE_PERMISSIONS.tenant_admin,
  auditor: TENANT_ROLE_PERMISSIONS.tenant_auditor
};

function resolveScope(role) {
  if (PLATFORM_ROLE_PERMISSIONS[role]) return 'platform';
  if (TENANT_ROLE_PERMISSIONS[role]) return 'tenant';
  const mapped = LEGACY_ROLE_MAP[role];
  return mapped ? mapped.scope : 'tenant';
}

class AuthService {
  constructor(config, repo) {
    this.config = config;
    this.repo = repo || null;
    this.users = Array.isArray(config.controlPlaneUsers) ? config.controlPlaneUsers : [];
  }

  async getMergedUsers() {
    const envUsers = this.users.map((u) => ({ ...u, source: 'env' }));
    if (!this.repo) return envUsers;
    const dynamicUsers = await this.repo.listPlatformUsers();
    const dynamicMap = new Map();
    for (const u of dynamicUsers) dynamicMap.set(u.username, { ...u, source: 'dynamic' });
    const merged = [];
    const seen = new Set();
    for (const u of dynamicUsers) {
      merged.push({ ...u, source: 'dynamic' });
      seen.add(u.username);
    }
    for (const u of envUsers) {
      if (!seen.has(u.username)) merged.push(u);
    }
    return merged;
  }

  resolvePermissions(role) {
    const list = ROLE_PERMISSIONS[String(role || '').trim()] || [];
    return Array.from(new Set(list));
  }

  async verifyPassword(inputPassword, storedPassword) {
    const input = String(inputPassword || '');
    const stored = String(storedPassword || '');
    if (!stored) return false;
    if (stored.startsWith('plain:')) {
      return input === stored.slice(6);
    }
    if (stored.startsWith('bcrypt:')) {
      return bcrypt.compare(input, stored.slice(7));
    }
    return false;
  }

  async login(username, password, options = {}) {
    const allUsers = await this.getMergedUsers();
    const user = allUsers.find((u) => String(u.username || '') === String(username || '').trim());
    if (!user || user.disabled) {
      throw new AppError('invalid username or password', 401, 'AUTH_LOGIN_FAILED');
    }
    const ok = await this.verifyPassword(password, user.password);
    if (!ok) {
      throw new AppError('invalid username or password', 401, 'AUTH_LOGIN_FAILED');
    }

    const role = String(user.role || '').trim();
    const scope = user.scope || resolveScope(role);
    const tenantId = user.tenantId || null;
    const permissions = this.resolvePermissions(role);

    // Validate scope matches requested login type
    if (options.requiredScope && scope !== options.requiredScope) {
      throw new AppError('invalid credentials for this console', 401, 'AUTH_SCOPE_MISMATCH');
    }

    // Tenant login: resolve tenantId (explicit > user config > options > default)
    const defaultTenantId = (this.config && this.config.defaultTenantId) || 'tn_default';
    const effectiveTenantId = scope === 'tenant'
      ? (tenantId || options.tenantId || defaultTenantId)
      : null;

    const payload = {
      sub: user.username,
      scope,
      role,
      tenantId: effectiveTenantId,
      permissions
    };
    const token = jwt.sign(payload, this.config.controlPlaneJwtSecret, {
      expiresIn: this.config.controlPlaneJwtExpiresInSec
    });

    return {
      token,
      tokenType: 'Bearer',
      expiresInSec: this.config.controlPlaneJwtExpiresInSec,
      user: {
        username: user.username,
        scope,
        role,
        tenantId: effectiveTenantId,
        permissions
      }
    };
  }

  authenticateControlRequest(authHeader) {
    const raw = String(authHeader || '').trim();
    if (!raw.startsWith('Bearer ')) {
      throw new AppError('bearer token required', 401, 'AUTH_REQUIRED');
    }
    const token = raw.slice(7).trim();
    if (!token) {
      throw new AppError('bearer token required', 401, 'AUTH_REQUIRED');
    }

    if (token === this.config.controlPlaneAdminToken) {
      return {
        username: 'legacy-admin-token',
        scope: 'platform',
        role: 'platform_admin',
        tenantId: null,
        permissions: ['platform:*']
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, this.config.controlPlaneJwtSecret);
    } catch {
      throw new AppError('invalid token', 403, 'AUTH_FORBIDDEN');
    }
    return {
      username: String(decoded.sub || ''),
      scope: String(decoded.scope || 'tenant'),
      role: String(decoded.role || ''),
      tenantId: decoded.tenantId || null,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : []
    };
  }

  ensurePermission(principal, permission) {
    const requested = String(permission || '').trim();
    if (!requested) return true;
    const perms = Array.isArray(principal && principal.permissions) ? principal.permissions : [];
    if (perms.includes('platform:*') || perms.includes(requested)) return true;
    // Legacy wildcard compat
    if (perms.includes('*')) return true;
    throw new AppError(`permission denied: ${requested}`, 403, 'AUTHZ_DENIED');
  }

  verifyMatrixWebhookSecret(headerValue) {
    const token = String(headerValue || '').trim();
    if (!token || token !== this.config.matrixWebhookSecret) {
      throw new AppError('invalid matrix webhook secret', 403, 'MATRIX_WEBHOOK_FORBIDDEN');
    }
    return true;
  }
}

module.exports = {
  AuthService,
  ROLE_PERMISSIONS,
  PLATFORM_ROLE_PERMISSIONS,
  TENANT_ROLE_PERMISSIONS,
  LEGACY_ROLE_MAP
};
