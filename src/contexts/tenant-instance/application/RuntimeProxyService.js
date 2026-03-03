const { AppError } = require('../../../shared/errors');

class RuntimeProxyService {
  constructor(instanceService, config) {
    this.instanceService = instanceService;
    this.config = config;
  }

  async invoke(instanceId, request = {}) {
    const instance = await this.instanceService.get(instanceId);
    if (String(instance.state || '') !== 'running') {
      throw new AppError('instance is not running', 409, 'INSTANCE_NOT_RUNNING');
    }

    if (this.config.kubernetesSimulationMode) {
      return {
        mode: 'simulation',
        instanceId,
        endpoint: instance.runtime.endpoint,
        request
      };
    }

    throw new AppError('runtime proxy for kubernetes mode is not implemented yet', 501, 'RUNTIME_PROXY_NOT_IMPLEMENTED');
  }
}

module.exports = { RuntimeProxyService };
