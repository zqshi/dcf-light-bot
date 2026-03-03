const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../../../shared/errors');

const ROLE_PERMISSIONS = {
  platform_admin: ['*'],
  ops_admin: [
    'control:instance:read',
    'control:instance:write',
    'control:instance:invoke',
    'control:asset:read',
    'control:asset:bind',
    'control:skill:read',
    'control:skill:bind'
  ],
  reviewer: [
    'control:asset:read',
    'control:asset:review',
    'control:asset:bind',
    'control:skill:read',
    'control:skill:review',
    'control:skill:bind'
  ],
  auditor: ['control:instance:read', 'control:asset:read', 'control:skill:read', 'control:audit:read']
};

class AuthService {
  constructor(config) {
    this.config = config;
    this.users = Array.isArray(config.controlPlaneUsers) ? config.controlPlaneUsers : [];
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

  async login(username, password) {
    const user = this.users.find((u) => String(u.username || '') === String(username || '').trim());
    if (!user || user.disabled) {
      throw new AppError('invalid username or password', 401, 'AUTH_LOGIN_FAILED');
    }
    const ok = await this.verifyPassword(password, user.password);
    if (!ok) {
      throw new AppError('invalid username or password', 401, 'AUTH_LOGIN_FAILED');
    }

    const permissions = this.resolvePermissions(user.role);
    const payload = {
      sub: user.username,
      role: user.role,
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
        role: user.role,
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
        role: 'platform_admin',
        permissions: ['*']
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
      role: String(decoded.role || ''),
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : []
    };
  }

  ensurePermission(principal, permission) {
    const requested = String(permission || '').trim();
    if (!requested) return true;
    const perms = Array.isArray(principal && principal.permissions) ? principal.permissions : [];
    if (perms.includes('*') || perms.includes(requested)) return true;
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

module.exports = { AuthService, ROLE_PERMISSIONS };
