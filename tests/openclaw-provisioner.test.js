const { OpenClawProvisioner } = require('../src/infrastructure/k8s/OpenClawProvisioner');
const { AppError } = require('../src/shared/errors');

function baseConfig(overrides = {}) {
  return {
    kubernetesSimulationMode: true,
    kubernetesRollbackOnProvisionFailure: true,
    kubernetesNamespacePrefix: 'dcf',
    platformBaseUrl: 'http://localhost:3000',
    openclawImage: 'openclaw/openclaw:test',
    matrixHomeserver: 'https://matrix.org',
    matrixUserId: '@bot:matrix.org',
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
});
