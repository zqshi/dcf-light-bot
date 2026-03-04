async function api(path, options = {}) {
  if (window.adminApi) return window.adminApi(path, options);
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || 'request failed');
  return body;
}

function getNode(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = getNode(id);
  if (node) node.textContent = String(value || '');
}

function showStatus(message, isError = false) {
  const node = getNode('openclawConfigStatus');
  if (!node) return;
  node.textContent = String(message || '');
  node.style.color = isError ? '#932727' : '#5e6f8e';
}

function fillForm(data) {
  const runtime = data.runtime || {};
  const providers = data.providers || {};
  const deepseek = providers.deepseek || {};
  const minimax = providers.minimax || {};
  const template = data.permissionTemplate || {};

  const setValue = (id, value) => {
    const node = getNode(id);
    if (node) node.value = String(value || '');
  };
  const setCheck = (id, value) => {
    const node = getNode(id);
    if (node) node.checked = Boolean(value);
  };

  setValue('openclawImageInput', runtime.openclawImage || '');
  setValue('runtimeVersionInput', runtime.openclawRuntimeVersion || '');
  setValue('openclawSourcePathInput', runtime.openclawSourcePath || '');

  setCheck('deepseekEnabled', deepseek.enabled);
  setValue('deepseekModel', deepseek.model || '');
  setValue('deepseekApiBase', deepseek.apiBase || '');
  setText('deepseekMasked', deepseek.hasKey ? `当前密钥：${deepseek.apiKeyMasked || '已配置'}` : '当前密钥：未配置');
  setValue('deepseekApiKey', '');

  setCheck('minimaxEnabled', minimax.enabled);
  setValue('minimaxModel', minimax.model || '');
  setValue('minimaxApiBase', minimax.apiBase || '');
  setText('minimaxMasked', minimax.hasKey ? `当前密钥：${minimax.apiKeyMasked || '已配置'}` : '当前密钥：未配置');
  setValue('minimaxApiKey', '');

  const allowlist = Array.isArray(template.commandAllowlist) ? template.commandAllowlist : [];
  setValue('commandAllowlistInput', allowlist.join('\n'));
  setValue('approvalByRiskInput', JSON.stringify(template.approvalByRisk || {}, null, 2));

  setText('openclawImageStat', runtime.openclawImage || '-');
  setText('runtimeVersionStat', runtime.openclawRuntimeVersion || '-');
  const enabledCount = [deepseek, minimax].filter((x) => x && x.enabled).length;
  setText('providerCountStat', String(enabledCount));
  setText('updatedAtStat', data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-');
}

function readFormPayload() {
  const parseJson = (id) => {
    const raw = String((getNode(id) && getNode(id).value) || '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('审批模板 JSON 格式不正确');
    }
  };
  const parseLines = (id) => String((getNode(id) && getNode(id).value) || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  const deepseekKey = String((getNode('deepseekApiKey') && getNode('deepseekApiKey').value) || '').trim();
  const minimaxKey = String((getNode('minimaxApiKey') && getNode('minimaxApiKey').value) || '').trim();

  return {
    runtime: {
      openclawImage: String((getNode('openclawImageInput') && getNode('openclawImageInput').value) || '').trim(),
      openclawRuntimeVersion: String((getNode('runtimeVersionInput') && getNode('runtimeVersionInput').value) || '').trim(),
      openclawSourcePath: String((getNode('openclawSourcePathInput') && getNode('openclawSourcePathInput').value) || '').trim()
    },
    providers: {
      deepseek: {
        enabled: Boolean(getNode('deepseekEnabled') && getNode('deepseekEnabled').checked),
        apiBase: String((getNode('deepseekApiBase') && getNode('deepseekApiBase').value) || '').trim(),
        model: String((getNode('deepseekModel') && getNode('deepseekModel').value) || '').trim(),
        ...(deepseekKey ? { apiKey: deepseekKey } : {})
      },
      minimax: {
        enabled: Boolean(getNode('minimaxEnabled') && getNode('minimaxEnabled').checked),
        apiBase: String((getNode('minimaxApiBase') && getNode('minimaxApiBase').value) || '').trim(),
        model: String((getNode('minimaxModel') && getNode('minimaxModel').value) || '').trim(),
        ...(minimaxKey ? { apiKey: minimaxKey } : {})
      }
    },
    permissionTemplate: {
      commandAllowlist: parseLines('commandAllowlistInput'),
      approvalByRisk: parseJson('approvalByRiskInput')
    }
  };
}

async function loadConfig() {
  const data = await api('/api/admin/runtime/openclaw-config');
  fillForm(data);
}

function bindEvents() {
  const saveBtn = getNode('saveOpenClawConfigBtn');
  const reloadBtn = getNode('reloadOpenClawConfigBtn');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const payload = readFormPayload();
        await api('/api/admin/runtime/openclaw-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        await loadConfig();
        showStatus('配置已保存（新建实例实时生效；已运行实例按重建/重启策略生效）');
      } catch (error) {
        showStatus(`保存失败：${error.message}`, true);
      }
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      try {
        await loadConfig();
        showStatus('已重新加载配置');
      } catch (error) {
        showStatus(`加载失败：${error.message}`, true);
      }
    });
  }
}

(async () => {
  try {
    if (window.__adminReady) await window.__adminReady;
    bindEvents();
    await loadConfig();
  } catch (error) {
    showStatus(`初始化失败：${error.message}`, true);
  }
})();
