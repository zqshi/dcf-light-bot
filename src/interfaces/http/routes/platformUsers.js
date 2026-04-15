const express = require('express');
const bcrypt = require('bcryptjs');
const { nowIso } = require('../../../shared/time');

function mergeUsers(envUsers, dynamicUsers) {
  const dynamicMap = new Map();
  for (const u of dynamicUsers) dynamicMap.set(u.username, u);
  const merged = [];
  const seen = new Set();
  for (const u of dynamicUsers) {
    merged.push({ ...u, source: 'dynamic' });
    seen.add(u.username);
  }
  for (const u of envUsers) {
    if (!seen.has(u.username)) {
      merged.push({ ...u, source: 'env' });
    }
  }
  return merged;
}

function sanitize(u) {
  return {
    username: u.username,
    displayName: u.displayName || '',
    email: u.email || '',
    role: u.role || '',
    scope: u.scope || '',
    tenantId: u.tenantId || null,
    disabled: Boolean(u.disabled),
    source: u.source || 'env',
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

function buildPlatformUsersRouter(config, repo, requirePermission) {
  const router = express.Router();
  const envUsers = Array.isArray(config.controlPlaneUsers) ? config.controlPlaneUsers : [];

  router.get('/', requirePermission('platform:tenant:read'), async (req, res, next) => {
    try {
      const dynamicUsers = repo ? await repo.listPlatformUsers() : [];
      const merged = mergeUsers(envUsers, dynamicUsers);
      const scopeFilter = req.query.scope || null;
      const roleFilter = req.query.role || null;
      let result = merged;
      if (scopeFilter) result = result.filter((u) => u.scope === scopeFilter);
      if (roleFilter) result = result.filter((u) => u.role === roleFilter);
      res.json({ success: true, data: result.map(sanitize) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      if (!repo) return res.status(501).json({ success: false, error: { message: 'user persistence not available' } });
      const { username, displayName, email, role, scope, tenantId, password } = req.body || {};
      const uname = String(username || '').trim();
      if (!uname) return res.status(400).json({ success: false, error: { message: '用户名不能为空' } });
      if (!password) return res.status(400).json({ success: false, error: { message: '密码不能为空' } });
      if (!role) return res.status(400).json({ success: false, error: { message: '角色不能为空' } });

      const existing = await repo.getPlatformUser(uname);
      if (existing) return res.status(409).json({ success: false, error: { message: `用户 "${uname}" 已存在` } });
      const envConflict = envUsers.find((u) => u.username === uname);
      if (envConflict) return res.status(409).json({ success: false, error: { message: `用户 "${uname}" 已在环境变量中定义` } });

      const hash = await bcrypt.hash(String(password), 10);
      const now = nowIso();
      const user = {
        username: uname,
        displayName: String(displayName || '').trim(),
        email: String(email || '').trim(),
        role: String(role).trim(),
        scope: String(scope || 'tenant').trim(),
        tenantId: String(tenantId || '').trim() || null,
        disabled: false,
        password: `bcrypt:${hash}`,
        source: 'dynamic',
        createdAt: now,
        updatedAt: now
      };
      await repo.savePlatformUser(user);
      res.status(201).json({ success: true, data: sanitize(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:username', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      if (!repo) return res.status(501).json({ success: false, error: { message: 'user persistence not available' } });
      const uname = req.params.username;
      let user = await repo.getPlatformUser(uname);
      if (!user) {
        const envUser = envUsers.find((u) => u.username === uname);
        if (!envUser) return res.status(404).json({ success: false, error: { message: '用户不存在' } });
        user = { ...envUser, source: 'dynamic', createdAt: nowIso() };
      }
      const patch = req.body || {};
      if (patch.displayName !== undefined) user.displayName = String(patch.displayName || '').trim();
      if (patch.email !== undefined) user.email = String(patch.email || '').trim();
      if (patch.role !== undefined) user.role = String(patch.role).trim();
      if (patch.scope !== undefined) user.scope = String(patch.scope).trim();
      if (patch.tenantId !== undefined) user.tenantId = String(patch.tenantId || '').trim() || null;
      if (patch.disabled !== undefined) user.disabled = Boolean(patch.disabled);
      user.updatedAt = nowIso();
      user.source = 'dynamic';
      await repo.savePlatformUser(user);
      res.json({ success: true, data: sanitize(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:username/reset-password', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      if (!repo) return res.status(501).json({ success: false, error: { message: 'user persistence not available' } });
      const uname = req.params.username;
      let user = await repo.getPlatformUser(uname);
      if (!user) {
        const envUser = envUsers.find((u) => u.username === uname);
        if (!envUser) return res.status(404).json({ success: false, error: { message: '用户不存在' } });
        user = { ...envUser, source: 'dynamic', createdAt: nowIso() };
      }
      const { password } = req.body || {};
      if (!password) return res.status(400).json({ success: false, error: { message: '新密码不能为空' } });
      const hash = await bcrypt.hash(String(password), 10);
      user.password = `bcrypt:${hash}`;
      user.updatedAt = nowIso();
      user.source = 'dynamic';
      await repo.savePlatformUser(user);
      res.json({ success: true, data: sanitize(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:username/toggle', requirePermission('platform:tenant:write'), async (req, res, next) => {
    try {
      if (!repo) return res.status(501).json({ success: false, error: { message: 'user persistence not available' } });
      const uname = req.params.username;
      let user = await repo.getPlatformUser(uname);
      if (!user) {
        const envUser = envUsers.find((u) => u.username === uname);
        if (!envUser) return res.status(404).json({ success: false, error: { message: '用户不存在' } });
        user = { ...envUser, source: 'dynamic', createdAt: nowIso() };
      }
      user.disabled = !user.disabled;
      user.updatedAt = nowIso();
      user.source = 'dynamic';
      await repo.savePlatformUser(user);
      res.json({ success: true, data: sanitize(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { buildPlatformUsersRouter };
