const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');

const STATE = {
  REQUESTED: 'requested',
  PROVISIONING: 'provisioning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed'
};

function createInstance(input, cfg) {
  const now = nowIso();
  return {
    id: newId('inst'),
    tenantId: newId('tenant'),
    name: String(input.name || '').trim(),
    source: 'matrix',
    matrixRoomId: String(input.matrixRoomId || '').trim() || null,
    creator: String(input.creator || 'unknown').trim(),
    state: STATE.REQUESTED,
    runtime: {
      namespace: '',
      podName: '',
      serviceName: '',
      endpoint: '',
      openclawVersion: cfg.openclawImage,
      openclawSourcePath: cfg.openclawSourcePath
    },
    resources: {
      cpu: cfg.tenantDefaultCpu,
      memory: cfg.tenantDefaultMemory,
      storage: cfg.tenantDefaultStorage
    },
    createdAt: now,
    updatedAt: now,
    lastError: null
  };
}

function touch(instance) {
  return { ...instance, updatedAt: nowIso() };
}

module.exports = { STATE, createInstance, touch };
