const yaml = require('yaml');
const { AppError } = require('../../shared/errors');

class OpenClawProvisioner {
  constructor(config, options = {}) {
    this.config = config;
    this.simulation = Boolean(config.kubernetesSimulationMode);
    this.k8s = null;
    this.resolveTenantAssets = typeof options.resolveTenantAssets === 'function' ? options.resolveTenantAssets : null;
  }

  buildRuntimeNames(instance) {
    const base = `${this.config.kubernetesNamespacePrefix}-${instance.tenantId}`.toLowerCase();
    return {
      namespace: base,
      podName: `${base}-openclaw`,
      serviceName: `${base}-svc`,
      endpoint: `https://${instance.id}.${new URL(this.config.platformBaseUrl).host}`
    };
  }

  getProviderSecretData() {
    const data = {};
    for (const p of this.config.providers || []) {
      const key = String(p && p.key || '').trim();
      const name = String(p && p.name || '').trim().toUpperCase();
      if (!key || !name) continue;
      data[`${name}_API_KEY`] = key;
    }
    return data;
  }

  buildOpenClawConfig(instance, names, mountedAssets) {
    return yaml.stringify({
      runtime: {
        agent: 'main',
        model: 'openai/gpt-4.1-mini',
        default_model: 'openai/gpt-4.1-mini'
      },
      workspace: {
        directory: '/data/workspace'
      },
      memory: {
        enabled: true,
        directory: '/data/memory'
      },
      tenant: {
        tenantId: instance.tenantId,
        instanceId: instance.id,
        name: instance.name
      },
      platform: {
        controlPlaneBaseUrl: this.config.platformBaseUrl,
        assetReportEndpoint: `${this.config.platformBaseUrl}/api/control/assets/reports`
      },
      sharedAssets: mountedAssets || { all: [], byType: { skill: [], tool: [], knowledge: [] } },
      matrix: {
        homeserver: this.config.matrixHomeserver,
        userId: this.config.matrixUserId
      },
      runtimeRouting: {
        namespace: names.namespace,
        service: names.serviceName
      }
    });
  }

  ensureK8sClients() {
    if (this.k8s) return this.k8s;
    try {
      const k8s = require('@kubernetes/client-node');
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      this.k8s = {
        core: kc.makeApiClient(k8s.CoreV1Api),
        networking: kc.makeApiClient(k8s.NetworkingV1Api)
      };
      return this.k8s;
    } catch (error) {
      throw new AppError(`kubernetes client init failed: ${error.message}`, 500, 'K8S_CLIENT_INIT_FAILED');
    }
  }

  isNotFound(error) {
    return Number(error && error.response && error.response.statusCode) === 404;
  }

  async ensureNamespace(coreApi, namespace) {
    try {
      await coreApi.readNamespace(namespace);
      return;
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }
    await coreApi.createNamespace({
      metadata: {
        name: namespace,
        labels: {
          'dcf-light-bot/managed': 'true'
        }
      }
    });
  }

  async upsertSecret(coreApi, namespace, name, stringData) {
    const payload = {
      metadata: { name, namespace },
      type: 'Opaque',
      stringData
    };
    try {
      const current = await coreApi.readNamespacedSecret(name, namespace);
      await coreApi.replaceNamespacedSecret(name, namespace, {
        ...payload,
        metadata: {
          ...payload.metadata,
          resourceVersion: current.body.metadata.resourceVersion
        }
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        await coreApi.createNamespacedSecret(namespace, payload);
        return;
      }
      throw error;
    }
  }

  async upsertConfigMap(coreApi, namespace, name, data) {
    const payload = {
      metadata: { name, namespace },
      data
    };
    try {
      const current = await coreApi.readNamespacedConfigMap(name, namespace);
      await coreApi.replaceNamespacedConfigMap(name, namespace, {
        ...payload,
        metadata: {
          ...payload.metadata,
          resourceVersion: current.body.metadata.resourceVersion
        }
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        await coreApi.createNamespacedConfigMap(namespace, payload);
        return;
      }
      throw error;
    }
  }

  async upsertPod(coreApi, namespace, podName, serviceName, instance, secretName, configMapName) {
    const payload = {
      metadata: {
        name: podName,
        namespace,
        labels: {
          app: 'openclaw',
          'dcf-light-bot/instance': instance.id,
          'dcf-light-bot/tenant': instance.tenantId
        }
      },
      spec: {
        containers: [
          {
            name: 'openclaw',
            image: this.config.openclawImage,
            imagePullPolicy: 'IfNotPresent',
            ports: [{ containerPort: 3000, name: 'http' }],
            envFrom: [
              { secretRef: { name: secretName } },
              { configMapRef: { name: configMapName } }
            ],
            resources: {
              requests: {
                cpu: instance.resources.cpu,
                memory: instance.resources.memory
              },
              limits: {
                cpu: instance.resources.cpu,
                memory: instance.resources.memory
              }
            }
          }
        ],
        restartPolicy: 'Always'
      }
    };

    try {
      const current = await coreApi.readNamespacedPod(podName, namespace);
      await coreApi.replaceNamespacedPod(podName, namespace, {
        ...payload,
        metadata: {
          ...payload.metadata,
          resourceVersion: current.body.metadata.resourceVersion
        }
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        await coreApi.createNamespacedPod(namespace, payload);
        return;
      }
      throw error;
    }

    await this.upsertService(coreApi, namespace, serviceName, instance);
  }

  async upsertService(coreApi, namespace, serviceName, instance) {
    const payload = {
      metadata: {
        name: serviceName,
        namespace
      },
      spec: {
        selector: {
          app: 'openclaw',
          'dcf-light-bot/instance': instance.id,
          'dcf-light-bot/tenant': instance.tenantId
        },
        ports: [{ port: 80, targetPort: 3000, protocol: 'TCP', name: 'http' }],
        type: 'ClusterIP'
      }
    };

    try {
      const current = await coreApi.readNamespacedService(serviceName, namespace);
      await coreApi.replaceNamespacedService(serviceName, namespace, {
        ...payload,
        metadata: {
          ...payload.metadata,
          resourceVersion: current.body.metadata.resourceVersion
        }
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        await coreApi.createNamespacedService(namespace, payload);
        return;
      }
      throw error;
    }
  }

  async upsertNetworkPolicy(networkingApi, namespace, policyName, tenantId) {
    const payload = {
      metadata: {
        name: policyName,
        namespace
      },
      spec: {
        podSelector: {
          matchLabels: {
            'dcf-light-bot/tenant': tenantId
          }
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [{ from: [{ podSelector: { matchLabels: { 'dcf-light-bot/tenant': tenantId } } }] }],
        egress: [{ to: [{ ipBlock: { cidr: '0.0.0.0/0' } }] }]
      }
    };

    try {
      const current = await networkingApi.readNamespacedNetworkPolicy(policyName, namespace);
      await networkingApi.replaceNamespacedNetworkPolicy(policyName, namespace, {
        ...payload,
        metadata: {
          ...payload.metadata,
          resourceVersion: current.body.metadata.resourceVersion
        }
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        await networkingApi.createNamespacedNetworkPolicy(namespace, payload);
        return;
      }
      throw error;
    }
  }

  async applyDesiredResources(instance) {
    const names = this.buildRuntimeNames(instance);
    const clients = this.ensureK8sClients();
    const providerSecrets = this.getProviderSecretData();
    const mountedAssets = this.resolveTenantAssets ? await this.resolveTenantAssets(instance.tenantId) : { all: [], byType: {} };
    const configText = this.buildOpenClawConfig(instance, names, mountedAssets);
    const secretName = `${names.namespace}-providers`;
    const configMapName = `${names.namespace}-config`;
    const policyName = `${names.namespace}-isolation`;

    await this.ensureNamespace(clients.core, names.namespace);
    await this.upsertSecret(clients.core, names.namespace, secretName, providerSecrets);
    await this.upsertConfigMap(clients.core, names.namespace, configMapName, {
      'openclaw-config.yaml': configText
    });
    await this.upsertPod(clients.core, names.namespace, names.podName, names.serviceName, instance, secretName, configMapName);
    await this.upsertService(clients.core, names.namespace, names.serviceName, instance);
    await this.upsertNetworkPolicy(clients.networking, names.namespace, policyName, instance.tenantId);

    return { names, secretName, configMapName, policyName, mountedAssets };
  }

  async safeDelete(work, ...args) {
    try {
      await work(...args);
      return { deleted: true };
    } catch (error) {
      if (this.isNotFound(error)) return { deleted: false, notFound: true };
      throw error;
    }
  }

  async rollback(instance) {
    const names = this.buildRuntimeNames(instance);
    if (this.simulation) {
      return { ok: true, mode: 'simulation', names };
    }
    const clients = this.ensureK8sClients();
    const secretName = `${names.namespace}-providers`;
    const configMapName = `${names.namespace}-config`;
    const policyName = `${names.namespace}-isolation`;

    try {
      await this.safeDelete(clients.core.deleteNamespacedPod.bind(clients.core), names.podName, names.namespace);
      await this.safeDelete(clients.core.deleteNamespacedService.bind(clients.core), names.serviceName, names.namespace);
      await this.safeDelete(clients.core.deleteNamespacedConfigMap.bind(clients.core), configMapName, names.namespace);
      await this.safeDelete(clients.core.deleteNamespacedSecret.bind(clients.core), secretName, names.namespace);
      await this.safeDelete(clients.networking.deleteNamespacedNetworkPolicy.bind(clients.networking), policyName, names.namespace);
      return { ok: true, mode: 'kubernetes', names };
    } catch (error) {
      throw new AppError(`kubernetes rollback failed: ${error.message}`, 500, 'K8S_ROLLBACK_FAILED');
    }
  }

  async provision(instance) {
    const names = this.buildRuntimeNames(instance);
    if (this.simulation) {
      return { ...names, mode: 'simulation', providerKeysInjected: true };
    }

    try {
      await this.applyDesiredResources(instance);
      return { ...names, mode: 'kubernetes', providerKeysInjected: true };
    } catch (error) {
      if (this.config.kubernetesRollbackOnProvisionFailure !== false) {
        try {
          await this.rollback(instance);
        } catch (rollbackError) {
          throw new AppError(
            `kubernetes provision failed: ${error.message}; rollback failed: ${rollbackError.message}`,
            500,
            'K8S_PROVISION_AND_ROLLBACK_FAILED'
          );
        }
      }
      throw new AppError(`kubernetes provision failed: ${error.message}`, 500, 'K8S_PROVISION_FAILED');
    }
  }

  async reconcile(instance) {
    const names = this.buildRuntimeNames(instance);
    if (this.simulation) {
      return { ok: true, mode: 'simulation', driftRepaired: false, names };
    }
    try {
      await this.applyDesiredResources(instance);
      return { ok: true, mode: 'kubernetes', driftRepaired: true, names };
    } catch (error) {
      throw new AppError(`kubernetes reconcile failed: ${error.message}`, 500, 'K8S_RECONCILE_FAILED');
    }
  }

  async start(instance) {
    if (this.simulation) return { ok: true, mode: 'simulation', instanceId: instance.id };
    const names = this.buildRuntimeNames(instance);
    const clients = this.ensureK8sClients();
    try {
      const pod = await clients.core.readNamespacedPod(names.podName, names.namespace);
      return { ok: true, mode: 'kubernetes', phase: pod.body.status.phase || 'Unknown' };
    } catch (error) {
      throw new AppError(`kubernetes start check failed: ${error.message}`, 500, 'K8S_START_FAILED');
    }
  }

  async stop(instance) {
    if (this.simulation) return { ok: true, mode: 'simulation', instanceId: instance.id };
    const names = this.buildRuntimeNames(instance);
    const clients = this.ensureK8sClients();
    try {
      await clients.core.deleteNamespacedPod(names.podName, names.namespace);
      return { ok: true, mode: 'kubernetes' };
    } catch (error) {
      if (this.isNotFound(error)) return { ok: true, mode: 'kubernetes', alreadyStopped: true };
      throw new AppError(`kubernetes stop failed: ${error.message}`, 500, 'K8S_STOP_FAILED');
    }
  }
}

module.exports = { OpenClawProvisioner };
