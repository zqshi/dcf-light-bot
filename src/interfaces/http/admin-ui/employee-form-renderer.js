/**
 * employee-form-renderer.js
 *
 * 编辑表单 + 策略配置渲染逻辑，从 employees.js 拆出。
 * 依赖注入：通过 createEmployeeFormRenderer(deps) 接收公共工具。
 * 暴露方式：window.__adminEmployeeFormRenderer
 */
(function attachEmployeeFormRenderer(global) {
  function createEmployeeFormRenderer(deps) {
    const getNode = deps.getNode;
    const escapeHtml = deps.escapeHtml;
    const api = deps.api;
    const resolveRuntimeProfile = deps.resolveRuntimeProfile;
    const fetchEmployeeDetail = deps.fetchEmployeeDetail;
    const setDrawerMode = deps.setDrawerMode;
    const setDrawerVisibility = deps.setDrawerVisibility;
    const canWriteEmployees = deps.canWriteEmployees;
    const loadPage = deps.loadPage;
    const getCurrentEmployeeId = deps.getCurrentEmployeeId;
    const setCurrentEmployeeId = deps.setCurrentEmployeeId;

    // ── Policy result UI ──

    function showPolicyResult(message, tone = 'info') {
      const node = getNode('policyResult');
      if (!node) return;
      node.classList.remove('hidden', 'warn', 'ok');
      if (tone === 'warn') node.classList.add('warn');
      if (tone === 'ok') node.classList.add('ok');
      node.textContent = String(message || '').trim();
    }

    function hidePolicyResult() {
      const node = getNode('policyResult');
      if (!node) return;
      node.classList.add('hidden');
      node.classList.remove('warn', 'ok');
      node.textContent = '';
    }

    const POLICY_REQUIRED_FIELD_IDS = [
      'jobAllowList',
      'jobDenyList',
      'jobKpiList',
      'jobEscalationRule',
      'jobShutdownRule',
      'jobPolicyNarrative'
    ];

    const POLICY_REQUIRED_VALIDATION_IDS = [
      'jobAllowValidation',
      'jobDenyValidation',
      'jobKpiValidation',
      'jobEscalationValidation',
      'jobShutdownValidation',
      'jobNarrativeValidation'
    ];

    function hidePolicyRequiredValidationHints() {
      for (const id of POLICY_REQUIRED_VALIDATION_IDS) {
        const node = getNode(id);
        if (!node) continue;
        node.classList.add('hidden');
      }
    }

    function showPolicyRequiredValidationHints(message) {
      for (let i = 0; i < POLICY_REQUIRED_FIELD_IDS.length; i++) {
        const validationId = POLICY_REQUIRED_VALIDATION_IDS[i];
        const node = getNode(validationId);
        if (!node) continue;
        node.textContent = message || '此项为必填';
        node.classList.remove('hidden');
      }
    }

    // ── Policy defaults ──

    function defaultJobPolicy() {
      return {
        allow: [],
        deny: [],
        kpi: [],
        escalationRule: '',
        shutdownRule: ''
      };
    }

    function defaultApprovalPolicy() {
      return {
        byRisk: {
          L1: { requiredApprovals: 0, requiredAnyRoles: [], distinctRoles: false },
          L2: { requiredApprovals: 1, requiredAnyRoles: ['manager'], distinctRoles: false },
          L3: { requiredApprovals: 2, requiredAnyRoles: ['manager', 'director'], distinctRoles: true },
          L4: { requiredApprovals: 3, requiredAnyRoles: ['director', 'vp'], distinctRoles: true }
        }
      };
    }

    function buildDefaultSystemPrompt(input = {}) {
      const name = input.name || '数字员工';
      const department = input.department || '通用';
      const role = input.role || '专员';
      const riskLevel = input.riskLevel || 'L2';
      return [
        `你是一名数字员工，名字叫「${name}」。`,
        `你归属于「${department}」部门，岗位角色是「${role}」。`,
        `你的风险等级为 ${riskLevel}，请严格遵守公司合规和审批流程。`,
        '',
        '你的职责包括：',
        '1. 在授权范围内自主完成日常操作任务',
        '2. 遇到超出权限的操作，立即上报人类经理',
        '3. 记录所有关键操作的审计日志',
        '4. 遵循公司数据安全和隐私保护规范'
      ].join('\n');
    }

    // ── Form read/write ──

    function parseLineList(id) {
      const node = getNode(id);
      const raw = node ? String(node.value || '') : '';
      return raw.split('\n').map((line) => line.trim()).filter(Boolean);
    }

    function parseRoleList(input) {
      return String(input || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function collectJobPolicyFromForm() {
      const escalationRuleNode = getNode('jobEscalationRule');
      const shutdownRuleNode = getNode('jobShutdownRule');
      return {
        allow: parseLineList('jobAllowList'),
        deny: parseLineList('jobDenyList'),
        kpi: parseLineList('jobKpiList'),
        escalationRule: String((escalationRuleNode && escalationRuleNode.value) || '').trim(),
        shutdownRule: String((shutdownRuleNode && shutdownRuleNode.value) || '').trim()
      };
    }

    function collectApprovalPolicyFromForm() {
      const byRisk = {};
      for (const level of ['L1', 'L2', 'L3', 'L4']) {
        const lower = level.toLowerCase();
        const countNode = getNode(`ap_${lower}_count`);
        const rolesNode = getNode(`ap_${lower}_roles`);
        const distinctNode = getNode(`ap_${lower}_distinct`);
        byRisk[level] = {
          requiredApprovals: Number((countNode && countNode.value) || 0),
          requiredAnyRoles: parseRoleList((rolesNode && rolesNode.value) || ''),
          distinctRoles: Boolean(distinctNode && distinctNode.checked)
        };
      }
      return { byRisk };
    }

    async function optimizePolicyPromptFromForm() {
      const currentId = getCurrentEmployeeId();
      if (!currentId) throw new Error('请先选择员工');
      const jobPolicy = collectJobPolicyFromForm();
      const approvalPolicy = collectApprovalPolicyFromForm();
      const narrative = String((getNode('jobPolicyNarrative') && getNode('jobPolicyNarrative').value) || '').trim();
      const result = await api(`/api/admin/employees/${currentId}/optimize-policy-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobPolicy, approvalPolicy, narrative })
      });
      if (result && result.optimizedPrompt) {
        const promptNode = getNode('editRuntimeSystemPrompt');
        if (promptNode) promptNode.value = result.optimizedPrompt;
        showPolicyResult('大模型理解优化完成，System Prompt 已更新。请检查后保存。', 'ok');
      } else {
        showPolicyResult('优化返回为空，请检查后端日志。', 'warn');
      }
    }

    function hasAnyPolicyInput(jobPolicy = {}, narrative = '') {
      const hasAllow = Array.isArray(jobPolicy.allow) && jobPolicy.allow.length > 0;
      const hasDeny = Array.isArray(jobPolicy.deny) && jobPolicy.deny.length > 0;
      const hasKpi = Array.isArray(jobPolicy.kpi) && jobPolicy.kpi.length > 0;
      const hasEscalation = Boolean(jobPolicy.escalationRule);
      const hasShutdown = Boolean(jobPolicy.shutdownRule);
      const hasNarrative = Boolean(narrative);
      return hasAllow || hasDeny || hasKpi || hasEscalation || hasShutdown || hasNarrative;
    }

    function syncApprovalRowState(level) {
      const lower = level.toLowerCase();
      const countNode = getNode(`ap_${lower}_count`);
      const rolesNode = getNode(`ap_${lower}_roles`);
      const distinctNode = getNode(`ap_${lower}_distinct`);
      const count = Number((countNode && countNode.value) || 0);
      const needsApproval = count > 0;
      if (rolesNode) rolesNode.disabled = !needsApproval;
      if (distinctNode) distinctNode.disabled = !needsApproval;
    }

    function syncApprovalFormState() {
      for (const level of ['L1', 'L2', 'L3', 'L4']) syncApprovalRowState(level);
    }

    function collectBoundaryHints(jobPolicy, approvalPolicy) {
      const hints = [];
      if (!Array.isArray(jobPolicy.allow) || jobPolicy.allow.length === 0) {
        hints.push('Allow 列表为空：员工没有任何明确授权的操作范围，建议补充。');
      }
      if (!Array.isArray(jobPolicy.deny) || jobPolicy.deny.length === 0) {
        hints.push('Deny 列表为空：没有设置禁止操作，员工可能执行超出预期的任务。');
      }
      if (!Array.isArray(jobPolicy.kpi) || jobPolicy.kpi.length === 0) {
        hints.push('KPI 列表为空：未定义量化考核指标，难以评估员工绩效。');
      }
      if (!jobPolicy.escalationRule) {
        hints.push('上报规则为空：员工遇到异常时没有明确的上报流程。');
      }
      if (!jobPolicy.shutdownRule) {
        hints.push('熔断规则为空：没有设置自动停机条件，极端情况下可能造成损失。');
      }
      const byRisk = (approvalPolicy && approvalPolicy.byRisk) || {};
      for (const level of ['L3', 'L4']) {
        const policy = byRisk[level] || {};
        if (!policy.requiredApprovals || policy.requiredApprovals < 1) {
          hints.push(`${level} 审批层级缺失：高风险操作未配置审批人数要求。`);
        }
        if (!Array.isArray(policy.requiredAnyRoles) || policy.requiredAnyRoles.length === 0) {
          hints.push(`${level} 审批角色缺失：高风险操作未指定有权审批的角色。`);
        }
      }
      return hints;
    }

    function evaluateBoundaryChecksFromForm() {
      const jobPolicy = collectJobPolicyFromForm();
      const approvalPolicy = collectApprovalPolicyFromForm();
      return { hints: collectBoundaryHints(jobPolicy, approvalPolicy), jobPolicy, approvalPolicy };
    }

    function renderBoundaryCheckReport(hints = []) {
      const node = getNode('boundaryCheckReport');
      if (!node) return;
      if (!hints.length) {
        node.innerHTML = '';
        node.classList.add('hidden');
        return;
      }
      node.classList.remove('hidden');
      node.innerHTML = hints.map((item) => `<div class="boundary-hint">${escapeHtml(item)}</div>`).join('');
    }

    function collectEditableProfile() {
      const name = String((getNode('editName') && getNode('editName').value) || '').trim();
      const department = String((getNode('editDepartment') && getNode('editDepartment').value) || '').trim();
      const role = String((getNode('editRole') && getNode('editRole').value) || '').trim();
      const riskLevel = String((getNode('editRiskLevel') && getNode('editRiskLevel').value) || 'L2').trim();
      const runtimePromptRaw = String((getNode('editRuntimeSystemPrompt') && getNode('editRuntimeSystemPrompt').value) || '').trim();
      const runtimePrompt = runtimePromptRaw || buildDefaultSystemPrompt({
        name,
        department,
        role,
        riskLevel
      });
      return {
        name,
        department,
        role,
        riskLevel,
        status: String((getNode('editStatus') && getNode('editStatus').value) || 'active').trim(),
        runtimeProfile: {
          systemPrompt: runtimePrompt
        }
      };
    }

    // ── Form fill ──

    function fillEditForm(detail) {
      const readonlyMeta = getNode('editReadonlyMeta');
      const title = getNode('employeeDrawerTitle');
      if (title) title.textContent = `编辑数字员工 · ${detail.id || '-'}`;
      if (readonlyMeta) {
        readonlyMeta.innerHTML = `
          <div><span>实例ID</span><strong>${escapeHtml(detail.id || '-')}</strong></div>
          <div><span>租户</span><strong>${escapeHtml(detail.tenantId || '-')}</strong></div>
          <div><span>固定会话ID</span><strong>${escapeHtml(detail.matrixRoomId || '-')}</strong></div>
        `;
      }
      const name = getNode('editName');
      const department = getNode('editDepartment');
      const role = getNode('editRole');
      const riskLevel = getNode('editRiskLevel');
      const status = getNode('editStatus');
      const runtimeAgentId = getNode('editRuntimeAgentId');
      const runtimeSystemPrompt = getNode('editRuntimeSystemPrompt');
      if (name) name.value = detail.name || '';
      if (department) department.value = detail.department || '';
      if (role) role.value = detail.role || '';
      if (riskLevel) riskLevel.value = detail.riskLevel || 'L2';
      if (status) status.value = detail.status || 'active';
      const runtimeProfile = resolveRuntimeProfile(detail);
      if (runtimeAgentId) {
        runtimeAgentId.value = runtimeProfile.agentId || '';
        runtimeAgentId.readOnly = true;
        runtimeAgentId.disabled = true;
        runtimeAgentId.setAttribute('aria-readonly', 'true');
      }
      if (runtimeSystemPrompt) {
        runtimeSystemPrompt.value = runtimeProfile.systemPrompt || buildDefaultSystemPrompt({
          name: detail.name,
          department: detail.department,
          role: detail.role,
          riskLevel: detail.riskLevel
        });
      }
      const jobPolicy = detail.jobPolicy || defaultJobPolicy();
      const approvalPolicy = detail.approvalPolicy || defaultApprovalPolicy();

      const setTextVal = (id, value) => {
        const node = getNode(id);
        if (node) node.value = value;
      };
      const setCheck = (id, value) => {
        const node = getNode(id);
        if (node) node.checked = Boolean(value);
      };

      setTextVal('jobAllowList', Array.isArray(jobPolicy.allow) ? jobPolicy.allow.join('\n') : '');
      setTextVal('jobDenyList', Array.isArray(jobPolicy.deny) ? jobPolicy.deny.join('\n') : '');
      setTextVal('jobKpiList', Array.isArray(jobPolicy.kpi) ? jobPolicy.kpi.join('\n') : '');
      setTextVal('jobEscalationRule', jobPolicy.escalationRule || '');
      setTextVal('jobShutdownRule', jobPolicy.shutdownRule || '');
      setTextVal('jobPolicyNarrative', '');

      const byRisk = approvalPolicy.byRisk || {};
      for (const level of ['L1', 'L2', 'L3', 'L4']) {
        const policy = byRisk[level] || {};
        setTextVal(`ap_${level.toLowerCase()}_count`, String(Number(policy.requiredApprovals || 0)));
        setTextVal(`ap_${level.toLowerCase()}_roles`, Array.isArray(policy.requiredAnyRoles) ? policy.requiredAnyRoles.join(', ') : '');
        setCheck(`ap_${level.toLowerCase()}_distinct`, Boolean(policy.distinctRoles));
      }
      syncApprovalFormState();
      hidePolicyRequiredValidationHints();
      hidePolicyResult();
    }

    // ── CRUD actions ──

    async function openEditModal(employeeId) {
      setDrawerMode('edit');
      const detail = await fetchEmployeeDetail(employeeId);
      setCurrentEmployeeId(detail.id);
      fillEditForm(detail);
      hidePolicyResult();
      setDrawerVisibility(true);
    }

    async function saveEmployeeEdits() {
      const currentId = getCurrentEmployeeId();
      if (!currentId) throw new Error('请先选择员工');
      const profile = collectEditableProfile();
      const jobPolicy = collectJobPolicyFromForm();
      const approvalPolicy = collectApprovalPolicyFromForm();

      await api(`/api/admin/employees/${currentId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      await api(`/api/admin/employees/${currentId}/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobPolicy })
      });
      await api(`/api/admin/employees/${currentId}/approval-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalPolicy })
      });
    }

    function wireEditActions() {
      const saveBtn = getNode('saveEmployeeEdit');
      const optimizeBtn = getNode('optimizePolicyForLlm');
      if (optimizeBtn) {
        optimizeBtn.disabled = !canWriteEmployees();
        optimizeBtn.onclick = async () => {
          if (!canWriteEmployees()) return;
          try {
            hidePolicyRequiredValidationHints();
            hidePolicyResult();
            const narrative = String((getNode('jobPolicyNarrative') && getNode('jobPolicyNarrative').value) || '').trim();
            const { hints, jobPolicy } = evaluateBoundaryChecksFromForm();
            if (!hasAnyPolicyInput(jobPolicy, narrative)) {
              showPolicyRequiredValidationHints('请至少填写一项边界信息或补充说明后再执行优化。');
              const firstField = getNode(POLICY_REQUIRED_FIELD_IDS[0]);
              if (firstField) firstField.focus();
              return;
            }
            if (hints.length > 0) {
              renderBoundaryCheckReport(hints);
              const summary = hints.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n');
              const confirmed = window.confirm(`检测到 ${hints.length} 项边界风险：\n${summary}\n\n是否仍继续执行大模型理解优化？`);
              if (!confirmed) {
                showPolicyResult('已取消优化，请先修正边界风险后再试。', 'warn');
                return;
              }
            }
            optimizeBtn.disabled = true;
            showPolicyResult('正在生成大模型理解优化内容，请稍候…');
            await optimizePolicyPromptFromForm();
          } catch (error) {
            showPolicyResult(`优化失败：${error.message}`, 'warn');
          } finally {
            optimizeBtn.disabled = false;
          }
        };
      }
      if (saveBtn) {
        saveBtn.disabled = !canWriteEmployees();
        saveBtn.onclick = async () => {
          if (!canWriteEmployees()) return;
          try {
            const { hints } = evaluateBoundaryChecksFromForm();
            if (hints.length > 0) {
              renderBoundaryCheckReport(hints);
              const summary = hints.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n');
              const confirmed = window.confirm(`检测到 ${hints.length} 项边界风险：\n${summary}\n\n是否仍继续保存？`);
              if (!confirmed) {
                showPolicyResult('已取消保存，请先修正边界风险后再提交。', 'warn');
                return;
              }
            } else {
              hidePolicyResult();
            }
            await saveEmployeeEdits();
            showPolicyResult(`保存成功：${new Date().toLocaleString()}`, 'ok');
            await loadPage();
            const currentId = getCurrentEmployeeId();
            const detail = await fetchEmployeeDetail(currentId);
            fillEditForm(detail);
            setDrawerMode('edit');
          } catch (error) {
            showPolicyResult(`保存失败：${error.message}`, 'warn');
          }
        };
      }

      [
        'jobAllowList', 'jobDenyList', 'jobKpiList', 'jobEscalationRule', 'jobShutdownRule', 'jobPolicyNarrative',
        'editRuntimeSystemPrompt',
        'ap_l1_count', 'ap_l1_roles', 'ap_l1_distinct',
        'ap_l2_count', 'ap_l2_roles', 'ap_l2_distinct',
        'ap_l3_count', 'ap_l3_roles', 'ap_l3_distinct',
        'ap_l4_count', 'ap_l4_roles', 'ap_l4_distinct'
      ].forEach((id) => {
        const node = getNode(id);
        if (!node) return;
        if (id.endsWith('_count')) {
          node.addEventListener('input', syncApprovalFormState);
          node.addEventListener('change', syncApprovalFormState);
        }
        if (POLICY_REQUIRED_FIELD_IDS.includes(id)) {
          node.addEventListener('input', hidePolicyRequiredValidationHints);
          node.addEventListener('change', hidePolicyRequiredValidationHints);
        }
        node.addEventListener('input', hidePolicyResult);
        node.addEventListener('change', hidePolicyResult);
      });
    }

    // Public API
    return {
      fillEditForm,
      openEditModal,
      saveEmployeeEdits,
      wireEditActions,
      showPolicyResult,
      hidePolicyResult,
      buildDefaultSystemPrompt,
      defaultJobPolicy,
      defaultApprovalPolicy
    };
  }

  global.__adminEmployeeFormRenderer = { createEmployeeFormRenderer };
})(typeof window !== 'undefined' ? window : globalThis);
