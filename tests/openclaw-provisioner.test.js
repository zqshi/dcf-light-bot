const { OpenClawProvisioner } = require('../src/infrastructure/k8s/OpenClawProvisioner');
const { AppError } = require('../src/shared/errors');
const yaml = require('yaml');

function baseConfig(overrides = {}) {
  return {
    kubernetesSimulationMode: true,
    kubernetesRollbackOnProvisionFailure: true,
    kubernetesNamespacePrefix: 'dcf',
    platformBaseUrl: 'http://localhost:3000',
    openclawImage: 'openclaw/openclaw:test',
    openclawRuntimeVersion: '2026.2.27',
    matrixHomeserver: 'https://matrix.org',
    matrixUserId: '@bot:matrix.org',
    matrixAccessToken: 'matrix-token',
    providers: [{ name: 'openai', key: 'k1' }],
    ...overrides
  };
}

describe('OpenClawProvisioner', () => {
  test('reconcile returns simulation result in simulation mode', async () => {
    const provisioner = new OpenClawProvisioner(baseConfig({ kubernetesSimulationMode: true }));
    const result = await provisioner.reconcile({ id: 'i1', tenantId: 't1', name: 'n1' });
    expect(result.mode).toBe('simulation');
    expect(result.ok).toBe(true);
  });

  test('provision failure triggers rollback when enabled', async () => {
    const provisioner = new OpenClawProvisioner(baseConfig({ kubernetesSimulationMode: false }));
    let rollbackCalled = false;
    provisioner.applyDesiredResources = async () => {
      throw new Error('apply failed');
    };
    provisioner.rollback = async () => {
      rollbackCalled = true;
      return { ok: true };
    };

    await expect(provisioner.provision({ id: 'i2', tenantId: 't2', name: 'n2' })).rejects.toBeInstanceOf(AppError);
    expect(rollbackCalled).toBe(true);
  });

  test('mounts tenant shared assets into generated openclaw config', async () => {
    const mounted = {
      all: [{ assetId: 'a1', assetType: 'tool', name: 'doc-reader', version: '1.0.0' }],
      byType: { skill: [], tool: [{ assetId: 'a1', name: 'doc-reader' }], knowledge: [] }
    };
    const provisioner = new OpenClawProvisioner(
      baseConfig({ kubernetesSimulationMode: false }),
      { resolveTenantAssets: async () => mounted }
    );

    let configContent = '';
    provisioner.ensureK8sClients = () => ({ core: {}, networking: {} });
    provisioner.ensureNamespace = async () => {};
    provisioner.upsertSecret = async () => {};
    provisioner.upsertPod = async () => {};
    provisioner.upsertService = async () => {};
    provisioner.upsertNetworkPolicy = async () => {};
    provisioner.upsertConfigMap = async (_core, _ns, _name, data) => {
      configContent = data['openclaw-config.yaml'];
    };

    await provisioner.applyDesiredResources({
      id: 'i3',
      tenantId: 't3',
      name: 'n3',
      resources: { cpu: '200m', memory: '512Mi' }
    });

    const parsed = yaml.parse(configContent);
    expect(parsed.sharedAssets.byType.tool).toHaveLength(1);
    expect(parsed.sharedAssets.byType.tool[0].name).toBe('doc-reader');
  });

  test('uses configured minimax/deepseek providers as runtime defaults', () => {
    const provisioner = new OpenClawProvisioner(
      baseConfig({
        providers: [
          { name: 'minimax', key: 'k_minimax' },
          { name: 'deepseek', key: 'k_deepseek' }
        ],
        minimaxApiBase: 'https://api.minimaxi.com/anthropic',
        minimaxModel: 'MiniMax-M2.5',
        deepseekApiBase: 'https://api.deepseek.com/v1',
        deepseekModel: 'deepseek-chat'
      })
    );
    const configText = provisioner.buildOpenClawConfig(
      { id: 'i9', tenantId: 't9', name: 'n9' },
      { namespace: 'n9', serviceName: 'n9-svc' },
      { all: [], byType: { skill: [], tool: [], knowledge: [] } }
    );
    const parsed = yaml.parse(configText);
    expect(parsed.runtime.model).toBe('minimax/MiniMax-M2.5');
    expect(parsed.models.providers.minimax.baseUrl).toBe('https://api.minimaxi.com/anthropic');
    expect(parsed.models.providers.deepseek.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  test('generates native matrix channel config and room allowlist for instance', () => {
    const provisioner = new OpenClawProvisioner(baseConfig());
    const configText = provisioner.buildOpenClawConfig(
      { id: 'i-mx', tenantId: 't-mx', name: 'mx-agent', matrixRoomId: '!room1:localhost' },
      { namespace: 'n-mx', serviceName: 'n-mx-svc' },
      { all: [], byType: { skill: [], tool: [], knowledge: [] } }
    );
    const parsed = yaml.parse(configText);
    expect(parsed.channels.matrix.enabled).toBe(true);
    expect(parsed.channels.matrix.userId).toBe('@bot:matrix.org');
    expect(parsed.channels.matrix.accessToken).toBe('${MATRIX_ACCESS_TOKEN}');
    expect(parsed.channels.matrix.groupPolicy).toBe('allowlist');
    expect(parsed.channels.matrix.groups['!room1:localhost'].requireMention).toBe(false);
    expect(parsed.matrix).toBeUndefined();
  });

  test('injects matrix credentials into secret data for channel runtime', () => {
    const provisioner = new OpenClawProvisioner(baseConfig());
    const secrets = provisioner.getProviderSecretData();
    expect(secrets.MATRIX_ACCESS_TOKEN).toBe('matrix-token');
    expect(secrets.MATRIX_HOMESERVER).toBe('https://matrix.org');
    expect(secrets.MATRIX_USER_ID).toBe('@bot:matrix.org');
  });

  test('continues provisioning when asset resolve fails and records mount issue', async () => {
    const provisioner = new OpenClawProvisioner(
      baseConfig({ kubernetesSimulationMode: false }),
      { resolveTenantAssets: async () => { throw new Error('resolver down'); } }
    );

    provisioner.ensureK8sClients = () => ({ core: {}, networking: {} });
    provisioner.ensureNamespace = async () => {};
    provisioner.upsertSecret = async () => {};
    provisioner.upsertPod = async () => {};
    provisioner.upsertService = async () => {};
    provisioner.upsertNetworkPolicy = async () => {};
    provisioner.upsertConfigMap = async () => {};

    const out = await provisioner.provision({
      id: 'i4',
      tenantId: 't4',
      name: 'n4',
      resources: { cpu: '200m', memory: '512Mi' }
    });

    expect(out.mode).toBe('kubernetes');
    expect(Array.isArray(out.mountIssues)).toBe(true);
    expect(out.mountIssues[0].code).toBe('ASSET_RESOLVE_FAILED');
  });

  test('waits until pod ready before marking provision succeeded', async () => {
    const provisioner = new OpenClawProvisioner(
      baseConfig({
        kubernetesSimulationMode: false,
        kubernetesReadyTimeoutMs: 5_000,
        kubernetesReadyPollIntervalMs: 10
      })
    );
    provisioner.applyDesiredResources = async () => ({ mountedAssets: { all: [] }, mountIssues: [] });
    provisioner.ensureK8sClients = () => ({
      core: {
        readNamespacedPod: async () => ({
          body: {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True', reason: 'ContainersReady' }]
            }
          }
        })
      }
    });

    const out = await provisioner.provision({ id: 'i-ready', tenantId: 't-ready', name: 'n-ready' });
    expect(out.readiness.status).toBe('ready');
    expect(out.matrixChannelCheck.status).toBe('degraded');
    expect(out.matrixChannelCheck.issues).toContain('room_not_bound');
    expect(out.mode).toBe('kubernetes');
  });

  test('matrix channel check is ready when room binding and auth are present', () => {
    const provisioner = new OpenClawProvisioner(baseConfig());
    const check = provisioner.buildMatrixChannelCheck(
      { id: 'i-r', matrixRoomId: '!roomA:localhost' },
      { status: 'ready' }
    );
    expect(check.status).toBe('ready');
    expect(check.roomBound).toBe(true);
    expect(check.authConfigured).toBe(true);
    expect(check.runtimeReady).toBe(true);
    expect(check.issues).toEqual([]);
  });

  test('fails provisioning when pod does not become ready in time', async () => {
    const provisioner = new OpenClawProvisioner(
      baseConfig({
        kubernetesSimulationMode: false,
        kubernetesReadyTimeoutMs: 50,
        kubernetesReadyPollIntervalMs: 10
      })
    );
    provisioner.applyDesiredResources = async () => ({ mountedAssets: { all: [] }, mountIssues: [] });
    provisioner.rollback = async () => ({ ok: true });
    provisioner.ensureK8sClients = () => ({
      core: {
        readNamespacedPod: async () => ({
          body: {
            status: {
              phase: 'Pending',
              conditions: [{ type: 'Ready', status: 'False', reason: 'ContainerCreating' }]
            }
          }
        })
      }
    });

    await expect(
      provisioner.provision({ id: 'i-timeout', tenantId: 't-timeout', name: 'n-timeout' })
    ).rejects.toBeInstanceOf(AppError);
  });
});
