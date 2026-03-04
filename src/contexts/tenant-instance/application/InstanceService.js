const { createInstance, STATE, touch } = require('../domain/Instance');
const { AppError } = require('../../../shared/errors');

class InstanceService {
  constructor(repo, provisioner, audit, config) {
    this.repo = repo;
    this.provisioner = provisioner;
    this.audit = audit;
    this.config = config;
  }

  async createFromMatrix(input) {
    const name = String(input && input.name || '').trim();
    if (!name) throw new AppError('name is required', 400, 'INSTANCE_NAME_REQUIRED');

    const requestId = String(input.requestId || '').trim();
    if (requestId) {
      const existed = await this.repo.findInstanceByRequestId(requestId);
      if (existed) return existed;
    }

    let instance = createInstance(input, this.config);
    instance.requestId = requestId || null;
    instance.state = STATE.PROVISIONING;
    instance = touch(instance);
    await this.repo.saveInstance(instance);
    await this.audit.log('instance.requested', {
      instanceId: instance.id,
      tenantId: instance.tenantId,
      creator: instance.creator,
      source: 'matrix'
    });

    try {
      const runtime = await this.provisioner.provision(instance);
      instance.runtime = {
        ...instance.runtime,
        ...runtime
      };
      instance.state = STATE.RUNNING;
      instance.lastError = null;
      instance = touch(instance);
      await this.repo.saveInstance(instance);
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
      instance = touch(instance);
      await this.repo.saveInstance(instance);
      await this.audit.log('instance.provision.failed', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        error: instance.lastError
      });
      throw error;
    }
  }

  async list() {
    return this.repo.listInstances();
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
    return {
      title: '数字员工卡片',
      instanceId: instance.id,
      tenantId: instance.tenantId,
      name: instance.name,
      state: instance.state,
      chatUrl: `${this.config.platformBaseUrl}/chat/${instance.id}`,
      runtimeEndpoint: instance.runtime.endpoint,
      createdAt: instance.createdAt
    };
  }
}

module.exports = { InstanceService };
