const { newId } = require('../../../shared/id');
const { nowIso } = require('../../../shared/time');

const STATE = {
  REQUESTED: 'requested',
  PROVISIONING: 'provisioning',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed'
};

function normalizeMatrixLocalpart(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const noAt = raw.startsWith('@') ? raw.slice(1) : raw;
  const idx = noAt.indexOf(':');
  return idx >= 0 ? noAt.slice(0, idx) : noAt;
}

function inferDepartmentByJob(jobTitle) {
  const title = String(jobTitle || '').trim();
  if (!title) return 'general';
  if (title.includes('财务')) return 'finance';
  if (title.includes('采购')) return 'procurement';
  if (title.includes('法务')) return 'legal';
  if (title.includes('人事') || title.includes('HR')) return 'human-resources';
  if (title.includes('运维')) return 'operations';
  if (title.includes('开发') || title.includes('工程')) return 'engineering';
  if (title.includes('测试')) return 'quality';
  if (title.includes('销售')) return 'sales';
  if (title.includes('运营')) return 'operations';
  if (title.includes('产品')) return 'product';
  return 'general';
}

function generateEmployeeNo() {
  const d = new Date();
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DE${y}${m}${day}${seq}`;
}

function createInstance(input, cfg) {
  const tenantId = String(input.tenantId || '').trim();
  if (!tenantId) throw new Error('tenantId is required to create an instance');
  const now = nowIso();
  const profile = input && typeof input.employeeProfile === 'object' ? input.employeeProfile : {};
  const creator = String(input.creator || 'unknown').trim();
  const creatorLocalpart = normalizeMatrixLocalpart(creator);
  const jobTitle = String(profile.jobTitle || profile.job || '').trim() || '通用岗位';
  const department = String(profile.department || '').trim() || inferDepartmentByJob(jobTitle);
  const email = String(profile.email || '').trim() || (creatorLocalpart ? `${creatorLocalpart}@digital-employee.local` : '');
  const permissionTemplateInput = input && typeof input.permissionTemplate === 'object'
    ? input.permissionTemplate
    : (cfg && typeof cfg.openclawPermissionTemplate === 'object' ? cfg.openclawPermissionTemplate : null);
  return {
    id: newId('inst'),
    tenantId,
    name: String(input.name || '').trim(),
    source: 'matrix',
    matrixRoomId: String(input.matrixRoomId || '').trim() || null,
    creator,
    enterpriseUserId: String(profile.enterpriseUserId || profile.username || '').trim() || null,
    employeeNo: String(profile.employeeNo || '').trim() || generateEmployeeNo(),
    employeeId: String(profile.employeeId || '').trim() || newId('de'),
    email: email || null,
    jobCode: String(profile.jobCode || '').trim() || 'general',
    jobTitle,
    department,
    permissionTemplateId: String(input.permissionTemplateId || 'openclaw_default').trim(),
    permissionTemplate: permissionTemplateInput ? JSON.parse(JSON.stringify(permissionTemplateInput)) : null,
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
