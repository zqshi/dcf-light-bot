const { nowIso } = require('../../../shared/time');

function registerAdminCompatAuthMgmtRoutes(router, context, deps) {
  const userStore = deps.userStore;
  const roleStore = deps.roleStore;
  const rolePayload = deps.rolePayload;
  const userPayload = deps.userPayload;

  router.get('/api/admin/auth/health', (_req, res) => {
    res.json({ ok: true, users: userStore.size, roles: roleStore.size, updatedAt: nowIso() });
  });

  router.get('/api/admin/auth/users', (_req, res) => {
    res.json(Array.from(userStore.values()).map(userPayload));
  });

  router.post('/api/admin/auth/users', async (req, res) => {
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
    await context.auditService.log('auth.user.created', {
      username,
      role,
      displayName: next.displayName
    });
    res.json(userPayload(next));
  });

  router.post('/api/admin/auth/users/:userId', async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const row = userStore.get(userId);
    if (!row) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const changes = [];
    const newDisplayName = String(body.displayName || row.displayName || row.username);
    const newRole = String(body.role || row.role || 'ops_admin');
    const newDisabled = Boolean(body.disabled);
    if (newDisplayName !== row.displayName) changes.push('displayName');
    if (newRole !== row.role) changes.push('role');
    if (newDisabled !== row.disabled) changes.push('disabled');
    row.displayName = newDisplayName;
    row.role = newRole;
    row.disabled = newDisabled;
    row.updatedAt = nowIso();
    userStore.set(userId, row);
    await context.auditService.log('auth.user.updated', {
      userId,
      username: row.username,
      changes
    });
    res.json(userPayload(row));
  });

  router.post('/api/admin/auth/users/:userId/delete', async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const row = userStore.get(userId);
    const username = row ? row.username : userId;
    userStore.delete(userId);
    await context.auditService.log('auth.user.deleted', { userId, username });
    res.json({ success: true, userId });
  });

  router.get('/api/admin/auth/roles', (_req, res) => {
    res.json(Array.from(roleStore.values()).map(rolePayload));
  });

  router.post('/api/admin/auth/roles', async (req, res) => {
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
    await context.auditService.log('auth.role.created', {
      role,
      permissions: row.permissions
    });
    res.json(rolePayload(row));
  });

  router.post('/api/admin/auth/roles/:role', async (req, res) => {
    const role = String(req.params.role || '').trim();
    const existed = roleStore.get(role);
    if (!existed) {
      res.status(404).json({ error: 'role not found' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const previousPermissions = Array.isArray(existed.permissions) ? [...existed.permissions] : [];
    existed.permissions = Array.isArray(body.permissions) ? body.permissions.map((x) => String(x)) : existed.permissions;
    existed.updatedAt = nowIso();
    roleStore.set(role, existed);
    await context.auditService.log('auth.role.updated', {
      role,
      permissions: existed.permissions,
      previousPermissions
    });
    res.json(rolePayload(existed));
  });

  router.post('/api/admin/auth/roles/:role/delete', async (req, res) => {
    const role = String(req.params.role || '').trim();
    roleStore.delete(role);
    await context.auditService.log('auth.role.deleted', { role });
    res.json({ success: true, role });
  });
}

module.exports = { registerAdminCompatAuthMgmtRoutes };
