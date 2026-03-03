const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

function newId(prefix) {
  const rand = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `${prefix}_${rand}`;
}

function runWithRequestContext(baseContext, handler) {
  const ctx = baseContext && typeof baseContext === 'object' ? { ...baseContext } : {};
  return storage.run(ctx, handler);
}

function getRequestContext() {
  return storage.getStore() || {};
}

function patchRequestContext(patch) {
  const ctx = storage.getStore();
  if (!ctx || !patch || typeof patch !== 'object') return;
  Object.assign(ctx, patch);
}

function buildBaseRequestContext(headers = {}) {
  const requestId = String(headers['x-request-id'] || '').trim() || newId('req');
  const traceId = String(headers['x-trace-id'] || '').trim() || requestId;
  const correlationId = String(headers['x-correlation-id'] || '').trim() || requestId;
  return {
    requestId,
    traceId,
    correlationId
  };
}

module.exports = {
  buildBaseRequestContext,
  runWithRequestContext,
  getRequestContext,
  patchRequestContext
};
