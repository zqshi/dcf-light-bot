const express = require('express');

async function tryAuditLog(auditService, type, payload) {
  if (!auditService || typeof auditService.log !== 'function') {
    return;
  }
  await auditService.log(type, payload);
}

function buildAuthRouter(authService, auditService) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const body = req.body || {};
      const result = await authService.login(body.username || '', body.password || '');
      await tryAuditLog(auditService, 'auth.login.succeeded', {
        username: result.user.username,
        role: result.user.role
      });
      res.json({ success: true, data: result });
    } catch (error) {
      await tryAuditLog(auditService, 'auth.login.failed', {
        username: String((req.body || {}).username || ''),
        reason: String(error.message || 'login failed')
      });
      next(error);
    }
  });

  router.get('/me', async (req, res, next) => {
    try {
      const principal = authService.authenticateControlRequest(req.headers.authorization || '');
      res.json({ success: true, data: principal });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildAuthRouter };
