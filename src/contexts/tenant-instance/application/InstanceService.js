const { createInstance, STATE, touch } = require('../domain/Instance');
const { AppError } = require('../../../shared/errors');

const PROVISION_PHASE = {
  PENDING: 'pending',
  PROVISIONING: 'provisioning',
  CONFIGURING: 'configuring',
  STARTING: 'starting',
  READY: 'ready',
  FAILED: 'failed'
};

class InstanceService {
  constructor(repo, provisioner, audit, config) {
    this.repo = repo;
    this.provisioner = provisioner;
    this.audit = audit;
    this.config = config;
  }

  createProvisioningJob(input = {}) {
    const now = new Date().toISOString();
    return {
      requestId: String(input.requestId || '').trim(),
      instanceId: String(input.instanceId || '').trim() || null,
      tenantId: String(input.tenantId || '').trim() || null,
      creator: String(input.creator || '').trim() || null,
      status: String(input.status || PROVISION_PHASE.PENDING),
      phase: String(input.phase || PROVISION_PHASE.PENDING),
      attempts: Math.max(1, Number(input.attempts || 1)),
      checks: input.checks && typeof input.checks === 'object' ? input.checks : {},
      error: null,
      createdAt: now,
      updatedAt: now
    };
  }

  async updateProvisioningJob(job, patch = {}) {
    if (!job || !String(job.requestId || '').trim()) return null;
    const next = {
      ...job,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this.repo.saveProvisioningJob(next);
    return next;
  }

  async setProvisionPhase(instance, phase, extra = {}) {
    if (!instance || !String(instance.id || '').trim()) return instance;
    const next = touch({
      ...instance,
      runtime: {
        ...(instance.runtime || {}),
        provisionPhase: String(phase || PROVISION_PHASE.PROVISIONING)
      },
      ...extra
    });
    await this.repo.saveInstance(next);
    await this.audit.log('instance.provisioning', {
      instanceId: next.id,
      tenantId: next.tenantId,
      phase: String(phase || ''),
      ...extra
    });
    return next;
  }

  async getProvisioningJob(requestId) {
    const key = String(requestId || '').trim();
    if (!key) throw new AppError('requestId is required', 400, 'REQUEST_ID_REQUIRED');
    const job = await this.repo.getProvisioningJobByRequestId(key);
    if (!job) throw new AppError('provisioning job not found', 404, 'PROVISIONING_JOB_NOT_FOUND');
    return job;
  }

  async createFromMatrix(input) {
    const name = String(input && input.name || '').trim();
    if (!name) throw new AppError('name is required', 400, 'INSTANCE_NAME_REQUIRED');

    const requestId = String(input.requestId || '').trim();
    if (requestId) {
      const existed = await this.repo.findInstanceByRequestId(requestId);
      if (existed) return existed;
      const job = await this.repo.getProvisioningJobByRequestId(requestId);
      if (job && String(job.instanceId || '').trim()) {
        const mapped = await this.repo.getInstance(String(job.instanceId).trim());
        if (mapped) return mapped;
      }
    }

    const permissionTemplate = input && typeof input.permissionTemplate === 'object'
      ? input.permissionTemplate
      : (this.config && typeof this.config.openclawPermissionTemplate === 'object'
        ? this.config.openclawPermissionTemplate
        : null);

    let instance = createInstance({
      ...input,
      tenantId: input.tenantId || (this.config && this.config.defaultTenantId) || 'tn_default',
      permissionTemplate
    }, this.config);
    instance.requestId = requestId || null;
    instance.state = STATE.PROVISIONING;
    instance.runtime = {
      ...(instance.runtime || {}),
      provisionPhase: PROVISION_PHASE.PENDING
    };
    instance = touch(instance);
    await this.repo.saveInstance(instance);
    let provisioningJob = requestId
      ? this.createProvisioningJob({
          requestId,
          instanceId: instance.id,
          tenantId: instance.tenantId,
          creator: instance.creator,
          status: PROVISION_PHASE.PENDING,
          phase: PROVISION_PHASE.PENDING
        })
      : null;
    if (provisioningJob) {
      await this.repo.saveProvisioningJob(provisioningJob);
    }
    await this.audit.log('instance.requested', {
      instanceId: instance.id,
      tenantId: instance.tenantId,
      creator: instance.creator,
      source: 'matrix'
    });

    try {
      instance = await this.setProvisionPhase(instance, PROVISION_PHASE.PROVISIONING);
      if (provisioningJob) {
        provisioningJob = await this.updateProvisioningJob(provisioningJob, {
          status: PROVISION_PHASE.PROVISIONING,
          phase: PROVISION_PHASE.PROVISIONING
        });
      }
      instance = await this.setProvisionPhase(instance, PROVISION_PHASE.CONFIGURING);
      if (provisioningJob) {
        provisioningJob = await this.updateProvisioningJob(provisioningJob, {
          status: PROVISION_PHASE.CONFIGURING,
          phase: PROVISION_PHASE.CONFIGURING
        });
      }
      const runtime = await this.provisioner.provision(instance);
      instance = await this.setProvisionPhase(instance, PROVISION_PHASE.STARTING);
      if (provisioningJob) {
        provisioningJob = await this.updateProvisioningJob(provisioningJob, {
          status: PROVISION_PHASE.STARTING,
          phase: PROVISION_PHASE.STARTING
        });
      }
      instance.runtime = {
        ...instance.runtime,
        ...runtime
      };
      instance.state = STATE.RUNNING;
      instance.lastError = null;
      instance.runtime.provisionPhase = PROVISION_PHASE.READY;
      instance = touch(instance);
      await this.repo.saveInstance(instance);
      if (provisioningJob) {
        await this.updateProvisioningJob(provisioningJob, {
          status: PROVISION_PHASE.READY,
          phase: PROVISION_PHASE.READY,
          checks: {
            matrix: runtime && typeof runtime.matrixChannelCheck === 'object' ? runtime.matrixChannelCheck : {}
          },
          error: null
        });
      }
      await this.audit.log('instance.channel.matrix.checked', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        check: runtime && typeof runtime.matrixChannelCheck === 'object' ? runtime.matrixChannelCheck : {}
      });
      await this.audit.log('instance.provisioned', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        namespace: instance.runtime.namespace,
        podName: instance.runtime.podName,
        providerKeysInjected: Boolean(runtime.providerKeysInjected),
        mountedAssetCount: Number(runtime.mountedAssetCount || 0),
        mountIssues: Array.isArray(runtime.mountIssues) ? runtime.mountIssues : []
      });
      if (Array.isArray(runtime.mountIssues) && runtime.mountIssues.length) {
        await this.audit.log('instance.asset.mount.degraded', {
          instanceId: instance.id,
          tenantId: instance.tenantId,
          mountIssues: runtime.mountIssues
        });
      }
      return instance;
    } catch (error) {
      instance.state = STATE.FAILED;
      instance.lastError = String(error.message || 'provision failed');
      instance.runtime = {
        ...instance.runtime,
        provisionPhase: PROVISION_PHASE.FAILED
      };
      instance = touch(instance);
      await this.repo.saveInstance(instance);
      if (provisioningJob) {
        await this.updateProvisioningJob(provisioningJob, {
          status: PROVISION_PHASE.FAILED,
          phase: PROVISION_PHASE.FAILED,
          checks: {
            matrix: {
              status: 'failed',
              issues: ['provision_failed'],
              checkedAt: new Date().toISOString()
            }
          },
          error: instance.lastError
        });
      }
      await this.audit.log('instance.provision.failed', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        error: instance.lastError
      });
      throw error;
    }
  }

  async list(tenantId) {
    return this.repo.listInstances(tenantId || null);
  }

  async get(instanceId) {
    const row = await this.repo.getInstance(instanceId);
    if (!row) throw new AppError('instance not found', 404, 'INSTANCE_NOT_FOUND');
    return row;
  }

  async start(instanceId) {
    const instance = await this.get(instanceId);
    if (instance.state === STATE.RUNNING) return instance;
    const runtime = await this.provisioner.provision(instance);
    instance.runtime = {
      ...instance.runtime,
      ...runtime
    };
    instance.state = STATE.RUNNING;
    const saved = touch(instance);
    await this.repo.saveInstance(saved);
    await this.audit.log('instance.started', { instanceId, tenantId: saved.tenantId });
    if (Array.isArray(runtime.mountIssues) && runtime.mountIssues.length) {
      await this.audit.log('instance.asset.mount.degraded', {
        instanceId,
        tenantId: saved.tenantId,
        mountIssues: runtime.mountIssues
      });
    }
    return saved;
  }

  async stop(instanceId) {
    const instance = await this.get(instanceId);
    if (instance.state === STATE.STOPPED) return instance;
    await this.provisioner.stop(instance);
    instance.state = STATE.STOPPED;
    const saved = touch(instance);
    await this.repo.saveInstance(saved);
    await this.audit.log('instance.stopped', { instanceId, tenantId: saved.tenantId });
    return saved;
  }

  async rebuild(instanceId) {
    const instance = await this.get(instanceId);
    instance.state = STATE.PROVISIONING;
    instance.lastError = null;
    const provisioning = touch(instance);
    await this.repo.saveInstance(provisioning);
    await this.audit.log('instance.rebuild.requested', { instanceId, tenantId: provisioning.tenantId });

    try {
      if (this.provisioner && typeof this.provisioner.rollback === 'function') {
        await this.provisioner.rollback(provisioning);
      } else if (this.provisioner && typeof this.provisioner.stop === 'function') {
        await this.provisioner.stop(provisioning);
      }
      const runtime = await this.provisioner.provision(provisioning);
      const running = touch({
        ...provisioning,
        runtime: { ...provisioning.runtime, ...runtime },
        state: STATE.RUNNING,
        lastError: null
      });
      await this.repo.saveInstance(running);
      await this.audit.log('instance.rebuild.succeeded', { instanceId, tenantId: running.tenantId });
      if (Array.isArray(runtime.mountIssues) && runtime.mountIssues.length) {
        await this.audit.log('instance.asset.mount.degraded', {
          instanceId,
          tenantId: running.tenantId,
          mountIssues: runtime.mountIssues
        });
      }
      return running;
    } catch (error) {
      const failed = touch({
        ...provisioning,
        state: STATE.FAILED,
        lastError: String(error.message || 'rebuild failed')
      });
      await this.repo.saveInstance(failed);
      await this.audit.log('instance.rebuild.failed', {
        instanceId,
        tenantId: failed.tenantId,
        error: failed.lastError
      });
      throw error;
    }
  }

  async remove(instanceId) {
    const instance = await this.get(instanceId);
    if (this.provisioner && typeof this.provisioner.rollback === 'function') {
      await this.provisioner.rollback(instance);
    } else if (this.provisioner && typeof this.provisioner.stop === 'function') {
      await this.provisioner.stop(instance);
    }
    await this.repo.deleteInstance(instanceId);
    await this.audit.log('instance.deleted', { instanceId, tenantId: instance.tenantId });
    return { id: instanceId, deleted: true };
  }

  buildMatrixCard(instance) {
    const chatUrl = `${this.config.platformBaseUrl}/chat/${instance.id}`;
    const runtimeEndpoint = instance.runtime && instance.runtime.endpoint ? instance.runtime.endpoint : '';
    const matrixRoomId = instance.matrixRoomId || '';
    return {
      schema: 'dcf.employee-card/v1',
      cardType: 'digital_employee',
      title: '数字员工卡片',
      subtitle: '创建完成，可直接进入会话',
      instanceId: instance.id,
      employeeId: instance.employeeId || '',
      employeeNo: instance.employeeNo || '',
      tenantId: instance.tenantId,
      name: instance.name,
      email: instance.email || '',
      jobCode: instance.jobCode || '',
      jobTitle: instance.jobTitle || '',
      department: instance.department || '',
      permissionTemplateId: instance.permissionTemplateId || '',
      state: instance.state,
      matrixRoomId,
      chatUrl,
      runtimeEndpoint,
      createdAt: instance.createdAt,
      status: {
        phase: String((instance.runtime && instance.runtime.provisionPhase) || (instance.state === STATE.RUNNING ? 'ready' : 'provisioning')),
        text: instance.state === STATE.RUNNING ? '实例运行中' : '实例准备中'
      },
      actions: [
        { type: 'open_chat', label: '进入会话', url: chatUrl },
        { type: 'view_runtime', label: '运行端点', value: runtimeEndpoint || '-' }
      ],
      metadata: {
        source: String(instance.source || 'matrix'),
        creator: String(instance.creator || ''),
        namespace: String((instance.runtime && instance.runtime.namespace) || '')
      }
    };
  }
}

module.exports = { InstanceService };
