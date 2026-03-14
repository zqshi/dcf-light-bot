const yaml = require('yaml');
const { AppError } = require('../../shared/errors');

function sleep(ms) {
  const delay = Math.max(0, Number(ms || 0));
  if (!delay) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

class OpenClawProvisioner {
  constructor(config, options = {}) {
    this.config = config;
    this.simulation = Boolean(config.kubernetesSimulationMode);
    this.k8s = null;
    this.resolveTenantAssets = typeof options.resolveTenantAssets === 'function' ? options.resolveTenantAssets : null;
    this.validateMountedAssets = typeof options.validateMountedAssets === 'function' ? options.validateMountedAssets : null;
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

  buildMatrixChannelCheck(instance, readiness) {
    const roomId = String(instance && instance.matrixRoomId || '').trim();
    const hasRoomBinding = Boolean(roomId);
    const hasUserId = Boolean(String(this.config.matrixUserId || '').trim());
    const hasHomeserver = Boolean(String(this.config.matrixHomeserver || '').trim());
    const hasToken = Boolean(String(this.config.matrixAccessToken || '').trim());
    const hasPassword = Boolean(String(this.config.matrixPassword || '').trim());
    const authConfigured = hasUserId && hasHomeserver && (hasToken || hasPassword);
    const runtimeReady = String(readiness && readiness.status || '').toLowerCase() === 'ready';
    const status = authConfigured && hasRoomBinding && runtimeReady ? 'ready' : 'degraded';
    const issues = [];
    if (!hasRoomBinding) issues.push('room_not_bound');
    if (!hasUserId) issues.push('matrix_user_missing');
    if (!hasHomeserver) issues.push('matrix_homeserver_missing');
    if (!hasToken && !hasPassword) issues.push('matrix_auth_missing');
    if (!runtimeReady) issues.push('runtime_not_ready');
    return {
      status,
      roomId: roomId || null,
      roomBound: hasRoomBinding,
      authConfigured,
      runtimeReady,
      readinessStatus: String(readiness && readiness.status || ''),
      issues,
      checkedAt: new Date().toISOString()
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
    const matrixAccessToken = String(this.config.matrixAccessToken || '').trim();
    if (matrixAccessToken) {
      data.MATRIX_ACCESS_TOKEN = matrixAccessToken;
    }
    const matrixPassword = String(this.config.matrixPassword || '').trim();
    if (matrixPassword) {
      data.MATRIX_PASSWORD = matrixPassword;
    }
    const matrixHomeserver = String(this.config.matrixHomeserver || '').trim();
    if (matrixHomeserver) {
      data.MATRIX_HOMESERVER = matrixHomeserver;
    }
    const matrixUserId = String(this.config.matrixUserId || '').trim();
    if (matrixUserId) {
      data.MATRIX_USER_ID = matrixUserId;
    }
    return data;
  }

  getRuntimeModelRef() {
    const names = new Set((this.config.providers || []).map((x) => String(x && x.name || '').toLowerCase()));
    if (names.has('minimax')) return `minimax/${this.config.minimaxModel}`;
    if (names.has('deepseek')) return `deepseek/${this.config.deepseekModel}`;
    if (names.has('openai')) return 'openai/gpt-4.1-mini';
    if (names.has('anthropic')) return 'anthropic/claude-sonnet-4-5';
    return 'openai/gpt-4.1-mini';
  }

  buildProviderModelsConfig() {
    const out = {};
    const names = new Set((this.config.providers || []).map((x) => String(x && x.name || '').toLowerCase()));
    if (names.has('minimax')) {
      out.minimax = {
        baseUrl: this.config.minimaxApiBase,
        apiKey: '${MINIMAX_API_KEY}',
        api: 'anthropic-messages',
        models: [{ id: this.config.minimaxModel, name: this.config.minimaxModel }]
      };
    }
    if (names.has('deepseek')) {
      out.deepseek = {
        baseUrl: this.config.deepseekApiBase,
        apiKey: '${DEEPSEEK_API_KEY}',
        api: 'openai-responses',
        models: [{ id: this.config.deepseekModel, name: this.config.deepseekModel }]
      };
    }
    return out;
  }

  buildOpenClawConfig(instance, names, mountedAssets) {
    const runtimeModel = this.getRuntimeModelRef();
    const providersConfig = this.buildProviderModelsConfig();
    const roomId = String(instance && instance.matrixRoomId || '').trim();
    const matrixGroups = roomId
      ? {
          [roomId]: {
            enabled: true,
            requireMention: false,
            autoReply: true
          }
        }
      : {};
    return yaml.stringify({
      runtime: {
        agent: 'main',
        model: runtimeModel,
        default_model: runtimeModel
      },
      agents: {
        defaults: {
          model: { primary: runtimeModel }
        }
      },
      models: {
        mode: 'merge',
        providers: providersConfig
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
      channels: {
        defaults: {
          groupPolicy: 'allowlist'
        },
        matrix: {
          enabled: true,
          homeserver: this.config.matrixHomeserver,
          userId: this.config.matrixUserId,
          accessToken: '${MATRIX_ACCESS_TOKEN}',
          dm: {
            enabled: false,
            policy: 'disabled',
            allowFrom: []
          },
          groupPolicy: 'allowlist',
          groups: matrixGroups
        }
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
    const mountIssues = [];
    let mountedAssets = { all: [], byType: { skill: [], tool: [], knowledge: [] } };

    if (this.resolveTenantAssets) {
      try {
        const resolved = await this.resolveTenantAssets(instance.tenantId);
        mountedAssets = {
          all: Array.isArray(resolved && resolved.all) ? resolved.all : [],
          byType: resolved && resolved.byType ? resolved.byType : { skill: [], tool: [], knowledge: [] }
        };
      } catch (error) {
        mountIssues.push({
          code: 'ASSET_RESOLVE_FAILED',
          message: String(error.message || error)
        });
      }
    }

    if (this.validateMountedAssets) {
      try {
        const validated = await this.validateMountedAssets(this.config.openclawRuntimeVersion || '', mountedAssets);
        if (validated && validated.accepted) {
          mountedAssets = validated.accepted;
        }
        const rejected = Array.isArray(validated && validated.rejected) ? validated.rejected : [];
        if (rejected.length) {
          mountIssues.push({
            code: 'ASSET_COMPATIBILITY_REJECTED',
            count: rejected.length,
            rejected
          });
        }
      } catch (error) {
        mountIssues.push({
          code: 'ASSET_VALIDATE_FAILED',
          message: String(error.message || error)
        });
      }
    }

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

    return { names, secretName, configMapName, policyName, mountedAssets, mountIssues };
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
      const readiness = {
        status: 'ready',
        mode: 'simulation',
        checkedAt: new Date().toISOString()
      };
      const matrixChannelCheck = this.buildMatrixChannelCheck(instance, readiness);
      return {
        ...names,
        mode: 'simulation',
        providerKeysInjected: true,
        mountIssues: [],
        readiness,
        matrixChannelCheck
      };
    }

    try {
      const out = await this.applyDesiredResources(instance);
      const readiness = await this.waitForRuntimeReady(instance, names);
      const matrixChannelCheck = this.buildMatrixChannelCheck(instance, readiness);
      return {
        ...names,
        mode: 'kubernetes',
        providerKeysInjected: true,
        mountedAssetCount: Array.isArray(out.mountedAssets && out.mountedAssets.all) ? out.mountedAssets.all.length : 0,
        mountIssues: Array.isArray(out.mountIssues) ? out.mountIssues : [],
        readiness,
        matrixChannelCheck
      };
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
      return { ok: true, mode: 'simulation', driftRepaired: false, names, mountIssues: [] };
    }
    try {
      const out = await this.applyDesiredResources(instance);
      return {
        ok: true,
        mode: 'kubernetes',
        driftRepaired: true,
        names,
        mountIssues: Array.isArray(out.mountIssues) ? out.mountIssues : []
      };
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

  isPodReady(pod) {
    const body = pod && pod.body && typeof pod.body === 'object' ? pod.body : {};
    const status = body.status && typeof body.status === 'object' ? body.status : {};
    const phase = String(status.phase || '').toLowerCase();
    if (phase !== 'running') return false;
    const conditions = Array.isArray(status.conditions) ? status.conditions : [];
    return conditions.some((x) => String(x && x.type || '').toLowerCase() === 'ready' && String(x && x.status || '').toLowerCase() === 'true');
  }

  async waitForRuntimeReady(instance, names) {
    const enabled = this.config.kubernetesWaitForReady !== false;
    if (!enabled) {
      return {
        status: 'skipped',
        reason: 'disabled',
        checkedAt: new Date().toISOString()
      };
    }
    const clients = this.ensureK8sClients();
    if (!clients || !clients.core || typeof clients.core.readNamespacedPod !== 'function') {
      return {
        status: 'skipped',
        reason: 'missing_core_client',
        checkedAt: new Date().toISOString()
      };
    }
    const timeoutMs = Math.max(500, Number(this.config.kubernetesReadyTimeoutMs || 120_000));
    const intervalMs = Math.max(100, Number(this.config.kubernetesReadyPollIntervalMs || 3_000));
    const startedAt = Date.now();
    let lastPhase = 'unknown';
    let lastReason = 'pending';

    while ((Date.now() - startedAt) <= timeoutMs) {
      try {
        const pod = await clients.core.readNamespacedPod(names.podName, names.namespace);
        const status = pod && pod.body && pod.body.status && typeof pod.body.status === 'object'
          ? pod.body.status
          : {};
        lastPhase = String(status.phase || 'unknown').toLowerCase();
        const conditions = Array.isArray(status.conditions) ? status.conditions : [];
        const ready = conditions.find((x) => String(x && x.type || '').toLowerCase() === 'ready');
        lastReason = String((ready && (ready.reason || ready.message)) || status.reason || 'pending');
        if (this.isPodReady(pod)) {
          return {
            status: 'ready',
            phase: lastPhase,
            reason: lastReason,
            readyAt: new Date().toISOString(),
            waitedMs: Date.now() - startedAt
          };
        }
      } catch (error) {
        lastReason = String(error && error.message || 'read pod failed');
      }
      await sleep(intervalMs);
    }

    throw new AppError(
      `openclaw pod not ready within timeout: phase=${lastPhase}, reason=${lastReason}`,
      504,
      'K8S_RUNTIME_NOT_READY'
    );
  }
}

module.exports = { OpenClawProvisioner };
