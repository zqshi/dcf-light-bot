(function attachEmployeeDetailRenderer(global) {
  function createEmployeeDetailRenderer(deps = {}) {
    const getNode = deps.getNode || ((id) => document.getElementById(id));
    const escapeHtml = deps.escapeHtml || ((input) => String(input || ''));
    const pretty = deps.pretty || ((input) => JSON.stringify(input, null, 2));
    const formatDate = deps.formatDate || ((value) => String(value || '-'));
    const renderTagList = deps.renderTagList || (() => '');
    const formatDeptRoleText = deps.formatDeptRoleText || (() => '-');
    const resolveRuntimeProfile = deps.resolveRuntimeProfile || (() => ({}));

    function asCountMap(input, fallbackKeys = []) {
      const map = {};
      for (const key of fallbackKeys) map[key] = 0;
      const src = (input && typeof input === 'object') ? input : {};
      for (const [key, value] of Object.entries(src)) map[key] = Number(value) || 0;
      return map;
    }

    function renderCountPills(countMap, tone = 'ok') {
      return Object.entries(countMap)
        .map(([key, value]) => `<span class="badge ${tone}">${escapeHtml(key)}: ${Number(value) || 0}</span>`)
        .join('');
    }

    function renderTopList(items = [], emptyText = '暂无') {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return `<span class="badge">${escapeHtml(emptyText)}</span>`;
      return list
        .slice(0, 8)
        .map((item) => `<span class="badge ok">${escapeHtml(`${item.key}: ${item.count}`)}</span>`)
        .join('');
    }

    function renderRecentTasks(tasks = []) {
      if (!tasks.length) return '<div class="empty">暂无任务记录</div>';
      return `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>风险</th>
                <th>状态</th>
                <th>审批</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map((task) => `
                <tr>
                  <td>${escapeHtml(task.goal || '-')}</td>
                  <td><span class="badge warn">${escapeHtml(task.riskLevel || '-')}</span></td>
                  <td><span class="badge ok">${escapeHtml(task.status || '-')}</span></td>
                  <td>${task.requiresApproval ? '需要审批' : '自动审批'}</td>
                  <td>${escapeHtml(formatDate(task.updatedAt || task.createdAt))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return function renderEmployeeDetail(detail) {
      const body = getNode('employeeDrawerBody');
      const title = getNode('employeeDrawerTitle');
      if (!body || !title) return;
      const summary = detail.summary || {};
      const tasksSummary = summary.tasks || {};
      const governanceSummary = summary.governance || {};
      const growthSummary = summary.growth || {};
      const runtimeSummary = summary.runtime || {};
      const jobPolicy = detail.jobPolicy || {};
      const approvalByRisk = (detail.approvalPolicy || {}).byRisk || {};
      const taskStatusMap = asCountMap(tasksSummary.byStatus, ['pending', 'validating', 'approved', 'running', 'succeeded', 'failed', 'rolled_back', 'aborted']);
      const taskRiskMap = asCountMap(tasksSummary.byRisk, ['L1', 'L2', 'L3', 'L4']);
      const recentTasks = Array.isArray(detail.recentTasks) ? detail.recentTasks : [];
      const childAgents = Array.isArray(detail.childAgents) ? detail.childAgents : [];
      const runtimeProfile = resolveRuntimeProfile(detail);
      const retrievalPolicy = (runtimeSummary.retrievalPolicy && typeof runtimeSummary.retrievalPolicy === 'object')
        ? runtimeSummary.retrievalPolicy
        : { mode: 'inherit' };
      const effectiveRetrievalMode = (runtimeSummary.effectiveRetrievalMode && typeof runtimeSummary.effectiveRetrievalMode === 'object')
        ? runtimeSummary.effectiveRetrievalMode
        : { mode: '-', source: '-' };

      title.textContent = `员工详情 · ${detail.id || '-'}`;
      body.innerHTML = `
        <section class="detail-section">
          <h4>身份与岗位</h4>
          <div class="overview-kpis">
            <div><span>实例ID</span><strong>${escapeHtml(detail.id || '-')}</strong></div>
            <div><span>姓名</span><strong>${escapeHtml(detail.name || '-')}</strong></div>
            <div><span>租户</span><strong>${escapeHtml(detail.tenantId || '-')}</strong></div>
            <div><span>固定会话ID</span><strong>${escapeHtml(detail.matrixRoomId || '-')}</strong></div>
            <div><span>部门/岗位</span><strong>${escapeHtml(formatDeptRoleText(detail.department, detail.role))}</strong></div>
            <div><span>员工状态</span><strong>${escapeHtml(detail.status || '-')}</strong></div>
          </div>
        </section>

        <section class="detail-section">
          <h4>Runtime 配置</h4>
          <div class="overview-kpis">
            <div><span>Agent ID</span><strong>${escapeHtml(runtimeProfile.agentId || '-')}</strong></div>
            <div><span>运行时绑定任务</span><strong>${Number(runtimeSummary.runtimeBoundCount) || 0}</strong></div>
            <div><span>Prompt已配置任务</span><strong>${Number(runtimeSummary.promptConfiguredCount) || 0}</strong></div>
            <div><span>员工检索配置（仅存档）</span><strong>${escapeHtml(retrievalPolicy.mode || 'inherit')}</strong></div>
            <div><span>生效检索模式</span><strong>${escapeHtml(`${effectiveRetrievalMode.mode || '-'} (${effectiveRetrievalMode.source || '-'})`)}</strong></div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">已授权工具</div>
            <div>${renderTagList(runtimeProfile.toolScope || [], '未配置')}</div>
          </div>
          <div class="detail-grid2" style="margin-top:8px;">
            <div>
              <div class="toolbar-note">Agent 使用分布</div>
              <div>${renderTopList(runtimeSummary.byAgentId || [])}</div>
            </div>
            <div>
              <div class="toolbar-note">Policy 使用分布</div>
              <div>${renderTopList(runtimeSummary.byPolicyId || [])}</div>
            </div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">工具调用分布</div>
            <div>${renderTopList(runtimeSummary.byToolScope || [])}</div>
          </div>
          <details style="margin-top:8px;">
            <summary>System Prompt</summary>
            <pre class="mono">${escapeHtml(runtimeProfile.systemPrompt || '未配置')}</pre>
          </details>
        </section>

        <section class="detail-section">
          <h4>岗位合同与治理边界</h4>
          <div class="detail-grid2">
            <div>
              <div class="toolbar-note">职责范围（Allow）</div>
              <div>${renderTagList(jobPolicy.allow, '未配置')}</div>
            </div>
            <div>
              <div class="toolbar-note">禁止边界（Deny）</div>
              <div>${renderTagList(jobPolicy.deny, '未配置')}</div>
            </div>
          </div>
          <div class="detail-grid2" style="margin-top:8px;">
            <div>
              <div class="toolbar-note">KPI 目标</div>
              <div>${renderTagList(jobPolicy.kpi, '未配置')}</div>
            </div>
            <div>
              <div class="toolbar-note">升级/停机规则</div>
              <div class="overview-list">
                <div class="overview-item">升级规则：${escapeHtml(jobPolicy.escalationRule || '未配置')}</div>
                <div class="overview-item">停机规则：${escapeHtml(jobPolicy.shutdownRule || '未配置')}</div>
              </div>
            </div>
          </div>
          <details style="margin-top:8px;">
            <summary>审批策略（按风险级别）</summary>
            <pre class="mono">${escapeHtml(pretty(approvalByRisk))}</pre>
          </details>
        </section>

        <section class="detail-section">
          <h4>任务执行表现</h4>
          <div class="overview-kpis">
            <div><span>任务总数</span><strong>${Number(tasksSummary.total) || 0}</strong></div>
            <div><span>成功率</span><strong>${Number(tasksSummary.successRate) || 0}%</strong></div>
            <div><span>需审批任务</span><strong>${Number(tasksSummary.requiresApprovalCount) || 0}</strong></div>
            <div><span>待审批任务</span><strong>${Number(tasksSummary.waitingApprovalCount) || 0}</strong></div>
            <div><span>回滚次数</span><strong>${Number(tasksSummary.rollbackCount) || 0}</strong></div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">按状态分布</div>
            <div>${renderCountPills(taskStatusMap, 'ok')}</div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">按风险等级分布</div>
            <div>${renderCountPills(taskRiskMap, 'warn')}</div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">最近任务</div>
            ${renderRecentTasks(recentTasks)}
          </div>
        </section>

        <section class="detail-section">
          <h4>能力成长</h4>
          <div class="overview-kpis">
            <div><span>原子/衍生能力</span><strong>${Number(growthSummary.capabilityCount) || 0}</strong></div>
            <div><span>知识沉淀</span><strong>${Number(growthSummary.knowledgeCount) || 0}</strong></div>
            <div><span>关联技能</span><strong>${Number(growthSummary.linkedSkillCount) || 0}</strong></div>
            <div><span>已注册技能</span><strong>${Number(growthSummary.relatedSkillCount) || 0}</strong></div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">能力标签</div>
            <div>${renderTagList(detail.capabilities, '暂无能力')}</div>
          </div>
          <div style="margin-top:8px;">
            <div class="toolbar-note">技能类型分布</div>
            <div>${renderCountPills(asCountMap(growthSummary.skillTypeCount, ['general', 'domain']), 'ok')}</div>
          </div>
        </section>

        <section class="detail-section">
          <h4>协作结构</h4>
          <div class="overview-kpis">
            <div><span>父Agent</span><strong>${escapeHtml(detail.id || '-')}</strong></div>
            <div><span>子Agent总数</span><strong>${Number(growthSummary.childAgentCount) || 0}</strong></div>
            <div><span>活跃子Agent</span><strong>${Number(growthSummary.activeChildAgentCount) || 0}</strong></div>
          </div>
          <details style="margin-top:8px;">
            <summary>子Agent 列表</summary>
            <pre class="mono">${escapeHtml(pretty(childAgents.slice(0, 20)))}</pre>
          </details>
        </section>

        <section class="detail-section">
          <h4>审计与风控</h4>
          <div class="overview-kpis">
            <div><span>审计事件</span><strong>${Number(governanceSummary.auditEventCount) || 0}</strong></div>
            <div><span>运行时事件</span><strong>${Number(governanceSummary.runtimeEventCount) || 0}</strong></div>
            <div><span>审批事件</span><strong>${Number(governanceSummary.approvalEventCount) || 0}</strong></div>
            <div><span>回滚事件</span><strong>${Number(governanceSummary.rollbackEventCount) || 0}</strong></div>
            <div><span>失败事件</span><strong>${Number(governanceSummary.failedEventCount) || 0}</strong></div>
            <div><span>P1 事故</span><strong>${Number(governanceSummary.p1IncidentCount) || 0}</strong></div>
          </div>
          <details style="margin-top:8px;">
            <summary>近期风险事件</summary>
            <pre class="mono">${escapeHtml(pretty(governanceSummary.recentRiskEvents || []))}</pre>
          </details>
        </section>

        <details style="margin-top:12px;">
          <summary>查看原始JSON</summary>
          <pre class="mono">${escapeHtml(pretty(detail))}</pre>
        </details>
      `;
    };
  }

  global.__adminEmployeeDetailRenderer = { createEmployeeDetailRenderer };
}(window));
