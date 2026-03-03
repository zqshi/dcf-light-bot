const { AppError } = require('../../../shared/errors');
const axios = require('axios');

function sleep(ms) {
  const delay = Math.max(0, Number(ms || 0));
  if (!delay) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

class RuntimeProxyService {
  constructor(instanceService, config, options = {}) {
    this.instanceService = instanceService;
    this.config = config;
    this.httpClient = options.httpClient || axios.create({
      timeout: Number(config.runtimeProxyTimeoutMs || 10_000),
      validateStatus: () => true
    });
    this.auditService = options.auditService || null;
    this.breakers = new Map();
  }

  runtimePath() {
    return String(this.config.runtimeProxyInvokePath || '/api/runtime/invoke').trim();
  }

  now() {
    return Date.now();
  }

  getBreaker(instanceId) {
    const key = String(instanceId || '').trim();
    if (!this.breakers.has(key)) {
      this.breakers.set(key, { failures: 0, openedUntilMs: 0 });
    }
    return this.breakers.get(key);
  }

  isBreakerOpen(instanceId) {
    const breaker = this.getBreaker(instanceId);
    return breaker.openedUntilMs > this.now();
  }

  markSuccess(instanceId) {
    const breaker = this.getBreaker(instanceId);
    breaker.failures = 0;
    breaker.openedUntilMs = 0;
  }

  markFailure(instanceId) {
    const breaker = this.getBreaker(instanceId);
    breaker.failures += 1;
    const threshold = Math.max(1, Number(this.config.runtimeProxyFailureThreshold || 3));
    if (breaker.failures >= threshold) {
      const coolOffMs = Math.max(1000, Number(this.config.runtimeProxyBreakerCoolOffMs || 30_000));
      breaker.openedUntilMs = this.now() + coolOffMs;
    }
    return breaker;
  }

  shouldRetry(statusCode, error) {
    if (error && !statusCode) return true;
    const status = Number(statusCode || 0);
    return status === 429 || status >= 500;
  }

  async tryAudit(type, payload) {
    if (!this.auditService || typeof this.auditService.log !== 'function') return;
    await this.auditService.log(type, payload);
  }

  buildInvokeUrl(endpoint) {
    const base = String(endpoint || '').trim();
    const path = this.runtimePath();
    if (!base) throw new AppError('instance runtime endpoint is missing', 409, 'RUNTIME_ENDPOINT_MISSING');
    return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
  }

  async invokeRemote(instance, request) {
    const retries = Math.max(0, Number(this.config.runtimeProxyMaxRetries || 2));
    const backoffMs = Math.max(0, Number(this.config.runtimeProxyRetryBackoffMs || 200));
    const invokeUrl = this.buildInvokeUrl(instance.runtime && instance.runtime.endpoint);
    const headers = {
      'content-type': 'application/json',
      'x-platform-instance-id': instance.id,
      'x-platform-tenant-id': instance.tenantId
    };
    if (String(this.config.runtimeProxySharedToken || '').trim()) {
      headers['x-runtime-proxy-token'] = String(this.config.runtimeProxySharedToken).trim();
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response;
      let errorObj = null;
      try {
        response = await this.httpClient.post(invokeUrl, request, { headers });
      } catch (error) {
        errorObj = error;
      }

      const statusCode = response ? Number(response.status || 0) : Number(errorObj && errorObj.response && errorObj.response.status || 0);
      const retryable = this.shouldRetry(statusCode, errorObj);
      if (response && statusCode >= 200 && statusCode < 300) {
        return { statusCode, data: response.data, invokeUrl, attempts: attempt + 1 };
      }

      lastError = {
        statusCode,
        retryable,
        message: errorObj
          ? String(errorObj.message || 'runtime request failed')
          : `runtime returned status ${statusCode}`
      };

      if (!retryable || attempt >= retries) break;
      await sleep(backoffMs * (attempt + 1));
    }

    throw new AppError(
      `runtime invoke failed: ${lastError ? lastError.message : 'unknown error'}`,
      502,
      'RUNTIME_PROXY_UPSTREAM_FAILED'
    );
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

    if (this.isBreakerOpen(instanceId)) {
      const breaker = this.getBreaker(instanceId);
      await this.tryAudit('runtime.proxy.degraded', {
        instanceId,
        tenantId: instance.tenantId,
        reason: 'circuit_open',
        openedUntilMs: breaker.openedUntilMs
      });
      return {
        mode: 'degraded',
        instanceId,
        endpoint: instance.runtime.endpoint,
        reason: 'circuit_open',
        openedUntilMs: breaker.openedUntilMs,
        requestAccepted: false
      };
    }

    try {
      const out = await this.invokeRemote(instance, request);
      this.markSuccess(instanceId);
      await this.tryAudit('runtime.proxy.succeeded', {
        instanceId,
        tenantId: instance.tenantId,
        statusCode: out.statusCode,
        attempts: out.attempts
      });
      return {
        mode: 'kubernetes',
        instanceId,
        endpoint: instance.runtime.endpoint,
        invokeUrl: out.invokeUrl,
        upstreamStatus: out.statusCode,
        attempts: out.attempts,
        response: out.data
      };
    } catch (error) {
      const breaker = this.markFailure(instanceId);
      await this.tryAudit('runtime.proxy.failed', {
        instanceId,
        tenantId: instance.tenantId,
        failureCount: breaker.failures,
        openedUntilMs: breaker.openedUntilMs || null,
        error: String(error.message || error)
      });
      if (breaker.openedUntilMs > this.now()) {
        return {
          mode: 'degraded',
          instanceId,
          endpoint: instance.runtime.endpoint,
          reason: 'circuit_open_after_failures',
          requestAccepted: false,
          openedUntilMs: breaker.openedUntilMs
        };
      }
      throw error;
    }
  }
}

module.exports = { RuntimeProxyService };
