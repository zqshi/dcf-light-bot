/**
 * PermissionPolicy — 文档权限策略
 */

const LEVELS = ['admin', 'edit', 'comment', 'view'];
const LEVEL_RANK = { admin: 4, edit: 3, comment: 2, view: 1 };

function hasAtLeast(userLevel, requiredLevel) {
  return (LEVEL_RANK[userLevel] || 0) >= (LEVEL_RANK[requiredLevel] || 0);
}

function isValidLevel(level) {
  return LEVELS.includes(level);
}

function canUserAccess(permissions, userId, requiredLevel) {
  if (!Array.isArray(permissions) || permissions.length === 0) return true; // no restrictions
  const entry = permissions.find((p) => p.userId === userId);
  if (!entry) return false;
  return hasAtLeast(entry.level, requiredLevel);
}

module.exports = { LEVELS, LEVEL_RANK, hasAtLeast, isValidLevel, canUserAccess };
