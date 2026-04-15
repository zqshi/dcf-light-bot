(function () {
  'use strict';

  const { apiFetch } = window.__platformAuth;

  const STATUS_LABELS = { active: '活跃', suspended: '已暂停', archived: '已归档' };
  const PLAN_LABELS = { free: '免费版', standard: '标准版', enterprise: '企业版' };
  const INDUSTRY_LABELS = {
    fintech: '金融科技', ecommerce: '电子商务', healthcare: '医疗健康',
    education: '教育', manufacturing: '制造业', technology: '科技', other: '其他'
  };
  const SIZE_LABELS = {
    startup: '初创', small: '小型', medium: '中型', large: '大型', enterprise: '集团'
  };

  /* ── Plan quota defaults (mirror Tenant.js DEFAULT_QUOTAS) ── */
  const PLAN_QUOTAS = {
    free: {
      maxInstances: 3, maxConcurrentInstances: 2, maxUsers: 5,
      instanceCpu: '250m', instanceMemory: '256Mi', instanceStorage: '1Gi',
      maxStorageMB: 1024, knowledgeBaseSizeMB: 256,
      tokenBudgetMonthly: 100000, tokenBudgetDaily: 5000,
      apiCallsDaily: 1000, rateLimitPerMinute: 20,
      dataRetentionDays: 30, maxWebhooks: 2
    },
    standard: {
      maxInstances: 10, maxConcurrentInstances: 5, maxUsers: 50,
      instanceCpu: '500m', instanceMemory: '512Mi', instanceStorage: '2Gi',
      maxStorageMB: 10240, knowledgeBaseSizeMB: 1024,
      tokenBudgetMonthly: 1000000, tokenBudgetDaily: 50000,
      apiCallsDaily: 10000, rateLimitPerMinute: 60,
      dataRetentionDays: 90, maxWebhooks: 10
    },
    enterprise: {
      maxInstances: 100, maxConcurrentInstances: 50, maxUsers: 500,
      instanceCpu: '1000m', instanceMemory: '1Gi', instanceStorage: '5Gi',
      maxStorageMB: 102400, knowledgeBaseSizeMB: 10240,
      tokenBudgetMonthly: 10000000, tokenBudgetDaily: 500000,
      apiCallsDaily: 100000, rateLimitPerMinute: 300,
      dataRetentionDays: 365, maxWebhooks: 50
    }
  };

  const CPU_OPTIONS = [
    { value: '250m', label: '0.25 核' },
    { value: '500m', label: '0.5 核' },
    { value: '1000m', label: '1 核' },
    { value: '2000m', label: '2 核' },
    { value: '4000m', label: '4 核' }
  ];
  const MEMORY_OPTIONS = [
    { value: '256Mi', label: '256 MB' },
    { value: '512Mi', label: '512 MB' },
    { value: '1Gi', label: '1 GB' },
    { value: '2Gi', label: '2 GB' },
    { value: '4Gi', label: '4 GB' },
    { value: '8Gi', label: '8 GB' }
  ];
  const STORAGE_OPTIONS = [
    { value: '1Gi', label: '1 GB' },
    { value: '2Gi', label: '2 GB' },
    { value: '5Gi', label: '5 GB' },
    { value: '10Gi', label: '10 GB' },
    { value: '20Gi', label: '20 GB' },
    { value: '50Gi', label: '50 GB' }
  ];

  let _tenants = [];
  let _providers = [];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function statusBadge(status) {
    const cls = status === 'active' ? 'ok' : status === 'suspended' ? 'warn' : 'fail';
    return `<span class="badge ${cls}">${esc(STATUS_LABELS[status] || status)}</span>`;
  }

  function selectHtml(options, selected, id, disabled) {
    const dis = disabled ? 'disabled' : '';
    return `<select id="${id}" ${dis}>${options.map((o) =>
      `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${esc(o.label)}</option>`
    ).join('')}</select>`;
  }

  function fmtNum(n) { return n == null ? '-' : Number(n).toLocaleString('zh-CN'); }

  /* ── Stats ── */
  function renderStats(tenants) {
    document.getElementById('tenantTotal').textContent = tenants.length;
    document.getElementById('tenantActive').textContent = tenants.filter((t) => t.status === 'active').length;
    document.getElementById('tenantSuspended').textContent = tenants.filter((t) => t.status === 'suspended').length;
  }

  /* ── Table ── */
  function renderTable(tenants) {
    const body = document.getElementById('tenantBody');
    if (!tenants.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">暂无租户，点击「创建租户」开始</td></tr>';
      return;
    }
    body.innerHTML = tenants.map((t) => {
      const q = t.quotas || {};
      return `
      <tr data-tenant-id="${t.id}" style="cursor:pointer;">
        <td><strong>${esc(t.name)}</strong></td>
        <td><code style="font-size:12px;color:var(--text-soft);">${esc(t.slug)}</code></td>
        <td>${esc(INDUSTRY_LABELS[t.industry] || t.industry || '-')}</td>
        <td>${esc(PLAN_LABELS[t.plan] || t.plan)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${q.maxInstances ? `- / ${q.maxInstances}` : '-'}</td>
        <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString('zh-CN') : '-'}</td>
        <td>
          ${t.status === 'active' ? `<button class="btn-link" data-action="suspend" data-id="${t.id}">暂停</button>` : ''}
          ${t.status === 'suspended' ? `<button class="btn-link" data-action="activate" data-id="${t.id}">激活</button>` : ''}
          ${t.status !== 'archived' ? `<button class="btn-link" data-action="archive" data-id="${t.id}" style="color:#dc2626;">归档</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Load ── */
  async function loadTenants() {
    const res = await apiFetch('/api/platform/tenants');
    const data = await res.json();
    _tenants = data.data || [];
    renderStats(_tenants);
    renderTable(_tenants);
  }

  async function loadProviders() {
    try {
      const res = await apiFetch('/api/platform/config');
      const { data } = await res.json();
      _providers = (data.providers || []).map((p) => p.name);
    } catch { _providers = []; }
  }

  /* ── Actions ── */
  async function handleAction(action, tenantId) {
    const labels = { suspend: '暂停', activate: '激活', archive: '归档' };
    if (!confirm(`确定${labels[action] || action}该租户？`)) return;
    await apiFetch(`/api/platform/tenants/${tenantId}/${action}`, { method: 'POST' });
    await loadTenants();
  }

  /* ═══════════════════════════════════════════════
   * 配额表单 HTML 片段（创建/编辑共用）
   * prefix: 'create' | 'edit'，用于 id 命名
   * q: 当前配额值对象
   * ma: modelAccess 对象
   * dis: '' | 'disabled'
   * ═══════════════════════════════════════════════ */
  function quotaFormHtml(prefix, q, ma, dis) {
    const providerChecks = _providers.map((p) =>
      `<label class="td-check-item"><input type="checkbox" class="${prefix}-provider-cb" value="${esc(p)}" ${(ma.allowedProviders || []).includes(p) ? 'checked' : ''} ${dis}> ${esc(p)}</label>`
    ).join('') || '<span style="color:var(--text-soft);font-size:13px;">暂无可用 Provider</span>';

    return `
      <div class="td-section">
        <h4 class="td-section-title">实例资源配额</h4>
        <p class="td-hint" style="margin-bottom:10px;">控制租户可创建的实例数量及每个实例分配的计算资源</p>
        <div class="td-sub-title">容量上限</div>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">最大实例总数</span>
            <input id="${prefix}MaxInstances" type="number" min="1" value="${q.maxInstances || 10}" ${dis}>
            <span class="td-hint">包含运行中和已停止的实例</span>
          </label>
          <label class="td-field">
            <span class="td-field-label">最大并发实例</span>
            <input id="${prefix}MaxConcurrent" type="number" min="1" value="${q.maxConcurrentInstances || 5}" ${dis}>
            <span class="td-hint">同时处于运行状态的实例上限</span>
          </label>
        </div>
        <div class="td-sub-title">单实例资源分配</div>
        <div class="td-form-grid td-form-3col">
          <label class="td-field">
            <span class="td-field-label">CPU</span>
            ${selectHtml(CPU_OPTIONS, q.instanceCpu || '500m', prefix + 'Cpu', !!dis)}
          </label>
          <label class="td-field">
            <span class="td-field-label">内存</span>
            ${selectHtml(MEMORY_OPTIONS, q.instanceMemory || '512Mi', prefix + 'Memory', !!dis)}
          </label>
          <label class="td-field">
            <span class="td-field-label">磁盘</span>
            ${selectHtml(STORAGE_OPTIONS, q.instanceStorage || '2Gi', prefix + 'Storage', !!dis)}
          </label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">用户与存储</h4>
        <div class="td-form-grid td-form-3col">
          <label class="td-field">
            <span class="td-field-label">最大用户数</span>
            <input id="${prefix}MaxUsers" type="number" min="1" value="${q.maxUsers || 50}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">总存储上限 (MB)</span>
            <input id="${prefix}MaxStorageMB" type="number" min="64" value="${q.maxStorageMB || 10240}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">知识库容量 (MB)</span>
            <input id="${prefix}KbSizeMB" type="number" min="0" value="${q.knowledgeBaseSizeMB || 1024}" ${dis}>
          </label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">AI 用量限制</h4>
        <p class="td-hint" style="margin-bottom:10px;">控制该租户的 AI 模型调用频次和 Token 消耗</p>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">月 Token 预算</span>
            <input id="${prefix}TokenMonthly" type="number" min="0" value="${q.tokenBudgetMonthly || 1000000}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">日 Token 预算</span>
            <input id="${prefix}TokenDaily" type="number" min="0" value="${q.tokenBudgetDaily || 50000}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">日 API 调用次数</span>
            <input id="${prefix}ApiDaily" type="number" min="0" value="${q.apiCallsDaily || 10000}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">每分钟请求限制</span>
            <input id="${prefix}RateLimit" type="number" min="1" value="${q.rateLimitPerMinute || 60}" ${dis}>
          </label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">数据策略与集成</h4>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">数据保留天数</span>
            <input id="${prefix}RetentionDays" type="number" min="1" value="${q.dataRetentionDays || 90}" ${dis}>
            <span class="td-hint">审计日志和会话记录保留期限</span>
          </label>
          <label class="td-field">
            <span class="td-field-label">Webhook 数量上限</span>
            <input id="${prefix}MaxWebhooks" type="number" min="0" value="${q.maxWebhooks || 10}" ${dis}>
          </label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">模型访问</h4>
        <p class="td-hint" style="margin-bottom:8px;">选择该租户可使用的模型 Provider（不选则允许全部可用 Provider）</p>
        <div class="td-check-group">${providerChecks}</div>
      </div>`;
  }

  /** 从表单中收集配额值 */
  function collectQuotas(prefix) {
    const val = (id) => document.getElementById(prefix + id);
    const providerCbs = document.querySelectorAll(`.${prefix}-provider-cb`);
    const allowedProviders = [];
    providerCbs.forEach((cb) => { if (cb.checked) allowedProviders.push(cb.value); });

    return {
      quotas: {
        maxInstances: Number(val('MaxInstances').value) || 10,
        maxConcurrentInstances: Number(val('MaxConcurrent').value) || 5,
        maxUsers: Number(val('MaxUsers').value) || 50,
        instanceCpu: val('Cpu').value,
        instanceMemory: val('Memory').value,
        instanceStorage: val('Storage').value,
        maxStorageMB: Number(val('MaxStorageMB').value) || 10240,
        knowledgeBaseSizeMB: Number(val('KbSizeMB').value) || 1024,
        tokenBudgetMonthly: Number(val('TokenMonthly').value) || 1000000,
        tokenBudgetDaily: Number(val('TokenDaily').value) || 50000,
        apiCallsDaily: Number(val('ApiDaily').value) || 10000,
        rateLimitPerMinute: Number(val('RateLimit').value) || 60,
        dataRetentionDays: Number(val('RetentionDays').value) || 90,
        maxWebhooks: Number(val('MaxWebhooks').value) || 10
      },
      modelAccess: { allowedProviders }
    };
  }

  /** 用套餐默认值填充配额表单 */
  function fillQuotas(prefix, plan) {
    const q = PLAN_QUOTAS[plan] || PLAN_QUOTAS.standard;
    const set = (id, v) => { const el = document.getElementById(prefix + id); if (el) el.value = v; };
    set('MaxInstances', q.maxInstances);
    set('MaxConcurrent', q.maxConcurrentInstances);
    set('MaxUsers', q.maxUsers);
    set('Cpu', q.instanceCpu);
    set('Memory', q.instanceMemory);
    set('Storage', q.instanceStorage);
    set('MaxStorageMB', q.maxStorageMB);
    set('KbSizeMB', q.knowledgeBaseSizeMB);
    set('TokenMonthly', q.tokenBudgetMonthly);
    set('TokenDaily', q.tokenBudgetDaily);
    set('ApiDaily', q.apiCallsDaily);
    set('RateLimit', q.rateLimitPerMinute);
    set('RetentionDays', q.dataRetentionDays);
    set('MaxWebhooks', q.maxWebhooks);
  }

  /* ═══════════════════════════════════════════════
   * Detail/Edit Drawer
   * ═══════════════════════════════════════════════ */
  const drawer = document.getElementById('tenantDrawer');
  const drawerMask = document.getElementById('tenantDrawerMask');
  const drawerBody = document.getElementById('drawerBody');
  const drawerTitle = document.getElementById('drawerTitle');

  function openDrawer(tenant) {
    drawerTitle.textContent = tenant.name;
    const q = tenant.quotas || {};
    const f = tenant.features || {};
    const ma = tenant.modelAccess || {};
    const isArchived = tenant.status === 'archived';
    const dis = isArchived ? 'disabled' : '';

    drawerBody.innerHTML = `
      <div class="td-meta-grid">
        <div class="td-meta-card">
          <span class="td-meta-label">租户 ID</span>
          <span class="td-meta-value mono">${esc(tenant.id)}</span>
        </div>
        <div class="td-meta-card">
          <span class="td-meta-label">标识 (Slug)</span>
          <span class="td-meta-value mono">${esc(tenant.slug)}</span>
        </div>
        <div class="td-meta-card">
          <span class="td-meta-label">状态</span>
          <span class="td-meta-value">${statusBadge(tenant.status)}</span>
        </div>
        <div class="td-meta-card">
          <span class="td-meta-label">创建时间</span>
          <span class="td-meta-value">${tenant.createdAt ? new Date(tenant.createdAt).toLocaleString('zh-CN') : '-'}</span>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">基本信息</h4>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">租户名称</span>
            <input id="editName" type="text" value="${esc(tenant.name)}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">套餐</span>
            <select id="editPlan" ${dis}>
              <option value="free" ${tenant.plan === 'free' ? 'selected' : ''}>免费版</option>
              <option value="standard" ${tenant.plan === 'standard' ? 'selected' : ''}>标准版</option>
              <option value="enterprise" ${tenant.plan === 'enterprise' ? 'selected' : ''}>企业版</option>
            </select>
          </label>
          <label class="td-field">
            <span class="td-field-label">行业</span>
            <select id="editIndustry" ${dis}>
              ${Object.entries(INDUSTRY_LABELS).map(([k, v]) =>
                `<option value="${k}" ${tenant.industry === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </label>
          <label class="td-field">
            <span class="td-field-label">企业规模</span>
            <select id="editSize" ${dis}>
              ${Object.entries(SIZE_LABELS).map(([k, v]) =>
                `<option value="${k}" ${tenant.companySize === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <label class="td-field" style="margin-top:10px;">
          <span class="td-field-label">描述</span>
          <textarea id="editDesc" rows="2" style="resize:vertical;" ${dis}>${esc(tenant.description || '')}</textarea>
        </label>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">联系方式</h4>
        <div class="td-form-grid td-form-3col">
          <label class="td-field">
            <span class="td-field-label">负责人</span>
            <input id="editContactName" type="text" value="${esc(tenant.contactName || '')}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">邮箱</span>
            <input id="editEmail" type="email" value="${esc(tenant.contactEmail || '')}" ${dis}>
          </label>
          <label class="td-field">
            <span class="td-field-label">电话</span>
            <input id="editPhone" type="text" value="${esc(tenant.contactPhone || '')}" ${dis}>
          </label>
        </div>
      </div>

      ${quotaFormHtml('edit', q, ma, dis)}

      <div class="td-section">
        <h4 class="td-section-title">功能开关</h4>
        <div class="td-check-group">
          <label class="td-check-item"><input type="checkbox" id="editFeatGw" ${f.aiGateway ? 'checked' : ''} ${dis}> AI Gateway</label>
          <label class="td-check-item"><input type="checkbox" id="editFeatKb" ${f.knowledgeBase ? 'checked' : ''} ${dis}> 知识库</label>
          <label class="td-check-item"><input type="checkbox" id="editFeatMatrix" ${f.matrixIntegration ? 'checked' : ''} ${dis}> Matrix 集成</label>
          <label class="td-check-item"><input type="checkbox" id="editFeatTools" ${f.customTools ? 'checked' : ''} ${dis}> 自定义工具</label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">资源用量</h4>
        <div id="usageContent" class="td-usage-grid">
          <div class="td-usage-card"><span class="td-usage-label">加载中...</span><span class="td-usage-value">-</span></div>
        </div>
      </div>

      ${!isArchived ? '<div class="td-actions"><button id="saveBtn" class="primary">保存变更</button></div>' : ''}
    `;

    /* plan change → auto-fill quotas */
    const editPlanEl = document.getElementById('editPlan');
    if (editPlanEl && !isArchived) {
      editPlanEl.addEventListener('change', (e) => {
        if (confirm('切换套餐将重置所有配额为该套餐默认值，确定？')) {
          fillQuotas('edit', e.target.value);
        } else {
          e.target.value = tenant.plan;
        }
      });
    }

    loadUsage(tenant.id);
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveTenant(tenant.id));

    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    drawerMask.classList.remove('hidden');
    drawerMask.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
    drawerMask.classList.add('hidden');
    drawerMask.setAttribute('aria-hidden', 'true');
  }

  async function loadUsage(tenantId) {
    try {
      const res = await apiFetch(`/api/platform/tenants/${tenantId}/usage`);
      const { data } = await res.json();
      const el = document.getElementById('usageContent');
      el.innerHTML = `
        <div class="td-usage-card"><span class="td-usage-label">实例总数</span><span class="td-usage-value">${data.usage.instances} / ${data.quotas.maxInstances}</span></div>
        <div class="td-usage-card"><span class="td-usage-label">运行中实例</span><span class="td-usage-value">${data.usage.runningInstances} / ${data.quotas.maxConcurrentInstances || '-'}</span></div>
      `;
    } catch {
      const el = document.getElementById('usageContent');
      if (el) el.innerHTML = '<div class="td-usage-card"><span class="td-usage-label">加载失败</span><span class="td-usage-value">-</span></div>';
    }
  }

  async function saveTenant(tenantId) {
    const name = document.getElementById('editName').value.trim();
    if (!name) { alert('租户名称不能为空'); return; }

    const collected = collectQuotas('edit');

    const body = {
      name,
      plan: document.getElementById('editPlan').value,
      industry: document.getElementById('editIndustry').value,
      companySize: document.getElementById('editSize').value,
      description: document.getElementById('editDesc').value.trim() || null,
      contactName: document.getElementById('editContactName').value.trim() || null,
      contactEmail: document.getElementById('editEmail').value.trim() || null,
      contactPhone: document.getElementById('editPhone').value.trim() || null,
      quotas: collected.quotas,
      modelAccess: collected.modelAccess,
      features: {
        aiGateway: document.getElementById('editFeatGw').checked,
        knowledgeBase: document.getElementById('editFeatKb').checked,
        matrixIntegration: document.getElementById('editFeatMatrix').checked,
        customTools: document.getElementById('editFeatTools').checked
      }
    };

    try {
      await apiFetch(`/api/platform/tenants/${tenantId}`, { method: 'POST', body: JSON.stringify(body) });
      closeDrawer();
      await loadTenants();
    } catch (err) { alert('保存失败：' + err.message); }
  }

  /* ═══════════════════════════════════════════════
   * Create Drawer
   * ═══════════════════════════════════════════════ */
  const createDrawer = document.getElementById('createDrawer');
  const createDrawerMask = document.getElementById('createDrawerMask');
  const createDrawerBody = document.getElementById('createDrawerBody');

  function planCardHtml(plan, label, desc, selected) {
    return `<div class="td-plan-card${selected ? ' selected' : ''}" data-plan="${plan}">
      <div class="td-plan-card-name">${esc(label)}</div>
      <div class="td-plan-card-desc">${esc(desc)}</div>
    </div>`;
  }

  function openCreateDrawer() {
    const defQ = PLAN_QUOTAS.standard;
    const defMa = { allowedProviders: _providers.slice() };

    createDrawerBody.innerHTML = `
      <div class="td-section">
        <h4 class="td-section-title">基本信息</h4>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">租户名称 *</span>
            <input id="createName" type="text" placeholder="例：某某科技有限公司">
          </label>
          <label class="td-field">
            <span class="td-field-label">标识 (Slug) *</span>
            <input id="createSlug" type="text" placeholder="小写字母+数字+短横线">
            <span class="td-hint">用于系统标识和 K8s namespace，创建后不可修改</span>
          </label>
          <label class="td-field">
            <span class="td-field-label">行业</span>
            <select id="createIndustry">
              ${Object.entries(INDUSTRY_LABELS).map(([k, v]) =>
                `<option value="${k}" ${k === 'other' ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </label>
          <label class="td-field">
            <span class="td-field-label">企业规模</span>
            <select id="createSize">
              ${Object.entries(SIZE_LABELS).map(([k, v]) =>
                `<option value="${k}" ${k === 'small' ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <label class="td-field" style="margin-top:10px;">
          <span class="td-field-label">描述</span>
          <textarea id="createDesc" rows="2" style="resize:vertical;" placeholder="租户用途或备注"></textarea>
        </label>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">联系方式</h4>
        <div class="td-form-grid td-form-3col">
          <label class="td-field">
            <span class="td-field-label">负责人</span>
            <input id="createContactName" type="text" placeholder="姓名">
          </label>
          <label class="td-field">
            <span class="td-field-label">邮箱</span>
            <input id="createEmail" type="email" placeholder="admin@example.com">
          </label>
          <label class="td-field">
            <span class="td-field-label">电话</span>
            <input id="createPhone" type="text" placeholder="手机号">
          </label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">套餐选择</h4>
        <div class="td-plan-cards" id="createPlanCards">
          ${planCardHtml('free', '免费版', '3 实例 · 5 用户 · 0.25核/256M · 10万Token/月', false)}
          ${planCardHtml('standard', '标准版', '10 实例 · 50 用户 · 0.5核/512M · 100万Token/月', true)}
          ${planCardHtml('enterprise', '企业版', '100 实例 · 500 用户 · 1核/1G · 1000万Token/月', false)}
        </div>
        <input type="hidden" id="createPlan" value="standard">
      </div>

      ${quotaFormHtml('create', defQ, defMa, '')}

      <div class="td-section">
        <h4 class="td-section-title">功能开关</h4>
        <div class="td-check-group">
          <label class="td-check-item"><input type="checkbox" id="createFeatGw" checked> AI Gateway</label>
          <label class="td-check-item"><input type="checkbox" id="createFeatKb" checked> 知识库</label>
          <label class="td-check-item"><input type="checkbox" id="createFeatMatrix"> Matrix 集成</label>
          <label class="td-check-item"><input type="checkbox" id="createFeatTools" checked> 自定义工具</label>
        </div>
      </div>

      <div class="td-section">
        <h4 class="td-section-title">初始管理员（可选）</h4>
        <p class="td-hint" style="margin-bottom:8px;">为该租户创建第一个管理员账号，拥有租户管理员权限</p>
        <div class="td-form-grid td-form-2col">
          <label class="td-field">
            <span class="td-field-label">用户名</span>
            <input id="createAdminUser" type="text" placeholder="留空则不创建">
          </label>
          <label class="td-field">
            <span class="td-field-label">显示名称</span>
            <input id="createAdminName" type="text" placeholder="中文姓名">
          </label>
          <label class="td-field">
            <span class="td-field-label">邮箱</span>
            <input id="createAdminEmail" type="email" placeholder="admin@example.com">
          </label>
          <label class="td-field">
            <span class="td-field-label">初始密码</span>
            <input id="createAdminPw" type="password" placeholder="至少 6 位">
          </label>
        </div>
      </div>

      <div class="td-actions">
        <button type="button" id="createCancelBtn">取消</button>
        <button type="button" id="createSubmitBtn" class="primary">创建租户</button>
      </div>
    `;

    /* Plan card click → select + fill quotas */
    document.getElementById('createPlanCards').addEventListener('click', (e) => {
      const card = e.target.closest('[data-plan]');
      if (!card) return;
      const plan = card.dataset.plan;
      document.getElementById('createPlan').value = plan;
      document.querySelectorAll('.td-plan-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      fillQuotas('create', plan);
    });

    document.getElementById('createCancelBtn').addEventListener('click', closeCreateDrawer);
    document.getElementById('createSubmitBtn').addEventListener('click', submitCreate);

    createDrawer.classList.remove('hidden');
    createDrawer.setAttribute('aria-hidden', 'false');
    createDrawerMask.classList.remove('hidden');
    createDrawerMask.setAttribute('aria-hidden', 'false');
  }

  function closeCreateDrawer() {
    createDrawer.classList.add('hidden');
    createDrawer.setAttribute('aria-hidden', 'true');
    createDrawerMask.classList.add('hidden');
    createDrawerMask.setAttribute('aria-hidden', 'true');
  }

  async function submitCreate() {
    const name = document.getElementById('createName').value.trim();
    const slug = document.getElementById('createSlug').value.trim();
    if (!name) { alert('请输入租户名称'); return; }
    if (!slug) { alert('请输入租户标识'); return; }

    const collected = collectQuotas('create');

    const body = {
      name, slug,
      plan: document.getElementById('createPlan').value,
      industry: document.getElementById('createIndustry').value,
      companySize: document.getElementById('createSize').value,
      description: document.getElementById('createDesc').value.trim() || null,
      contactName: document.getElementById('createContactName').value.trim() || null,
      contactEmail: document.getElementById('createEmail').value.trim() || null,
      contactPhone: document.getElementById('createPhone').value.trim() || null,
      quotas: collected.quotas,
      modelAccess: collected.modelAccess,
      features: {
        aiGateway: document.getElementById('createFeatGw').checked,
        knowledgeBase: document.getElementById('createFeatKb').checked,
        matrixIntegration: document.getElementById('createFeatMatrix').checked,
        customTools: document.getElementById('createFeatTools').checked
      }
    };

    /* Initial admin */
    const adminUser = document.getElementById('createAdminUser').value.trim();
    if (adminUser) {
      const adminPw = document.getElementById('createAdminPw').value;
      if (!adminPw || adminPw.length < 6) { alert('管理员密码至少 6 位'); return; }
      body.initialAdmin = {
        username: adminUser,
        displayName: document.getElementById('createAdminName').value.trim(),
        email: document.getElementById('createAdminEmail').value.trim(),
        password: adminPw
      };
    }

    try {
      const res = await apiFetch('/api/platform/tenants', { method: 'POST', body: JSON.stringify(body) });
      const result = await res.json();
      closeCreateDrawer();
      await loadTenants();
      if (result.adminCreated) {
        alert(`租户创建成功！管理员 "${adminUser}" 已同步创建。`);
      }
    } catch (err) { alert('创建失败：' + err.message); }
  }

  /* ── Event delegation ── */
  document.getElementById('createBtn').addEventListener('click', openCreateDrawer);
  document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
  document.getElementById('closeCreateDrawer').addEventListener('click', closeCreateDrawer);
  drawerMask.addEventListener('click', closeDrawer);
  createDrawerMask.addEventListener('click', closeCreateDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); closeCreateDrawer(); }
  });

  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action && id) handleAction(action, id);
      return;
    }
    const row = e.target.closest('[data-tenant-id]');
    if (row) {
      const tid = row.dataset.tenantId;
      const tenant = _tenants.find((t) => t.id === tid);
      if (tenant) openDrawer(tenant);
    }
  });

  /* ── Init ── */
  async function init() {
    await window.__platformReady;
    await loadProviders();
    await loadTenants();
  }

  init();
})();
