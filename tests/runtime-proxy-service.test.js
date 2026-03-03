const { RuntimeProxyService } = require('../src/contexts/tenant-instance/application/RuntimeProxyService');

function runningInstance() {
  return {
    id: 'inst_1',
    tenantId: 'tenant_1',
    state: 'running',
    runtime: { endpoint: 'http://runtime.local' }
  };
}

describe('RuntimeProxyService', () => {
  test('forwards to runtime endpoint in kubernetes mode', async () => {
    const calls = [];
    const httpClient = {
      post: async (url, body, opts) => {
        calls.push({ url, body, opts });
        return { status: 200, data: { ok: true } };
      }
    };
    const instanceService = { get: async () => runningInstance() };
    const service = new RuntimeProxyService(instanceService, { kubernetesSimulationMode: false }, { httpClient });

    const out = await service.invoke('inst_1', { action: 'ping' });
    expect(out.mode).toBe('kubernetes');
    expect(out.response.ok).toBe(true);
    expect(calls[0].url).toBe('http://runtime.local/api/runtime/invoke');
  });

  test('retries upstream failures and degrades when circuit opens', async () => {
    let attempt = 0;
    const httpClient = {
      post: async () => {
        attempt += 1;
        return { status: 503, data: { message: 'busy' } };
      }
    };
    const instanceService = { get: async () => runningInstance() };
    const service = new RuntimeProxyService(
      instanceService,
      {
        kubernetesSimulationMode: false,
        runtimeProxyMaxRetries: 1,
        runtimeProxyRetryBackoffMs: 0,
        runtimeProxyFailureThreshold: 1,
        runtimeProxyBreakerCoolOffMs: 30000
      },
      { httpClient }
    );

    const out = await service.invoke('inst_1', { action: 'ping' });
    expect(attempt).toBe(2);
    expect(out.mode).toBe('degraded');
    expect(out.reason).toContain('circuit_open');
  });

  test('returns degraded response immediately when breaker already open', async () => {
    const httpClient = {
      post: async () => ({ status: 200, data: { ok: true } })
    };
    const instanceService = { get: async () => runningInstance() };
    const service = new RuntimeProxyService(
      instanceService,
      { kubernetesSimulationMode: false, runtimeProxyFailureThreshold: 1, runtimeProxyBreakerCoolOffMs: 5000 },
      { httpClient }
    );
    service.breakers.set('inst_1', { failures: 2, openedUntilMs: Date.now() + 4000 });

    const out = await service.invoke('inst_1', { action: 'ping' });
    expect(out.mode).toBe('degraded');
    expect(out.reason).toBe('circuit_open');
  });
});
