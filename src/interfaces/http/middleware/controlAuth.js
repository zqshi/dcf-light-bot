const { patchRequestContext } = require('../../../shared/requestContext');

function buildControlAuthMiddleware(authService) {
  return (req, res, next) => {
    try {
      const principal = authService.authenticateControlRequest(req.headers.authorization || '');
      req.principal = principal;
      patchRequestContext({
        actor: {
          username: principal.username,
          role: principal.role
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

module.exports = { buildControlAuthMiddleware, buildPermissionMiddleware };
