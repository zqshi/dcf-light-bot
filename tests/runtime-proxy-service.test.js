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

  test('emits shared agent discovered audit events from runtime response', async () => {
    const audits = [];
    const httpClient = {
      post: async () => ({
        status: 200,
        data: {
          createdAgents: [
            {
              name: '采购比价子Agent',
              capabilitySignature: 'procurement:compare-price:v1',
              tags: ['采购', '比价'],
              jobCodes: ['procurement']
            }
          ]
        }
      })
    };
    const instanceService = { get: async () => runningInstance() };
    const service = new RuntimeProxyService(
      instanceService,
      { kubernetesSimulationMode: false },
      {
        httpClient,
        auditService: {
          log: async (type, payload) => {
            audits.push({ type, payload });
          }
        }
      }
    );

    const out = await service.invoke('inst_1', {
      input: '请根据任务创建子数字员工',
      sender: '@employee01:localhost',
      roomId: '!room:localhost',
      channel: 'matrix'
    });
    expect(out.mode).toBe('kubernetes');
    const discovered = audits.filter((x) => x.type === 'runtime.openclaw.shared_agent.discovered');
    expect(discovered).toHaveLength(1);
    expect(discovered[0].payload.capabilitySignature).toBe('procurement:compare-price:v1');
    expect(discovered[0].payload.ownerEmployeeId).toBe('inst_1');
    expect(discovered[0].payload.spawnedBy).toBe('@employee01:localhost');
    expect(discovered[0].payload.source).toBe('runtime/openclaw');
  });
});
