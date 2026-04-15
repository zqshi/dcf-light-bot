const express = require('express');

function buildPlatformAuthRouter(authService, auditService) {
  const router = express.Router();
  const sessions = new Map();
  const sessionTtlMs = 8 * 3600 * 1000;

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const result = await authService.login(username, password, { requiredScope: 'platform' });
      const sid = `psid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessions.set(sid, {
        user: result.user,
        createdAt: Date.now(),
        expiresAt: Date.now() + sessionTtlMs
      });
      res.cookie('platform_session', sid, { httpOnly: true, sameSite: 'lax', maxAge: sessionTtlMs });
      if (auditService) {
        await auditService.log('platform.auth.login', { username: result.user.username });
      }
      res.json({ authenticated: true, user: result.user, token: result.token });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (req, res) => {
    const sid = parseCookie(req.headers.cookie, 'platform_session');
    if (sid) sessions.delete(sid);
    res.clearCookie('platform_session');
    res.json({ ok: true });
  });

  router.get('/me', async (req, res, next) => {
    try {
      // Try JWT first
      const authHeader = String(req.headers.authorization || '').trim();
      if (authHeader.startsWith('Bearer ')) {
        const principal = authService.authenticateControlRequest(authHeader);
        if (principal.scope !== 'platform') {
          return res.json({ authenticated: false });
        }
        return res.json({ authenticated: true, user: principal });
      }
      // Fallback to session cookie
      const sid = parseCookie(req.headers.cookie, 'platform_session');
      const session = sid ? sessions.get(sid) : null;
      if (!session || session.expiresAt < Date.now()) {
        if (sid) sessions.delete(sid);
        return res.json({ authenticated: false });
      }
      res.json({ authenticated: true, user: session.user });
    } catch {
      res.json({ authenticated: false });
    }
  });

  router.post('/renew', (req, res) => {
    const sid = parseCookie(req.headers.cookie, 'platform_session');
    const session = sid ? sessions.get(sid) : null;
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'session expired' });
    }
    session.expiresAt = Date.now() + sessionTtlMs;
    const remaining = Math.round((session.expiresAt - Date.now()) / 1000);
    res.json({ ok: true, remainingSeconds: remaining });
  });

  // Cleanup expired sessions periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (session.expiresAt < now) sessions.delete(key);
    }
  }, 5 * 60 * 1000);

  return router;
}

function parseCookie(header, name) {
  const raw = String(header || '');
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : '';
}

module.exports = { buildPlatformAuthRouter };
