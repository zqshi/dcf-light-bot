/**
 * DocumentLifecycle — 文档状态机
 * 定义合法状态转换和验证规则
 */

const VALID_STATUSES = ['draft', 'pending_review', 'published', 'archived'];

const TRANSITIONS = {
  draft: ['pending_review', 'published'],
  pending_review: ['draft', 'published'],
  published: ['archived', 'draft'],
  archived: ['draft'],
};

function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function validateTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(`invalid status transition: ${from} → ${to}`);
    err.statusCode = 400;
    throw err;
  }
}

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

module.exports = { VALID_STATUSES, TRANSITIONS, canTransition, validateTransition, isValidStatus };
