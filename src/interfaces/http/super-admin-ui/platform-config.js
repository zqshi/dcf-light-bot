(function () {
  'use strict';

  const { apiFetch } = window.__platformAuth;

  const PROVIDER_LABELS = {
    openai: 'OpenAI', anthropic: 'Anthropic',
    deepseek: 'DeepSeek', minimax: 'MiniMax'
  };

  let _configData = null;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  function sourceChip(src) {
    if (!src) return '';
    const label = src === 'override' ? '已覆盖' : '环境变量';
    return `<span class="source-chip ${src}">${label}</span>`;
  }

  function displayVal(v) {
    if (v === true) return '启用';
    if (v === false) return '禁用';
    return String(v);
  }

  /* ── Field renderers ── */
  function cfgField(label, obj, editKey, editType) {
    const val = obj.value !== undefined ? obj.value : obj;
    const src = obj.source || '';
    const editHtml = editType === 'boolean'
      ? `<select data-key="${editKey}"><option value="true" ${val ? 'selected' : ''}>启用</option><option value="false" ${!val ? 'selected' : ''}>禁用</option></select>`
      : `<input data-key="${editKey}" type="${editType === 'number' ? 'number' : 'text'}" value="${esc(String(val))}" />`;
    return `
      <div class="cfg-field">
        <span class="cfg-label">${esc(label)}</span>
        <span class="cfg-val">${esc(displayVal(val))}${sourceChip(src)}</span>
        <span class="cfg-edit-row">${editHtml}</span>
      </div>`;
  }

  function readonlyField(label, val) {
    return `<div class="cfg-field"><span class="cfg-label">${esc(label)}</span><span class="cfg-val">${esc(displayVal(val))}</span></div>`;
  }

  /* ── Sections ── */
  function renderProviders(providers) {
    const grid = document.getElementById('providerGrid');
    grid.innerHTML = providers.map((p) => {
      const label = PROVIDER_LABELS[p.name] || p.name;
      const badge = p.configured
        ? '<span class="badge ok">已接入</span>'
        : '<span class="badge fail">未配置</span>';
      return `<div class="stat-item"><div class="stat-label">${esc(label)}</div><div class="stat-value" style="font-size:14px;">${badge}</div></div>`;
    }).join('') || '<div class="stat-item"><div class="stat-label">暂无 Provider</div><div class="stat-value">-</div></div>';
  }

  function renderResources(d) {
    document.getElementById('resourceBody').innerHTML = [
      cfgField('CPU', d.cpu, 'tenantDefaultCpu', 'text'),
      cfgField('内存', d.memory, 'tenantDefaultMemory', 'text'),
      cfgField('存储', d.storage, 'tenantDefaultStorage', 'text')
    ].join('');
  }

  function renderAudit(d) {
    document.getElementById('auditBody').innerHTML = [
      cfgField('日志保留', d.retentionEnabled, 'auditRetentionEnabled', 'boolean'),
      cfgField('保留天数', d.retentionTtlDays, 'auditRetentionTtlDays', 'number'),
      cfgField('最大条数', d.retentionMaxRows, 'auditRetentionMaxRows', 'number'),
      cfgField('归档', d.archiveEnabled, 'auditArchiveEnabled', 'boolean'),
      cfgField('归档最大条数', d.archiveMaxRows, 'auditArchiveMaxRows', 'number')
    ].join('');
  }

  function renderSla(d) {
    document.getElementById('slaBody').innerHTML = [
      cfgField('SLA 启用', d.slaEnabled, 'assetReviewSlaEnabled', 'boolean'),
      cfgField('SLA 时限 (小时)', d.slaHours, 'assetReviewSlaHours', 'number'),
      cfgField('升级最大层级', d.escalationMaxLevel, 'assetReviewEscalationMaxLevel', 'number'),
      cfgField('升级冷却 (小时)', d.escalationCooldownHours, 'assetReviewEscalationCooldownHours', 'number')
    ].join('');
  }

  function renderRuntime(d) {
    document.getElementById('runtimeBody').innerHTML = [
      readonlyField('OpenClaw 镜像', d.openclawImage),
      readonlyField('OpenClaw 版本', d.openclawRuntimeVersion),
      readonlyField('K8s 模拟模式', d.kubernetesSimulationMode ? '是' : '否'),
      readonlyField('K8s Namespace 前缀', d.kubernetesNamespacePrefix)
    ].join('');
  }

  function renderPlatform(d) {
    document.getElementById('platformBody').innerHTML = [
      cfgField('平台地址', d.baseUrl, 'platformBaseUrl', 'text'),
      readonlyField('默认租户 ID', d.defaultTenantId),
      readonlyField('持久化后端', d.persistenceBackend),
      readonlyField('SSO', d.ssoEnabled ? `启用（${d.ssoProvider}）` : '禁用'),
      cfgField('指标采集', d.metricsEnabled, 'metricsEnabled', 'boolean')
    ].join('');
  }

  function renderAll(data) {
    _configData = data;
    renderProviders(data.providers);
    renderResources(data.resourceDefaults);
    renderAudit(data.audit);
    renderSla(data.assetReview);
    renderRuntime(data.runtime);
    renderPlatform(data.platform);
  }

  /* ── Load ── */
  async function loadConfig() {
    const res = await apiFetch('/api/platform/config');
    const { data } = await res.json();
    renderAll(data);
  }

  /* ── Edit / Save ── */
  function enterEdit(sectionEl) {
    sectionEl.classList.add('editing');
  }

  function cancelEdit(sectionEl) {
    sectionEl.classList.remove('editing');
    if (_configData) renderAll(_configData);
  }

  async function saveSection(sectionEl) {
    const inputs = sectionEl.querySelectorAll('[data-key]');
    const payload = {};
    inputs.forEach((el) => {
      const key = el.dataset.key;
      let val = el.tagName === 'SELECT' ? el.value : el.value;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      payload[key] = val;
    });

    try {
      const res = await apiFetch('/api/platform/config', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const { data } = await res.json();
      sectionEl.classList.remove('editing');
      renderAll(data);
    } catch (err) {
      alert('保存失败：' + err.message);
    }
  }

  /* ── Events ── */
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.cfg-edit-btn');
    if (editBtn) {
      const section = editBtn.closest('.cfg-section');
      if (section) enterEdit(section);
      return;
    }
    const cancelBtn = e.target.closest('.cfg-cancel-btn');
    if (cancelBtn) {
      const section = cancelBtn.closest('.cfg-section');
      if (section) cancelEdit(section);
      return;
    }
    const saveBtn = e.target.closest('.cfg-save-btn');
    if (saveBtn) {
      const section = saveBtn.closest('.cfg-section');
      if (section) saveSection(section);
    }
  });

  /* ── Init ── */
  async function init() {
    await window.__platformReady;
    await loadConfig();
  }

  init();
})();
