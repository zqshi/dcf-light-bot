function buildAdminAuthMiddleware(authService) {
  return (req, res, next) => {
    try {
      const principal = authService.verifyAdminToken(req.headers.authorization || '');
      req.principal = principal;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { buildAdminAuthMiddleware };
