/* ai-gateway.js — AI Gateway 4-Tab 管理页 */
/* 兼容 Arc 等浏览器的 instant-navigation：所有 DOM 引用和事件绑定在 __aiGatewayInit() 中完成 */
(function () {
  'use strict';

  const API = '/api/admin/ai-gateway';
  let currentTab = 'models';
  let traceState = { page: 1, limit: 20 };
  let providerTemplates = [];
  let cachedCostData = null;
  let drawerSaveFn = null;
  let activeRuleCategory = '';
  let allRuleRows = [];

  // ── 工具函数（无 DOM 依赖） ──
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function fmtNum(n) { return Number(n || 0).toLocaleString(); }
  function fmtTime(t) { if (!t) return '-'; const d = new Date(t); return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function fmtCost(v) { return v != null ? `¥${Number(v).toFixed(4)}` : '-'; }
  function badge(status) {
    const m = { completed: 'completed', blocked: 'blocked', failed: 'failed', high: 'high', medium: 'medium', low: 'low', block: 'block', route_secure_model: 'route', allow: 'allow' };
    const labels = { completed: '已完成', blocked: '已拦截', failed: '失败', block: '拦截', route_secure_model: '安全路由', allow: '放行' };
    return `<span class="badge badge-${m[status] || 'info'}">${esc(labels[status] || status)}</span>`;
  }
  function healthDot(status) {
    const colors = { healthy: '#34c759', degraded: '#ff9500', down: '#ff3b30', unknown: '#aeaeb2' };
    const labels = { healthy: '健康', degraded: '降级', down: '故障', unknown: '未检测' };
    const c = colors[status] || colors.unknown;
    return `<span title="${labels[status] || '未知'}" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0"></span>`;
  }
  function $(id) { return document.getElementById(id); }

  async function api(path, opts) {
    try {
      const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        console.error('[ai-gateway] API error:', path, err);
        return err;
      }
      return r.json();
    } catch (e) {
      console.error('[ai-gateway] Network error:', path, e);
      return { error: e.message };
    }
  }

  function highlightJson(raw) {
    return esc(raw).replace(/"([^"]+)"(?=\s*:)/g, '"<span class="jp-key">$1</span>"')
      .replace(/:\s*"([^"]*)"/g, ': "<span class="jp-string">$1</span>"')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="jp-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="jp-bool">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="jp-null">$1</span>');
  }

  // ── Drawer（每次调用时动态获取 DOM 元素） ──
  function openDrawer(title, html, saveFn) {
    const drawer = $('gwDrawer'), mask = $('gwDrawerMask');
    $('gwDrawerTitle').textContent = title;
    $('gwDrawerBody').innerHTML = html;
    $('gwDrawerFoot').style.display = saveFn ? 'flex' : 'none';
    drawerSaveFn = saveFn || null;
    drawer.classList.remove('hidden'); drawer.setAttribute('aria-hidden', 'false');
    mask.classList.remove('hidden'); mask.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    const drawer = $('gwDrawer'), mask = $('gwDrawerMask');
    drawer.classList.add('hidden'); drawer.setAttribute('aria-hidden', 'true');
    mask.classList.add('hidden'); mask.setAttribute('aria-hidden', 'true');
    $('gwDrawerBody').innerHTML = ''; drawerSaveFn = null;
  }

  // ── Tab 切换 ──
  function loadTab(tab) {
    if (tab === 'models') loadModels();
    else if (tab === 'audit') { loadTraceStats(); loadTraces(); loadModelFilter(); }
    else if (tab === 'costs') loadCosts();
    else if (tab === 'rules') loadRules();
  }

  // ════════════════════════════════════════
  // Tab 1: 模型管理
  // ════════════════════════════════════════

  async function loadModels() {
    const [modelsRes, provRes] = await Promise.all([api('/models'), api('/providers')]);
    providerTemplates = provRes.providers || [];
    const rows = modelsRes.rows || [];
    $('modelCount').textContent = `${rows.length} 个模型`;
    const grid = $('modelGrid');
    if (!rows.length) { grid.innerHTML = '<div style="padding:40px;text-align:center;color:#8e8e93;grid-column:1/-1">暂无模型，点击右上方按钮添加</div>'; return; }
    grid.innerHTML = rows.map(m => `
      <div class="model-card${m.isActive ? '' : ' inactive'}" data-id="${esc(m.id)}">
        <div class="model-card-head">
          <div style="display:flex;align-items:center;gap:6px">
            ${healthDot(m.healthStatus || 'unknown')}
            <div>
              <div class="model-card-title">${esc(m.displayName)}</div>
              <div class="model-card-desc">${esc(m.description || m.providerType)}</div>
            </div>
          </div>
          <label class="toggle-switch"><input type="checkbox" ${m.isActive ? 'checked' : ''} data-toggle-model="${esc(m.id)}" /><span class="toggle-slider"></span></label>
        </div>
        <div class="model-card-meta">
          <span class="badge badge-info">${esc(m.providerType)}</span>
          ${m.isSecure ? '<span class="badge badge-route">安全模型</span>' : ''}
          <span class="price">入 ${m.inputPrice}/${m.currency} · 出 ${m.outputPrice}/${m.currency} /1M</span>
        </div>
        <div class="model-card-actions">
          <button data-health-check="${esc(m.id)}">健康检查</button>
          <button data-edit-model="${esc(m.id)}">编辑</button>
          <button class="danger" data-del-model="${esc(m.id)}">删除</button>
        </div>
      </div>`).join('');
    bindModelEvents();
  }

  function bindModelEvents() {
    document.querySelectorAll('[data-toggle-model]').forEach(el => {
      el.addEventListener('change', async () => { await api(`/models/${el.dataset.toggleModel}/toggle`, { method: 'POST' }); loadModels(); });
    });
    document.querySelectorAll('[data-health-check]').forEach(el => {
      el.addEventListener('click', async () => {
        el.disabled = true; el.textContent = '检查中...';
        await api(`/models/${el.dataset.healthCheck}/health-check`, { method: 'POST' });
        loadModels();
      });
    });
    document.querySelectorAll('[data-edit-model]').forEach(el => {
      el.addEventListener('click', async () => { const d = await api(`/models/${el.dataset.editModel}`); openModelForm(d); });
    });
    document.querySelectorAll('[data-del-model]').forEach(el => {
      el.addEventListener('click', async () => { if (confirm('确认删除该模型？')) { await api(`/models/${el.dataset.delModel}/delete`, { method: 'POST' }); loadModels(); } });
    });
  }

  function openModelForm(m) {
    const isNew = !m;
    const d = m || { displayName: '', description: '', providerType: 'deepseek', baseUrl: '', providerModelName: '', apiKey: '', isSecure: false, inputPrice: 1.0, outputPrice: 2.0, currency: 'CNY' };
    const provOpts = providerTemplates.map(p => `<option value="${esc(p.id)}" ${p.id === d.providerType ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    openDrawer(isNew ? '添加模型' : `编辑 ${d.displayName}`, `
      <label>厂商</label><select id="fmProvider">${provOpts}</select>
      <label>模型名称</label><input id="fmName" value="${esc(d.displayName)}" placeholder="如 deepseek-chat" />
      <label>描述</label><input id="fmDesc" value="${esc(d.description)}" />
      <label>Base URL</label><input id="fmUrl" value="${esc(d.baseUrl)}" placeholder="https://api.deepseek.com/v1" />
      <label>上游模型名</label><input id="fmModel" value="${esc(d.providerModelName)}" />
      <label>API Key</label><input id="fmKey" value="${esc(d.apiKey)}" type="password" />
      <label>输入价格 (per 1M tokens)</label><input id="fmInPrice" type="number" step="0.01" value="${d.inputPrice}" />
      <label>输出价格 (per 1M tokens)</label><input id="fmOutPrice" type="number" step="0.01" value="${d.outputPrice}" />
      <label>币种</label><select id="fmCurrency"><option value="CNY" ${d.currency === 'CNY' ? 'selected' : ''}>CNY</option><option value="USD" ${d.currency === 'USD' ? 'selected' : ''}>USD</option></select>
      <label class="checkbox-label"><input type="checkbox" id="fmSecure" ${d.isSecure ? 'checked' : ''} /> 标记为安全模型（风险命中时路由至此）</label>
    `, async () => {
      const body = {
        id: d.id || undefined,
        displayName: $('fmName').value.trim(),
        description: $('fmDesc').value.trim(),
        providerType: $('fmProvider').value,
        baseUrl: $('fmUrl').value.trim(),
        providerModelName: $('fmModel').value.trim(),
        apiKey: $('fmKey').value.trim(),
        inputPrice: parseFloat($('fmInPrice').value) || 1,
        outputPrice: parseFloat($('fmOutPrice').value) || 2,
        currency: $('fmCurrency').value,
        isSecure: $('fmSecure').checked
      };
      if (!body.displayName) { alert('模型名称不能为空'); return; }
      await api('/models', { method: 'POST', body: JSON.stringify(body) });
      closeDrawer(); loadModels();
    });
    $('fmProvider').addEventListener('change', function () {
      const tpl = providerTemplates.find(p => p.id === this.value);
      if (tpl) $('fmUrl').value = tpl.baseUrl;
    });
  }

  // ── 故障转移链 ──

  async function openFailoverDrawer() {
    const [chainsRes, modelsRes] = await Promise.all([api('/failover-chains'), api('/models')]);
    const chains = chainsRes.rows || [];
    const models = modelsRes.rows || [];
    const modelMap = new Map(models.map(m => [m.id, m]));
    let html = '<div style="margin-bottom:12px"><button type="button" class="btn-primary" id="btnNewChain">+ 新建转移链</button></div>';
    if (!chains.length) {
      html += '<div style="color:#8e8e93;font-size:13px;text-align:center;padding:20px">暂无故障转移链</div>';
    } else {
      html += chains.map(c => {
        const pm = modelMap.get(c.primaryModelId);
        const fbs = (c.fallbackModelIds || []).map(id => modelMap.get(id)).filter(Boolean);
        return `<div style="border:1px solid #ededf2;border-radius:10px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${esc(c.name)}</strong>
            <div style="display:flex;gap:6px;align-items:center">
              <label class="toggle-switch"><input type="checkbox" ${c.enabled ? 'checked' : ''} data-toggle-chain="${esc(c.id)}"><span class="toggle-slider"></span></label>
              <button style="font-size:11px;padding:3px 8px;border:1px solid rgba(255,59,48,0.3);border-radius:6px;background:#fff;color:#d70015;cursor:pointer" data-del-chain="${esc(c.id)}">删除</button>
            </div>
          </div>
          <div style="font-size:12px;color:#6e6e73;margin-top:6px">主模型: ${healthDot(pm ? pm.healthStatus : 'unknown')} ${esc(pm ? pm.displayName : c.primaryModelId)}</div>
          <div style="font-size:12px;color:#6e6e73;margin-top:4px">备用: ${fbs.map(m => `${healthDot(m.healthStatus || 'unknown')} ${esc(m.displayName)}`).join(' → ') || '无'}</div>
        </div>`;
      }).join('');
    }
    openDrawer('故障转移链', html, null);
    const btn = $('btnNewChain');
    if (btn) btn.addEventListener('click', () => openFailoverForm(models));
    document.querySelectorAll('[data-toggle-chain]').forEach(el => {
      el.addEventListener('change', async () => {
        const c = chains.find(x => x.id === el.dataset.toggleChain);
        if (c) { await api('/failover-chains', { method: 'POST', body: JSON.stringify({ ...c, enabled: !c.enabled }) }); openFailoverDrawer(); }
      });
    });
    document.querySelectorAll('[data-del-chain]').forEach(el => {
      el.addEventListener('click', async () => { if (confirm('确认删除？')) { await api(`/failover-chains/${el.dataset.delChain}`, { method: 'DELETE' }); openFailoverDrawer(); } });
    });
  }

  function openFailoverForm(models) {
    const opts = models.map(m => `<option value="${esc(m.id)}">${esc(m.displayName)}</option>`).join('');
    const checks = models.map(m => `<label class="checkbox-label"><input type="checkbox" value="${esc(m.id)}"> ${esc(m.displayName)}</label>`).join('');
    openDrawer('新建转移链', `
      <label>名称</label><input id="fcName" placeholder="如：通用故障转移" />
      <label>主模型</label><select id="fcPrimary">${opts}</select>
      <label>备用模型（按顺序勾选）</label><div id="fcFallbacks" style="max-height:200px;overflow-y:auto">${checks}</div>
      <label class="checkbox-label" style="margin-top:10px"><input type="checkbox" id="fcEnabled" checked> 启用</label>
    `, async () => {
      const fallbacks = Array.from(document.querySelectorAll('#fcFallbacks input:checked')).map(el => el.value).filter(v => v !== $('fcPrimary').value);
      await api('/failover-chains', { method: 'POST', body: JSON.stringify({ name: $('fcName').value.trim(), primaryModelId: $('fcPrimary').value, fallbackModelIds: fallbacks, enabled: $('fcEnabled').checked }) });
      closeDrawer(); openFailoverDrawer();
    });
  }

  async function openDiscoverDrawer() {
    const provOpts = providerTemplates.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    openDrawer('模型自动发现', `
      <label>选择厂商</label><select id="discProvider">${provOpts}</select>
      <label>API Key</label><input id="discKey" type="password" placeholder="输入该厂商的 API Key" />
      <div style="margin-top:10px"><button type="button" class="btn-primary" id="btnRunDiscover">发现模型</button></div>
      <div id="discResults" style="margin-top:12px"></div>
    `, null);
    $('btnRunDiscover').addEventListener('click', async () => {
      const el = $('discResults');
      el.innerHTML = '<span style="color:#8e8e93">发现中...</span>';
      const res = await api('/models/discover', { method: 'POST', body: JSON.stringify({ providerType: $('discProvider').value, apiKey: $('discKey').value }) });
      const models = res.models || [];
      if (!models.length) { el.innerHTML = '<span style="color:#8e8e93">未发现可用模型</span>'; return; }
      el.innerHTML = models.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f2f2f7">
        <div><strong style="font-size:13px">${esc(m.displayName)}</strong><div style="font-size:11px;color:#8e8e93">${esc(m.providerModelName)} · 入 ${m.inputPrice} 出 ${m.outputPrice} /1M</div></div>
        <button class="btn-primary" style="font-size:11px;padding:4px 12px" data-import-model='${esc(JSON.stringify(m))}'>导入</button>
      </div>`).join('');
      el.querySelectorAll('[data-import-model]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const md = JSON.parse(btn.dataset.importModel);
          await api('/models', { method: 'POST', body: JSON.stringify(md) });
          btn.textContent = '已导入'; btn.disabled = true;
        });
      });
    });
  }

  // ════════════════════════════════════════
  // Tab 2: 审计追踪
  // ════════════════════════════════════════

  async function loadTraceStats() {
    const s = await api('/stats');
    $('statCompleted').textContent = fmtNum(s.completed);
    $('statBlocked').textContent = fmtNum(s.blocked);
    $('statFailed').textContent = fmtNum(s.failed);
    $('statTokens').textContent = fmtNum(s.totalTokens);
  }

  async function loadModelFilter() {
    const d = await api('/models');
    const sel = $('filterModel');
    const cur = sel.value;
    sel.innerHTML = '<option value="">按模型筛选...</option>' + (d.rows || []).map(m => `<option value="${esc(m.displayName)}">${esc(m.displayName)}</option>`).join('');
    sel.value = cur;
  }

  async function loadTraces() {
    const search = $('filterSearch').value.trim();
    const status = $('filterStatus').value;
    const model = $('filterModel').value;
    const limit = Number($('filterLimit').value) || 20;
    traceState.limit = limit;
    const qs = `?page=${traceState.page}&limit=${limit}${search ? '&search=' + encodeURIComponent(search) : ''}${status ? '&status=' + status : ''}${model ? '&model=' + encodeURIComponent(model) : ''}`;
    const d = await api('/traces' + qs);
    renderTraceTable(d.items || [], d.total || 0, d.page || 1, limit);
  }

  function renderTraceTable(items, total, page, limit) {
    const tbody = $('traceTableBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无记录</td></tr>'; $('tracePager').innerHTML = ''; return; }
    tbody.innerHTML = items.map(t => {
      const costStr = fmtCost(t.estimatedCost);
      const ioStr = `入 ${fmtCost(t.inputCost)} · 出 ${fmtCost(t.outputCost)}`;
      return `<tr data-trace-id="${esc(t.traceId)}">
        <td style="font-family:monospace;font-size:11px">${esc(t.traceId.slice(0, 16))}…</td>
        <td>${badge(t.status)}</td><td>${esc(t.actualModel || '-')}</td>
        <td>${fmtNum(t.promptTokens)} / ${fmtNum(t.completionTokens)}</td>
        <td>${costStr}<br><span style="font-size:10px;color:#8e8e93">${ioStr}</span></td>
        <td>${t.latencyMs != null ? fmtNum(t.latencyMs) + 'ms' : '-'}</td>
        <td>${fmtTime(t.createdAt)}</td></tr>`;
    }).join('');
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => openTraceDetail(tr.dataset.traceId));
    });
    const totalPages = Math.ceil(total / limit);
    $('tracePager').innerHTML = `
      <button class="table-pager-btn" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">上一页</button>
      <span class="table-pager-meta">${page} / ${totalPages}（共 ${total} 条）</span>
      <button class="table-pager-btn" ${page >= totalPages ? 'disabled' : ''} data-p="${page + 1}">下一页</button>`;
    $('tracePager').querySelectorAll('[data-p]').forEach(b => {
      b.addEventListener('click', () => { traceState.page = Number(b.dataset.p); loadTraces(); });
    });
  }

  async function openTraceDetail(traceId) {
    const t = await api(`/traces/${traceId}`);
    if (!t || t.error) return;
    const costDetail = `输入 ${fmtCost(t.inputCost)} + 输出 ${fmtCost(t.outputCost)} = ${fmtCost(t.estimatedCost)}`;
    let html = `
      <div class="trace-meta-card">
        <div class="meta-title">Trace ID</div>
        <div class="meta-id">${esc(t.traceId)}</div>
        <div class="meta-row">${badge(t.status)} · ${esc(t.actualModel || '-')} · ${fmtNum(t.totalTokens)} tokens · ${t.latencyMs}ms</div>
        <div class="meta-row">用户: ${esc(t.userId || '-')} · ${costDetail}</div>
        <div class="meta-row">请求: ${esc(t.requestedModel)} → ${esc(t.actualModel || 'N/A')}</div>
        <div class="meta-row">${fmtTime(t.createdAt)} ~ ${fmtTime(t.completedAt)}</div>
      </div>`;
    if (t.riskHits && t.riskHits.length) {
      html += '<div class="trace-meta-card"><div class="meta-title">风险命中</div>' +
        t.riskHits.map(h => `<div class="meta-row">${badge(h.severity)} ${badge(h.action)} ${esc(h.ruleName)} — ${esc(h.matchSummary)}</div>`).join('') + '</div>';
    }
    if (t.flowNodes && t.flowNodes.length) {
      html += '<div class="flow-section"><h4>执行流程</h4><div class="flow-desc">请求的完整处理链路</div>';
      html += t.flowNodes.map(n => {
        const dotClass = n.status === 'blocked' ? 'blocked' : (n.kind || '');
        let payload = '';
        if (n.inputPayload) payload += `<div class="flow-payload">${highlightJson(n.inputPayload)}</div>`;
        if (n.outputPayload) payload += `<div class="flow-payload" style="margin-top:6px">${highlightJson(n.outputPayload)}</div>`;
        return `<div class="flow-node">
          <div class="flow-dot ${dotClass}"></div>
          <div class="flow-body">
            <span class="flow-kind-badge ${dotClass}">${esc(n.kind || '')}</span>
            <span class="flow-time">${fmtTime(n.createdAt)}</span>
            <div class="flow-title">${esc(n.title || '')}</div>
            ${n.summary ? `<div class="flow-summary">${esc(n.summary)}</div>` : ''}
            ${n.model ? `<div class="flow-summary">模型: ${esc(n.model)}</div>` : ''}
            ${payload}
          </div></div>`;
      }).join('') + '</div>';
    }
    openDrawer(`Trace 详情`, html, null);
  }

  // ════════════════════════════════════════
  // Tab 3: 成本分析
  // ════════════════════════════════════════

  async function loadCosts() {
    const d = await api('/costs');
    if (d.error) return;
    cachedCostData = d;
    $('costInputTokens').textContent = fmtNum(d.totalPromptTokens);
    $('costOutputTokens').textContent = fmtNum(d.totalCompletionTokens);
    $('costTotal').textContent = fmtCost(d.totalEstimatedCost);
    $('costCalls').textContent = fmtNum((d.userSummary || []).reduce((s, u) => s + u.count, 0));

    const depts = (d.deptSummary || []).sort((a, b) => b.estimatedCost - a.estimatedCost);
    const totalCost = d.totalEstimatedCost || 1;
    $('costDeptBody').innerHTML = depts.map(dp => {
      const pct = ((dp.estimatedCost / totalCost) * 100).toFixed(1);
      return `<tr><td><strong>${esc(dp.department)}</strong></td><td>${dp.users}</td><td>${fmtNum(dp.count)}</td><td>${fmtNum(dp.totalTokens)}</td><td>${fmtCost(dp.estimatedCost)}</td><td><div style="display:flex;align-items:center;gap:6px"><div style="width:60px;height:6px;background:#f2f2f7;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:#0071e3;border-radius:3px"></div></div><span style="font-size:11px;color:#8e8e93">${pct}%</span></div></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">暂无数据</td></tr>';

    const deptFilter = $('costUserDeptFilter');
    const curDept = deptFilter.value;
    deptFilter.innerHTML = '<option value="">全部部门</option>' + depts.map(dp => `<option value="${esc(dp.department)}">${esc(dp.department)}</option>`).join('');
    deptFilter.value = curDept;
    renderUserSummary();

    $('costModelBody').innerHTML = (d.modelSummary || []).map(m =>
      `<tr><td>${esc(m.model)}</td><td>${fmtNum(m.count)}</td><td>${fmtNum(m.totalTokens)}</td><td>${fmtCost(m.estimatedCost)}</td></tr>`
    ).join('') || '<tr><td colspan="4" class="empty">暂无数据</td></tr>';

    $('costDailyBody').innerHTML = (d.dailyTrend || []).map(r =>
      `<tr><td>${esc(r.day)}</td><td>${fmtNum(r.count)}</td><td>${fmtNum(r.promptTokens)}</td><td>${fmtNum(r.completionTokens)}</td><td>${fmtCost(r.estimatedCost)}</td></tr>`
    ).join('') || '<tr><td colspan="5" class="empty">暂无数据</td></tr>';

    loadBudgets();
  }

  function renderUserSummary() {
    if (!cachedCostData) return;
    const dept = $('costUserDeptFilter').value;
    const sort = $('costUserSort').value;
    let rows = [...(cachedCostData.userSummary || [])];
    if (dept) rows = rows.filter(u => u.department === dept);
    if (sort === 'cost') rows.sort((a, b) => b.estimatedCost - a.estimatedCost);
    else if (sort === 'tokens') rows.sort((a, b) => b.totalTokens - a.totalTokens);
    else if (sort === 'count') rows.sort((a, b) => b.count - a.count);
    else if (sort === 'name') rows.sort((a, b) => a.userId.localeCompare(b.userId));
    $('costUserBody').innerHTML = rows.map(u =>
      `<tr><td>${esc(u.userId)}</td><td><span style="font-size:11px;color:#8e8e93">${esc(u.department || '-')}</span></td><td>${fmtNum(u.count)}</td><td>${fmtNum(u.totalTokens)}</td><td>${fmtCost(u.estimatedCost)}</td></tr>`
    ).join('') || '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
  }

  // ── 预算管理 ──

  async function loadBudgets() {
    const d = await api('/budget-status');
    if (d.error) return;
    const items = d.items || [];
    const tbody = $('budgetBody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无预算配置</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(b => {
      const scopeLabel = b.scope === 'department' ? '部门' : '用户';
      const pctVal = Math.min(b.pct * 100, 100);
      const pctDisplay = (b.pct * 100).toFixed(1);
      const level = b.pct >= 1 ? 'over' : b.pct >= 0.8 ? 'warn' : 'ok';
      const modeLabel = b.mode === 'hard' ? '硬限制' : '仅告警';
      const modeCls = b.mode === 'hard' ? 'badge-hard' : 'badge-soft';
      return `<tr>
        <td><span class="badge badge-info">${esc(scopeLabel)}</span></td>
        <td><strong>${esc(b.name)}</strong></td>
        <td>${fmtCost(b.monthlyBudget)}</td>
        <td>${fmtCost(b.used)}</td>
        <td><div class="budget-progress"><div class="budget-progress-bar"><div class="budget-progress-fill level-${level}" style="width:${pctVal}%"></div></div><span style="font-size:11px;color:#8e8e93;min-width:44px">${pctDisplay}%</span></div></td>
        <td><span class="badge ${modeCls}">${esc(modeLabel)}</span></td>
        <td>
          <button style="font-size:11px;padding:3px 10px;border:1px solid #e5e5ea;border-radius:6px;background:#fff;cursor:pointer" data-edit-budget="${esc(b.id)}">编辑</button>
          <button style="font-size:11px;padding:3px 10px;border:1px solid rgba(255,59,48,0.3);border-radius:6px;background:#fff;cursor:pointer;color:#d70015" data-del-budget="${esc(b.id)}">删除</button>
        </td></tr>`;
    }).join('');
    bindBudgetEvents();
  }

  function bindBudgetEvents() {
    document.querySelectorAll('[data-edit-budget]').forEach(el => {
      el.addEventListener('click', async () => {
        const d = await api('/budgets');
        const b = (d.rows || []).find(r => r.id === el.dataset.editBudget);
        if (b) openBudgetForm(b);
      });
    });
    document.querySelectorAll('[data-del-budget]').forEach(el => {
      el.addEventListener('click', async () => {
        if (confirm('确认删除该预算？')) {
          await api(`/budgets/${el.dataset.delBudget}`, { method: 'DELETE' });
          loadBudgets();
        }
      });
    });
  }

  function openBudgetForm(b) {
    const isNew = !b;
    const d = b || { scope: 'department', name: '', monthlyBudget: 50, thresholdWarn: 0.8, thresholdHard: 1.0, mode: 'soft' };
    const deptOpts = cachedCostData ? (cachedCostData.deptSummary || []).map(dp => `<option value="${esc(dp.department)}" ${dp.department === d.name && d.scope === 'department' ? 'selected' : ''}>${esc(dp.department)}</option>`).join('') : '';
    const userOpts = cachedCostData ? (cachedCostData.userSummary || []).map(u => `<option value="${esc(u.userId)}" ${u.userId === d.name && d.scope === 'user' ? 'selected' : ''}>${esc(u.userId)}</option>`).join('') : '';
    openDrawer(isNew ? '添加预算' : `编辑预算 — ${d.name}`, `
      <label>范围</label>
      <select id="bfScope">
        <option value="department" ${d.scope === 'department' ? 'selected' : ''}>部门</option>
        <option value="user" ${d.scope === 'user' ? 'selected' : ''}>用户</option>
      </select>
      <label>名称</label>
      <div id="bfNameWrap">
        <select id="bfNameSelect" style="margin-bottom:14px">${d.scope === 'department' ? deptOpts : userOpts}</select>
        <input id="bfNameInput" value="${esc(d.name)}" placeholder="或直接输入名称" />
      </div>
      <label>月度额度 (¥)</label>
      <input id="bfBudget" type="number" step="1" value="${d.monthlyBudget}" />
      <label>预警阈值 (%)</label>
      <input id="bfWarn" type="number" step="1" value="${(d.thresholdWarn * 100).toFixed(0)}" min="0" max="100" />
      <label>硬限阈值 (%)</label>
      <input id="bfHard" type="number" step="1" value="${(d.thresholdHard * 100).toFixed(0)}" min="0" max="200" />
      <label>模式</label>
      <select id="bfMode">
        <option value="soft" ${d.mode === 'soft' ? 'selected' : ''}>仅告警 (soft)</option>
        <option value="hard" ${d.mode === 'hard' ? 'selected' : ''}>硬限制 (hard)</option>
      </select>
    `, async () => {
      const name = $('bfNameInput').value.trim() || $('bfNameSelect').value;
      if (!name) { alert('名称不能为空'); return; }
      const body = {
        id: d.id || undefined,
        scope: $('bfScope').value,
        name,
        monthlyBudget: parseFloat($('bfBudget').value) || 50,
        thresholdWarn: (parseFloat($('bfWarn').value) || 80) / 100,
        thresholdHard: (parseFloat($('bfHard').value) || 100) / 100,
        mode: $('bfMode').value
      };
      await api('/budgets', { method: 'POST', body: JSON.stringify(body) });
      closeDrawer();
      loadBudgets();
    });

    // 切换范围时更新名称下拉
    $('bfScope').addEventListener('change', function () {
      $('bfNameSelect').innerHTML = this.value === 'department' ? deptOpts : userOpts;
      $('bfNameInput').value = '';
    });
  }

  // ════════════════════════════════════════
  // Tab 4: 风险规则
  // ════════════════════════════════════════

  async function loadRules() {
    const d = await api('/risk-rules');
    allRuleRows = d.rows || [];
    const filtered = activeRuleCategory ? allRuleRows.filter(r => r.category === activeRuleCategory) : allRuleRows;
    $('ruleCount').textContent = `${filtered.length} 条规则` + (activeRuleCategory ? ` / 共 ${allRuleRows.length}` : '');
    // 更新分类标签计数
    const bar = $('ruleCategoryBar');
    if (bar) {
      bar.querySelectorAll('[data-rule-cat]').forEach(btn => {
        const cat = btn.dataset.ruleCat;
        const count = cat ? allRuleRows.filter(r => r.category === cat).length : allRuleRows.length;
        const labels = { '': '全部', security: '安全凭证', privacy: '个人隐私', company: '公司信息', custom: '自定义' };
        btn.textContent = `${labels[cat] || cat} (${count})`;
        btn.classList.toggle('active', activeRuleCategory === cat);
      });
    }
    const grid = $('ruleGrid');
    if (!filtered.length) { grid.innerHTML = '<div style="padding:40px;text-align:center;color:#8e8e93;grid-column:1/-1">暂无规则</div>'; return; }
    grid.innerHTML = filtered.map(r => `
      <div class="rule-card" data-rule="${esc(r.ruleId)}">
        <div class="rule-card-head">
          <div style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" class="rule-batch-cb" value="${esc(r.ruleId)}" style="margin:0" />
            <div class="rule-card-title">${esc(r.displayName)}</div>
          </div>
          <label class="toggle-switch"><input type="checkbox" ${r.isEnabled ? 'checked' : ''} data-toggle-rule="${esc(r.ruleId)}" /><span class="toggle-slider"></span></label>
        </div>
        <div class="rule-card-desc">${esc(r.description)}</div>
        <div class="rule-card-pattern">${esc(r.pattern)}</div>
        <div class="rule-card-meta">
          <span class="badge badge-info">${esc(r.category || 'custom')}</span>
          ${badge(r.severity)} ${badge(r.action)}
          <button style="margin-left:auto;font-size:11px;padding:3px 10px;border:1px solid #e5e5ea;border-radius:6px;background:#fff;cursor:pointer" data-edit-rule="${esc(r.ruleId)}">编辑</button>
          <button style="font-size:11px;padding:3px 10px;border:1px solid rgba(255,59,48,0.3);border-radius:6px;background:#fff;cursor:pointer;color:#d70015" data-del-rule="${esc(r.ruleId)}">删除</button>
        </div>
      </div>`).join('');
    bindRuleEvents();
  }

  function bindRuleEvents() {
    document.querySelectorAll('[data-toggle-rule]').forEach(el => {
      el.addEventListener('change', async () => { await api(`/risk-rules/${el.dataset.toggleRule}/toggle`, { method: 'POST' }); loadRules(); });
    });
    document.querySelectorAll('[data-edit-rule]').forEach(el => {
      el.addEventListener('click', () => {
        const rule = allRuleRows.find(r => r.ruleId === el.dataset.editRule);
        if (rule) openRuleForm(rule);
      });
    });
    document.querySelectorAll('[data-del-rule]').forEach(el => {
      el.addEventListener('click', async () => { if (confirm('确认删除？')) { await api(`/risk-rules/${el.dataset.delRule}/delete`, { method: 'POST' }); loadRules(); } });
    });
  }

  function openRuleForm(r) {
    const isNew = !r;
    const d = r || { ruleId: '', displayName: '', description: '', pattern: '', severity: 'medium', action: 'route_secure_model', category: 'custom' };
    const catOpts = [['security', '安全凭证'], ['privacy', '个人隐私'], ['company', '公司信息'], ['custom', '自定义']].map(([k, v]) => `<option value="${k}" ${k === (d.category || 'custom') ? 'selected' : ''}>${v}</option>`).join('');
    openDrawer(isNew ? '新建规则' : `编辑 ${d.displayName}`, `
      <label>规则 ID</label><input id="rfId" value="${esc(d.ruleId)}" ${isNew ? '' : 'readonly style="opacity:0.6"'} placeholder="snake_case 标识" />
      <label>名称</label><input id="rfName" value="${esc(d.displayName)}" />
      <label>描述</label><input id="rfDesc" value="${esc(d.description)}" />
      <label>分类</label><select id="rfCategory">${catOpts}</select>
      <label>正则表达式</label><textarea id="rfPattern" rows="3" style="font-family:monospace">${esc(d.pattern)}</textarea>
      <label>严重程度</label><select id="rfSeverity"><option value="low" ${d.severity === 'low' ? 'selected' : ''}>低</option><option value="medium" ${d.severity === 'medium' ? 'selected' : ''}>中</option><option value="high" ${d.severity === 'high' ? 'selected' : ''}>高</option></select>
      <label>命中动作</label><select id="rfAction"><option value="allow" ${d.action === 'allow' ? 'selected' : ''}>放行</option><option value="route_secure_model" ${d.action === 'route_secure_model' ? 'selected' : ''}>路由到安全模型</option><option value="block" ${d.action === 'block' ? 'selected' : ''}>拦截</option></select>
    `, async () => {
      const body = {
        ruleId: $('rfId').value.trim(),
        displayName: $('rfName').value.trim(),
        description: $('rfDesc').value.trim(),
        pattern: $('rfPattern').value.trim(),
        severity: $('rfSeverity').value,
        action: $('rfAction').value,
        category: $('rfCategory').value
      };
      if (!body.ruleId || !body.pattern) { alert('规则 ID 和正则表达式不能为空'); return; }
      const res = await api('/risk-rules', { method: 'POST', body: JSON.stringify(body) });
      if (res.error) { alert(res.error); return; }
      closeDrawer(); loadRules();
    });
  }

  function getSelectedRuleIds() { return Array.from(document.querySelectorAll('.rule-batch-cb:checked')).map(el => el.value); }

  async function batchRuleAction(action) {
    const ids = getSelectedRuleIds();
    if (!ids.length) { alert('请先勾选要操作的规则'); return; }
    if (action === 'delete' && !confirm(`确认批量删除 ${ids.length} 条规则？`)) return;
    await api('/risk-rules/batch', { method: 'POST', body: JSON.stringify({ action, ruleIds: ids }) });
    loadRules();
  }

  async function exportRules() {
    const d = await api('/risk-rules/export');
    const blob = new Blob([JSON.stringify(d.rules || [], null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'risk-rules-export.json'; a.click();
  }

  function openImportDrawer() {
    openDrawer('导入规则', `
      <label>粘贴规则 JSON</label>
      <textarea id="importJson" rows="10" style="font-family:monospace;width:100%;box-sizing:border-box;font-size:12px;padding:10px;border:1px solid #e5e5ea;border-radius:8px;resize:vertical"></textarea>
      <label>导入模式</label>
      <select id="importMode"><option value="merge">合并（保留已有，覆盖同 ID）</option><option value="replace">替换（清空后导入）</option></select>
    `, async () => {
      let rules;
      try { rules = JSON.parse($('importJson').value); } catch { alert('JSON 格式无效'); return; }
      if (!Array.isArray(rules)) { alert('JSON 必须是数组格式'); return; }
      const res = await api('/risk-rules/import', { method: 'POST', body: JSON.stringify({ rules, mode: $('importMode').value }) });
      if (res.error) { alert(res.error); return; }
      closeDrawer(); loadRules();
    });
  }

  async function openSnapshotDrawer() {
    const d = await api('/risk-rules/snapshots');
    const snaps = d.snapshots || [];
    const html = !snaps.length
      ? '<div style="color:#8e8e93;text-align:center;padding:20px">暂无版本快照</div>'
      : snaps.map(s => `<div style="border:1px solid #ededf2;border-radius:10px;padding:10px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong style="font-size:13px">${esc(s.action)}</strong> · 规则 ${esc(s.ruleId || '-')}<div style="font-size:11px;color:#8e8e93">${new Date(s.timestamp).toLocaleString('zh-CN')} · ${s.ruleCount} 条规则</div></div>
            <button class="btn-secondary" style="font-size:11px;padding:4px 10px" data-restore-snap="${esc(s.id)}">恢复</button>
          </div></div>`).join('');
    openDrawer('版本历史', html, null);
    document.querySelectorAll('[data-restore-snap]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确认恢复到此版本？当前所有规则将被替换。')) return;
        await api(`/risk-rules/snapshots/${btn.dataset.restoreSnap}/restore`, { method: 'POST' });
        closeDrawer(); loadRules();
      });
    });
  }

  // ════════════════════════════════════════
  // 初始化——绑定 DOM 事件 + 加载数据
  // ════════════════════════════════════════

  function bindPageEvents() {
    // Tab 切换（只作用于主 tab 导航栏）
    document.querySelectorAll('.gw-tabs .gw-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gw-tabs .gw-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.gw-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.querySelector(`.gw-panel[data-tab="${tab}"]`).classList.add('active');
        if (tab !== currentTab) { currentTab = tab; loadTab(tab); }
      });
    });

    // Drawer 按钮
    $('closeGwDrawer').addEventListener('click', closeDrawer);
    $('gwDrawerMask').addEventListener('click', closeDrawer);
    $('btnDrawerCancel').addEventListener('click', closeDrawer);
    $('btnDrawerSave').addEventListener('click', () => { if (drawerSaveFn) drawerSaveFn(); });

    // 模型管理
    $('btnCreateModel').addEventListener('click', () => openModelForm(null));
    $('btnFailover').addEventListener('click', openFailoverDrawer);
    $('btnDiscover').addEventListener('click', openDiscoverDrawer);

    // 审计追踪筛选
    ['filterSearch', 'filterStatus', 'filterModel', 'filterLimit'].forEach(id => {
      $(id).addEventListener('change', () => { traceState.page = 1; loadTraces(); });
    });
    $('filterSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { traceState.page = 1; loadTraces(); } });
    $('btnRefreshTraces').addEventListener('click', () => { loadTraceStats(); loadTraces(); });

    // 成本分析筛选
    $('costUserDeptFilter').addEventListener('change', renderUserSummary);
    $('costUserSort').addEventListener('change', renderUserSummary);

    // 预算管理
    $('btnCreateBudget').addEventListener('click', () => openBudgetForm(null));

    // 风险规则
    $('btnCreateRule').addEventListener('click', () => openRuleForm(null));
    $('btnRuleSelectAll').addEventListener('click', () => { const cbs = document.querySelectorAll('.rule-batch-cb'); const allChecked = Array.from(cbs).every(c => c.checked); cbs.forEach(c => { c.checked = !allChecked; }); });
    $('btnRuleBatchEnable').addEventListener('click', () => batchRuleAction('enable'));
    $('btnRuleBatchDisable').addEventListener('click', () => batchRuleAction('disable'));
    $('btnRuleBatchDelete').addEventListener('click', () => batchRuleAction('delete'));
    $('btnRuleExport').addEventListener('click', exportRules);
    $('btnRuleImport').addEventListener('click', openImportDrawer);
    $('btnRuleSnapshots').addEventListener('click', openSnapshotDrawer);
    // 分类筛选条事件
    const catBar = $('ruleCategoryBar');
    if (catBar) {
      catBar.querySelectorAll('[data-rule-cat]').forEach(btn => {
        btn.addEventListener('click', () => { activeRuleCategory = btn.dataset.ruleCat; loadRules(); });
      });
    }
    $('btnTestRules').addEventListener('click', async () => {
      const raw = $('testText').value.trim();
      if (!raw) { alert('请输入测试文本'); return; }
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      const el = $('testResult');

      if (lines.length === 1) {
        // single-line: keep existing simple view
        const res = await api('/risk-rules/test', { method: 'POST', body: JSON.stringify({ text: lines[0] }) });
        if (!res.hits || !res.hits.length) {
          el.className = 'test-result safe'; el.style.display = 'block';
          el.innerHTML = '✓ 未检测到风险，所有规则均通过。';
        } else {
          el.className = 'test-result risky'; el.style.display = 'block';
          el.innerHTML = `<strong>检测到 ${res.hits.length} 条风险命中</strong><br>最高动作: ${badge(res.highestAction)} · 最高严重度: ${badge(res.highestSeverity)}<br><br>` +
            res.hits.map(h => `${badge(h.severity)} ${badge(h.action)} <strong>${esc(h.ruleName)}</strong> — ${esc(h.matchSummary)}`).join('<br>');
        }
        return;
      }

      // multi-line batch test
      el.className = 'test-result'; el.style.display = 'block';
      el.innerHTML = '<span style="color:#8e8e93">批量测试中...</span>';

      const results = [];
      for (const line of lines) {
        const res = await api('/risk-rules/test', { method: 'POST', body: JSON.stringify({ text: line }) });
        results.push({
          text: line,
          hitCount: (res.hits || []).length,
          highestAction: res.highestAction || 'allow',
          highestSeverity: res.highestSeverity || '-',
          hits: res.hits || []
        });
      }

      const safe = results.filter(r => r.hitCount === 0).length;
      const risky = results.length - safe;
      const summaryClass = risky > 0 ? 'risky' : 'safe';
      el.className = `test-result ${summaryClass}`;
      el.innerHTML = `
        <strong>批量测试完成：${results.length} 条文本，${safe} 条安全，${risky} 条命中风险</strong>
        <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:12px">
          <thead><tr style="text-align:left;border-bottom:1px solid rgba(0,0,0,0.1)">
            <th style="padding:6px 8px;width:40px">#</th>
            <th style="padding:6px 8px">文本摘要</th>
            <th style="padding:6px 8px;width:60px">命中数</th>
            <th style="padding:6px 8px;width:100px">最高动作</th>
            <th style="padding:6px 8px;width:80px">严重度</th>
          </tr></thead>
          <tbody>${results.map((r, i) => `
            <tr style="border-bottom:1px solid rgba(0,0,0,0.05)${r.hitCount > 0 ? ';background:rgba(255,59,48,0.03)' : ''}">
              <td style="padding:6px 8px;color:#8e8e93">${i + 1}</td>
              <td style="padding:6px 8px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.text)}">${esc(r.text.length > 60 ? r.text.slice(0, 60) + '...' : r.text)}</td>
              <td style="padding:6px 8px">${r.hitCount === 0 ? '<span style="color:#248a3d">0</span>' : `<span style="color:#d70015">${r.hitCount}</span>`}</td>
              <td style="padding:6px 8px">${r.hitCount > 0 ? badge(r.highestAction) : '<span style="color:#248a3d">安全</span>'}</td>
              <td style="padding:6px 8px">${r.hitCount > 0 ? badge(r.highestSeverity) : '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    });
  }

  // 暴露全局初始化函数——供 HTML 内联脚本在每次页面导航时调用
  window.__aiGatewayInit = function () {
    currentTab = 'models';
    traceState = { page: 1, limit: 20 };
    cachedCostData = null;
    activeRuleCategory = '';
    allRuleRows = [];
    bindPageEvents();
    loadModels();
  };

  // 首次加载时执行
  window.__aiGatewayInit();

  // bfcache 恢复
  window.addEventListener('pageshow', function (e) { if (e.persisted) window.__aiGatewayInit(); });
})();
