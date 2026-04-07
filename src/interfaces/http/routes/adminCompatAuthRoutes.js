const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function registerAdminCompatAuthRoutes(router, context, deps) {
  const sessions = deps.sessions;
  const sessionTtlSec = deps.sessionTtlSec;
  const parseCookies = deps.parseCookies;
  const normalizeMatrixUserId = deps.normalizeMatrixUserId;
  const userStore = deps.userStore;
  const roleStore = deps.roleStore;
  const ROLE_PERMISSIONS = deps.ROLE_PERMISSIONS;

  function buildNavItems() {
    return [
      { path: '/admin/index.html', label: '总览', permission: 'admin.runtime.page.platform-overview.read' },
      { path: '/admin/employees.html', label: '员工管理', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/shared-agents.html', label: '共享Agent', permission: 'admin.employees.page.overview.read' },
      { path: '/admin/openclaw-monitor.html', label: '平台运营', permission: 'admin.runtime.page.openclaw-config.read' },
      { path: '/admin/openclaw-statistics.html', label: '数据统计', permission: 'admin.runtime.page.openclaw-config.read' },
      { path: '/admin/skills.html', label: '技能管理', permission: 'admin.skills.page.management.read' },
      { path: '/admin/tools.html', label: '工具管理', permission: 'admin.tools.page.assets.read' },
      { path: '/admin/ai-gateway.html', label: 'AI Gateway', permission: 'admin.ai-gateway.page.read' },
      { path: '/admin/notifications.html', label: '通知中心', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/logs-service.html', label: '行为日志', permission: 'admin.logs.page.behavior.read' },
      { path: '/admin/auth-members.html', label: '成员管理', permission: 'admin.auth.page.members.read' }
    ];
  }

  function buildSession(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sid = String(cookies.dcf_admin_session || '');
    if (!sid) return null;
    const sess = sessions.get(sid);
    if (!sess) return null;
    if (Date.now() >= sess.expiresAt) {
      sessions.delete(sid);
      return null;
    }
    return { sid, ...sess };
  }

  function requireSession(req, res, next) {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, error: 'UNAUTHORIZED' });
      return;
    }
    req.adminSession = session;
    next();
  }

  function setSessionCookie(res, sid, maxAgeSec) {
    const maxAge = Math.max(60, Number(maxAgeSec || sessionTtlSec));
    const cookie = [
      `dcf_admin_session=${encodeURIComponent(sid)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`
    ].join('; ');
    res.setHeader('Set-Cookie', cookie);
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'dcf_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }

  function resolveSessionPermissions(session) {
    const user = session && session.user ? session.user : {};
    const role = String(user.role || '').trim();
    const roleModel = role ? roleStore.get(role) : null;
    if (roleModel && Array.isArray(roleModel.permissions)) {
      return roleModel.permissions;
    }
    return Array.isArray(user.permissions) ? user.permissions : [];
  }

  function hasAdminConsoleAccess(permissions) {
    const list = Array.isArray(permissions) ? permissions : [];
    if (list.includes('*')) return true;
    return list.some((perm) => {
      const val = String(perm || '').trim().toLowerCase();
      return val.startsWith('admin.') || val.startsWith('control:');
    });
  }

  function rolePayload(role) {
    return {
      role: role.role,
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      updatedAt: role.updatedAt || nowIso()
    };
  }

  function userPayload(user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      disabled: user.disabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  // ── Public auth routes (no session required) ──

  router.post('/api/auth/login', async (req, res) => {
    try {
      const body = req.body || {};
      const result = await context.authService.login(body.username || '', body.password || '');
      const sid = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, {
        token: result.token,
        user: result.user,
        expiresAt: Date.now() + (Number(result.expiresInSec || sessionTtlSec) * 1000)
      });
      setSessionCookie(res, sid, Number(result.expiresInSec || sessionTtlSec));
      res.json({ authenticated: true, user: result.user, expiresInSec: result.expiresInSec });
    } catch (error) {
      res.status(Number(error.statusCode || 401)).json({ error: error.message || '登录失败' });
    }
  });

  router.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sid = String(cookies.dcf_admin_session || '');
    if (sid) sessions.delete(sid);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  router.get('/api/auth/me', (req, res) => {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, user: null });
      return;
    }
    const user = session.user || {};
    const roleModel = roleStore.get(String(user.role || ''));
    const permissions = roleModel ? roleModel.permissions : (Array.isArray(user.permissions) ? user.permissions : []);
    res.json({
      authenticated: true,
      user: {
        username: String(user.username || ''),
        displayName: String(user.username || ''),
        role: String(user.role || 'ops_admin'),
        permissions
      }
    });
  });

  router.get('/api/auth/matrix-admin-entry', async (req, res) => {
    const existingSession = buildSession(req);
    if (existingSession) {
      const permissions = resolveSessionPermissions(existingSession);
      res.json({
        showAdminEntry: hasAdminConsoleAccess(permissions),
        adminUrl: '/admin/index.html'
      });
      return;
    }

    const matrixUserId = normalizeMatrixUserId((req.query && req.query.matrixUserId) || '');
    if (!matrixUserId) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
      return;
    }

    let username = '';
    if (context.repo && typeof context.repo.getPlatformConfig === 'function') {
      const directory = await context.repo.getPlatformConfig('identityDirectory');
      const records = directory && typeof directory.records === 'object' ? directory.records : {};
      const profile = records[matrixUserId] && typeof records[matrixUserId] === 'object' ? records[matrixUserId] : null;
      if (profile) {
        username = String(profile.username || profile.enterpriseUserId || profile.employeeId || '').trim();
      }
    }
    if (!username) {
      const mx = String(matrixUserId || '');
      if (mx.startsWith('@') && mx.includes(':')) {
        username = mx.slice(1, mx.indexOf(':')).trim();
      }
    }
    if (!username) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
      return;
    }

    const row = userStore.get(username);
    if (!row || row.disabled) {
      res.json({ showAdminEntry: false, adminUrl: '/admin/index.html' });
      return;
    }

    const role = String(row.role || '').trim();
    const roleModel = roleStore.get(role);
    const permissions = roleModel && Array.isArray(roleModel.permissions)
      ? roleModel.permissions
      : (Array.isArray(row.permissions) ? row.permissions : []);
    res.json({
      showAdminEntry: hasAdminConsoleAccess(permissions),
      adminUrl: '/admin/index.html'
    });
  });

  router.post('/api/auth/renew', (req, res) => {
    const session = buildSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false, remainingSeconds: 0 });
      return;
    }
    const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
    res.json({ authenticated: true, remainingSeconds: remaining });
  });

  router.get('/api/auth/acl', requireSession, (req, res) => {
    res.json({ navItems: buildNavItems() });
  });

  // ── SSO routes ──

  router.get('/api/auth/sso/capabilities', (_req, res) => {
    const enabled = Boolean(context.config.ssoEnabled);
    const provider = String(context.config.ssoProvider || 'oidc');
    const bridgeLoginEnabled = enabled && Boolean(context.config.ssoBridgeLoginEnabled !== false);
    const authorizeConfigured = enabled && Boolean(String(context.config.ssoAuthorizeUrl || '').trim());
    res.json({ enabled, provider, bridgeLoginEnabled, authorizeConfigured });
  });

  router.get('/api/auth/sso/authorize', (req, res) => {
    if (!context.config.ssoEnabled || !String(context.config.ssoAuthorizeUrl || '').trim()) {
      res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
      return;
    }
    const authorizeUrl = new URL(String(context.config.ssoAuthorizeUrl));
    const state = String((req.query && req.query.state) || '');
    const next = String((req.query && req.query.next) || '');
    if (state) authorizeUrl.searchParams.set('state', state);
    if (next) authorizeUrl.searchParams.set('next', next);
    if (String(context.config.ssoCallbackUrl || '').trim()) {
      authorizeUrl.searchParams.set('redirect_uri', String(context.config.ssoCallbackUrl));
    }
    res.json({ authorizeUrl: authorizeUrl.toString() });
  });

  router.post('/api/auth/sso/bridge-login', async (req, res) => {
    if (!context.config.ssoEnabled || context.config.ssoBridgeLoginEnabled === false) {
      res.status(400).json({ error: 'SSO_NOT_CONFIGURED' });
      return;
    }
    const profile = req.body && typeof req.body === 'object' ? req.body : {};
    const mapping = context.config.ssoProfileMapping || {};
    const username = String(
      profile.username
      || profile[mapping.username]
      || profile.sub
      || ''
    ).trim();
    if (!username) {
      res.status(400).json({ error: 'SSO_USERNAME_REQUIRED' });
      return;
    }
    const displayName = String(profile.displayName || profile[mapping.displayName] || username).trim();
    const role = String(profile.role || profile[mapping.role] || 'ops_admin').trim();
    const email = String(profile.email || profile[mapping.email] || '').trim();
    const matrixUserId = normalizeMatrixUserId(
      profile.matrixUserId
      || profile.matrix_user_id
      || profile.mxid
      || ''
    );
    const jobCode = String(profile.jobCode || profile.job_code || profile.job || '').trim();
    const jobTitle = String(profile.jobTitle || profile.job_title || '').trim();
    const department = String(profile.department || profile.dept || '').trim();
    const employeeNo = String(profile.employeeNo || profile.employee_no || '').trim();
    const employeeId = String(profile.employeeId || profile.employee_id || '').trim();
    const enterpriseUserId = String(profile.enterpriseUserId || profile.enterprise_user_id || username).trim();
    const permissions = Array.isArray(ROLE_PERMISSIONS[role]) ? Array.from(new Set(ROLE_PERMISSIONS[role])) : ['control:instance:read'];

    if (matrixUserId && context.repo && typeof context.repo.getPlatformConfig === 'function' && typeof context.repo.setPlatformConfig === 'function') {
      const directory = await context.repo.getPlatformConfig('identityDirectory');
      const records = directory && typeof directory.records === 'object' ? { ...directory.records } : {};
      records[matrixUserId] = {
        username,
        email,
        role,
        matrixUserId,
        enterpriseUserId,
        employeeId: employeeId || '',
        employeeNo: employeeNo || '',
        jobCode: jobCode || '',
        jobTitle: jobTitle || '',
        department: department || '',
        updatedAt: nowIso()
      };
      await context.repo.setPlatformConfig('identityDirectory', {
        records,
        updatedAt: nowIso(),
        updatedBy: username
      });
    }

    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, {
      token: `sso:${sid}`,
      user: { username, displayName, role, permissions },
      expiresAt: Date.now() + (sessionTtlSec * 1000)
    });
    setSessionCookie(res, sid, sessionTtlSec);
    await context.auditService.log('auth.sso.bridge_login.succeeded', {
      username,
      role,
      provider: String(context.config.ssoProvider || 'oidc'),
      matrixUserId: matrixUserId || null
    });
    res.json({
      authenticated: true,
      user: { username, displayName, role, permissions },
      expiresInSec: sessionTtlSec
    });
  });

  // ── Admin auth CRUD (requires session — applied by caller) ──

  router.get('/api/admin/auth/health', (_req, res) => {
    res.json({ ok: true, users: userStore.size, roles: roleStore.size, updatedAt: nowIso() });
  });

  router.get('/api/admin/auth/users', (_req, res) => {
    res.json({ users: Array.from(userStore.values()).map(userPayload) });
  });

  router.post('/api/admin/auth/users', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const username = String(body.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const role = String(body.role || 'ops_admin').trim();
    const existed = userStore.get(username);
    const next = existed || {
      id: `user_${username}`,
      username,
      displayName: String(body.displayName || username),
      createdAt: nowIso()
    };
    next.role = role;
    next.disabled = Boolean(body.disabled);
    next.updatedAt = nowIso();
    userStore.set(username, next);
    res.json(userPayload(next));
  });

  router.post('/api/admin/auth/users/:userId', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const row = userStore.get(userId);
    if (!row) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    row.displayName = String(body.displayName || row.displayName || row.username);
    row.role = String(body.role || row.role || 'ops_admin');
    row.disabled = Boolean(body.disabled);
    row.updatedAt = nowIso();
    userStore.set(userId, row);
    res.json(userPayload(row));
  });

  router.post('/api/admin/auth/users/:userId/delete', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    userStore.delete(userId);
    res.json({ success: true, userId });
  });

  router.get('/api/admin/auth/roles', (_req, res) => {
    const permissionMatrix = deps.permissionMatrix || [];
    const roles = Array.from(roleStore.values()).map((r) => {
      const memberCount = Array.from(userStore.values()).filter((u) => u.role === r.role).length;
      return { ...rolePayload(r), system: Boolean(ROLE_PERMISSIONS[r.role]), memberCount };
    });
    res.json({ roles, permissionMatrix });
  });

  router.post('/api/admin/auth/roles', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const role = String(body.role || '').trim();
    if (!role) {
      res.status(400).json({ error: 'role is required' });
      return;
    }
    const row = {
      role,
      permissions: Array.isArray(body.permissions) ? body.permissions.map((x) => String(x)) : [],
      updatedAt: nowIso()
    };
    roleStore.set(role, row);
    res.json(rolePayload(row));
  });

  router.post('/api/admin/auth/roles/:role', (req, res) => {
    const role = String(req.params.role || '').trim();
    const existed = roleStore.get(role);
    if (!existed) {
      res.status(404).json({ error: 'role not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    existed.permissions = Array.isArray(body.permissions) ? body.permissions.map((x) => String(x)) : existed.permissions;
    existed.updatedAt = nowIso();
    roleStore.set(role, existed);
    res.json(rolePayload(existed));
  });

  router.post('/api/admin/auth/roles/:role/delete', (req, res) => {
    const role = String(req.params.role || '').trim();
    roleStore.delete(role);
    res.json({ success: true, role });
  });

  return { requireSession, buildSession };
}

module.exports = { registerAdminCompatAuthRoutes };
