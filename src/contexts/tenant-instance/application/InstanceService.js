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
        providerKeysInjected: Boolean(runtime.providerKeysInjected)
      });
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
