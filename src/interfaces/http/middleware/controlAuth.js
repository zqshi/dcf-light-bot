const { patchRequestContext } = require('../../../shared/requestContext');
const { AppError } = require('../../../shared/errors');

function buildControlAuthMiddleware(authService) {
  return (req, res, next) => {
    try {
      const principal = authService.authenticateControlRequest(req.headers.authorization || '');
      req.principal = principal;
      patchRequestContext({
        actor: {
          username: principal.username,
          role: principal.role,
          scope: principal.scope || null,
          tenantId: principal.tenantId || null
        }
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

function buildPlatformAuthMiddleware(authService) {
  return (req, res, next) => {
    try {
      const principal = authService.authenticateControlRequest(req.headers.authorization || '');
      if (principal.scope !== 'platform') {
        throw new AppError('platform credentials required', 403, 'AUTH_PLATFORM_REQUIRED');
      }
      req.principal = principal;
      patchRequestContext({
        actor: {
          username: principal.username,
          role: principal.role,
          scope: 'platform',
          tenantId: null
        }
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

function buildTenantAuthMiddleware(authService) {
  return (req, res, next) => {
    try {
      const principal = authService.authenticateControlRequest(req.headers.authorization || '');
      if (principal.scope === 'platform') {
        // Platform users can access tenant API if X-Tenant-Id header is set
        const viewAsTenant = String(req.headers['x-tenant-id'] || '').trim();
        req.principal = { ...principal, tenantId: viewAsTenant || null };
      } else if (principal.scope === 'tenant') {
        if (!principal.tenantId) {
          throw new AppError('tenant context required', 403, 'AUTH_TENANT_REQUIRED');
        }
        req.principal = principal;
      } else {
        throw new AppError('invalid auth scope', 403, 'AUTH_SCOPE_INVALID');
      }
      patchRequestContext({
        actor: {
          username: req.principal.username,
          role: req.principal.role,
          scope: req.principal.scope,
          tenantId: req.principal.tenantId || null
        }
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

function buildPermissionMiddleware(authService, permission) {
  return (req, res, next) => {
    try {
      authService.ensurePermission(req.principal, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  buildControlAuthMiddleware,
  buildPlatformAuthMiddleware,
  buildTenantAuthMiddleware,
  buildPermissionMiddleware
};
