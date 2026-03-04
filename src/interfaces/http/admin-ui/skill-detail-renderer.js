(function attachSkillDetailRenderer(global) {
  function createSkillDetailRenderer(deps = {}) {
    const api = deps.api;
    const escapeHtml = deps.escapeHtml || ((x) => String(x || ''));
    const renderStatus = deps.renderStatus || (() => {});
    const applyActionAcl = deps.applyActionAcl || (() => {});
    const setDrawerVisibility = deps.setDrawerVisibility || (() => {});
    const buildDetailDigest = deps.buildDetailDigest || (() => '');
    const load = deps.load || (async () => {});
    const loadEmployeeCandidates = deps.loadEmployeeCandidates || (async () => {});
    const fetchSkillDetail = deps.fetchSkillDetail || (async (skillId) => api(`/api/admin/skills/${encodeURIComponent(String(skillId || ''))}`));
    const getCurrentSkillId = deps.getCurrentSkillId || (() => '');
    const setCurrentSkillId = deps.setCurrentSkillId || (() => {});
    const getCurrentDetailDigest = deps.getCurrentDetailDigest || (() => '');
    const setCurrentDetailDigest = deps.setCurrentDetailDigest || (() => {});
    const getEmployeeCandidates = deps.getEmployeeCandidates || (() => []);
    const isEmployeeCandidatesLoaded = deps.isEmployeeCandidatesLoaded || (() => false);
    const getEmployeeCandidatesError = deps.getEmployeeCandidatesError || (() => '');
    const canUnlinkEmployee = typeof deps.canUnlinkEmployee === 'function'
      ? deps.canUnlinkEmployee
      : () => deps.canUnlinkEmployee === true;
    const canDeleteSkill = typeof deps.canDeleteSkill === 'function'
      ? deps.canDeleteSkill
      : () => deps.canDeleteSkill === true;
    const canWriteSkills = typeof deps.canWriteSkills === 'function'
      ? deps.canWriteSkills
      : () => deps.canWriteSkills === true;
    const rawJsonExpandedBySkillId = deps.rawJsonExpandedBySkillId || new Map();
    const managerInfoExpandedBySkillId = deps.managerInfoExpandedBySkillId || new Map();
    const selectedResourcePathBySkillId = deps.selectedResourcePathBySkillId || new Map();

    function sanitizeHref(url) {
      const value = String(url || '').trim();
      if (!value) return '#';
      if (value.toLowerCase().startsWith('javascript:')) return '#';
      return value;
    }

    function renderInlineMarkdown(text) {
      let html = escapeHtml(text);
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => (
        `<a href="${escapeHtml(sanitizeHref(href))}" target="_blank" rel="noopener noreferrer">${label}</a>`
      ));
      return html;
    }

    function renderMarkdownDocument(markdown) {
      const lines = String(markdown || '').replaceAll('\r\n', '\n').split('\n');
      if (!lines.length || !lines.some((line) => line.trim())) return '<div class="empty">暂无 SKILL.md 内容</div>';
      let i = 0;
      let inCodeBlock = false;
      let codeLines = [];
      const blocks = [];
      const flushCodeBlock = () => {
        if (!inCodeBlock) return;
        blocks.push(`<pre class="mono skill-markdown-code"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeLines = [];
      };
      const collectParagraph = (startIndex) => {
        const paragraph = [];
        let cursor = startIndex;
        while (cursor < lines.length) {
          const trimmed = lines[cursor].trim();
          if (!trimmed || /^#{1,6}\s+/.test(trimmed) || /^```/.test(trimmed) || /^>\s?/.test(trimmed) || /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) break;
          paragraph.push(trimmed);
          cursor += 1;
        }
        return { next: cursor, html: paragraph.length ? `<p>${renderInlineMarkdown(paragraph.join(' '))}</p>` : '' };
      };
      while (i < lines.length) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (inCodeBlock) {
          if (/^```/.test(trimmed)) flushCodeBlock();
          else codeLines.push(raw);
          i += 1;
          continue;
        }
        if (!trimmed) {
          i += 1;
          continue;
        }
        if (/^```/.test(trimmed)) {
          inCodeBlock = true;
          i += 1;
          continue;
        }
        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = Math.min(6, heading[1].length);
          blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
          i += 1;
          continue;
        }
        if (/^>\s?/.test(trimmed)) {
          const quote = [];
          while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
            quote.push(lines[i].trim().replace(/^>\s?/, ''));
            i += 1;
          }
          blocks.push(`<blockquote>${renderInlineMarkdown(quote.join(' '))}</blockquote>`);
          continue;
        }
        if (/^[-*]\s+/.test(trimmed)) {
          const items = [];
          while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
            items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
            i += 1;
          }
          blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
          continue;
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const items = [];
          while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
            items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
            i += 1;
          }
          blocks.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
          continue;
        }
        const paragraph = collectParagraph(i);
        if (paragraph.html) blocks.push(paragraph.html);
        i = paragraph.next > i ? paragraph.next : i + 1;
      }
      flushCodeBlock();
      return `<div class="skill-markdown">${blocks.join('')}</div>`;
    }

    function normalizeResourceGroups(rawResources) {
      const empty = { scripts: [], templates: [], references: [], assets: [], examples: [], tools: [], others: [] };
      if (!rawResources || typeof rawResources !== 'object') return empty;
      const groups = { ...empty };
      const normalizeItem = (entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') return { path: entry };
        if (typeof entry !== 'object') return null;
        return {
          name: String(entry.name || '').trim(),
          path: String(entry.path || '').trim(),
          description: String(entry.description || '').trim(),
          command: String(entry.command || '').trim(),
          entry: String(entry.entry || '').trim(),
          content: typeof entry.content === 'string' ? entry.content : '',
          contentType: String(entry.contentType || '').trim(),
          size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : 0
        };
      };
      for (const key of Object.keys(groups)) {
        groups[key] = Array.isArray(rawResources[key]) ? rawResources[key].map(normalizeItem).filter(Boolean) : [];
      }
      return groups;
    }

    function flattenResourceList(resources) {
      const groups = [
        { key: 'scripts', label: '脚本 Scripts' },
        { key: 'templates', label: '模板 Templates' },
        { key: 'references', label: '参考资料 References' },
        { key: 'assets', label: '素材 Assets' },
        { key: 'examples', label: '示例 Examples' },
        { key: 'tools', label: '工具 Tools' },
        { key: 'others', label: '其他 Others' }
      ];
      const out = [];
      for (const group of groups) {
        const list = Array.isArray(resources[group.key]) ? resources[group.key] : [];
        for (const item of list) out.push({ ...item, groupLabel: group.label, groupKey: group.key });
      }
      return out;
    }

    function renderResourceViewer(resource) {
      if (!resource) return '<div class="empty">点击左侧资源查看内容</div>';
      if (!resource.content) return '<div class="empty">该资源暂无可预览文本内容（可能是二进制或未包含内容）</div>';
      const lowerPath = String(resource.path || '').toLowerCase();
      if (lowerPath.endsWith('.md') || String(resource.contentType || '').toLowerCase() === 'text/markdown') return renderMarkdownDocument(resource.content);
      return `<pre class="mono skill-resource-pre">${escapeHtml(resource.content)}</pre>`;
    }

    function renderResourceGroups(structure, skillId) {
      const resources = normalizeResourceGroups((structure && structure.resources) || {});
      const flat = flattenResourceList(resources);
      if (!flat.length) return '<div class="empty">暂无资源声明（脚本/模板/参考等）</div>';
      const selected = selectedResourcePathBySkillId.get(skillId) || (flat[0] && flat[0].path) || '';
      const selectedResource = flat.find((x) => x.path === selected) || flat[0];
      return `
        <div class="skill-resource-layout">
          <div class="skill-resource-list">
            ${flat.map((item) => {
      const isActive = selectedResource && item.path === selectedResource.path;
      return `
                <button type="button" class="skill-resource-item${isActive ? ' active' : ''}" data-skill-resource-path="${escapeHtml(item.path)}">
                  <span class="skill-resource-item-name">${escapeHtml(item.name || item.path || '-')}</span>
                  <span class="skill-resource-item-meta">${escapeHtml(item.groupLabel)} · ${escapeHtml(item.path || '-')}</span>
                </button>
              `;
    }).join('')}
          </div>
          <div class="skill-resource-viewer">
            <div class="skill-resource-viewer-head">${escapeHtml(selectedResource.path || '-')}</div>
            ${renderResourceViewer(selectedResource)}
          </div>
        </div>
      `;
    }

    function renderProposalDetail(proposal = {}) {
      if (!proposal || typeof proposal !== 'object') return '';
      const history = Array.isArray(proposal.history) ? proposal.history : [];
      const evaluation = proposal.evaluation && typeof proposal.evaluation === 'object' ? proposal.evaluation : {};
      const evidence = Array.isArray(evaluation.evidence) ? evaluation.evidence : [];
      const hardGate = evaluation.hardGate && typeof evaluation.hardGate === 'object' ? evaluation.hardGate : {};
      const hardGateReasons = Array.isArray(hardGate.reasons) ? hardGate.reasons : [];
      return `
        <div class="skill-detail-card">
          <h4>提案与审批</h4>
          <div class="skill-detail-meta">
            <div><span>提案人</span><strong>${escapeHtml(proposal.proposedBy || '-')}</strong></div>
            <div><span>提案时间</span><strong>${proposal.proposedAt ? escapeHtml(new Date(proposal.proposedAt).toLocaleString()) : '-'}</strong></div>
            <div><span>决策引擎</span><strong>${escapeHtml(proposal.decisionEngine || '-')}</strong></div>
            <div><span>置信度</span><strong>${Number.isFinite(Number(proposal.confidence)) ? Number(proposal.confidence).toFixed(2) : '-'}</strong></div>
            <div><span>证据条数</span><strong>${evidence.length}</strong></div>
            <div><span>硬门禁</span><strong>${hardGate.passed === false ? '未通过' : '通过'}</strong></div>
          </div>
          ${hardGateReasons.length ? `<div class="toolbar-note">硬门禁原因：${escapeHtml(hardGateReasons.join('；'))}</div>` : ''}
          <div style="margin-top:8px;"><strong>状态流转记录</strong></div>
          ${history.length ? `<ul>${history.map((row) => {
      const from = row.from == null ? '-' : String(row.from);
      const to = row.to == null ? '-' : String(row.to);
      const actor = String(row.actorId || '-');
      const at = row.at ? new Date(row.at).toLocaleString() : '-';
      const note = String(row.note || '').trim();
      return `<li>${escapeHtml(`${from} -> ${to} | ${actor} | ${at}${note ? ` | ${note}` : ''}`)}</li>`;
    }).join('')}</ul>` : '<div class="empty">暂无</div>'}
        </div>
      `;
    }

    function renderRuntimeTruth(detail = {}) {
      const source = String(detail.source || '').toLowerCase();
      if (!source.startsWith('runtime:')) return '';
      const runtimeMeta = detail && detail.runtimeMeta && typeof detail.runtimeMeta === 'object' ? detail.runtimeMeta : {};
      const runtime = runtimeMeta.runtime && typeof runtimeMeta.runtime === 'object' ? runtimeMeta.runtime : {};
      const inference = runtimeMeta.platformInference && typeof runtimeMeta.platformInference === 'object' ? runtimeMeta.platformInference : {};
      const runtimeRows = [['slug', runtime.slug], ['title', runtime.title], ['status', runtime.status], ['type', runtime.type], ['domain', runtime.domain], ['version', runtime.version], ['description', runtime.description]];
      const inferenceRows = [['typeInferred', inference.typeInferred], ['domainInferred', inference.domainInferred], ['versionInferred', inference.versionInferred], ['descriptionInferred', inference.descriptionInferred], ['platformStatus', inference.platformStatus]];
      return `
        <div class="skill-detail-card">
          <h4>运行态真实返回（Runtime Truth）</h4>
          <div class="toolbar-note">以下内容按运行态原样展示；平台推断字段会单独标注。</div>
          <div style="margin-top:8px;"><strong>运行态原始字段</strong></div>
          <ul>${runtimeRows.map(([key, value]) => `<li>${escapeHtml(String(key))}: ${escapeHtml(String(value == null || value === '' ? '(missing)' : value))}</li>`).join('')}</ul>
          <div style="margin-top:8px;"><strong>平台推断字段</strong></div>
          <ul>${inferenceRows.map(([key, value]) => `<li>${escapeHtml(String(key))}: ${escapeHtml(String(value == null || value === '' ? '(missing)' : value))}</li>`).join('')}</ul>
          <details><summary>运行态原始 JSON</summary><pre class="mono skill-detail-pre">${escapeHtml(JSON.stringify(runtime.raw || {}, null, 2))}</pre></details>
        </div>
      `;
    }

    function renderLinkEmployeeSection(detail, linkedEmployees) {
      const employeeCandidates = getEmployeeCandidates();
      const linkedSet = new Set(linkedEmployees.map((item) => String(item.id || '')));
      const candidates = employeeCandidates.filter((item) => !linkedSet.has(String(item.id || '')));
      const optionsHtml = candidates.map((employee) => {
        const label = [employee.name || employee.employeeCode || employee.id, employee.department, employee.role].filter(Boolean).join(' / ');
        return `<option value="${escapeHtml(employee.id || '')}">${escapeHtml(label || employee.id || '-')}</option>`;
      }).join('');
      const selectorHtml = candidates.length
        ? `<select class="admin-select" data-link-employee-select><option value="">请选择数字员工</option>${optionsHtml}</select>`
        : `<div class="empty">${isEmployeeCandidatesLoaded() ? '暂无可关联员工（可能已全部关联）' : `员工列表不可用：${escapeHtml(getEmployeeCandidatesError() || '加载中')}`}</div>`;
      return `
        <div class="skill-detail-card">
          <h4>手动关联数字员工能力</h4>
          <div class="toolbar-note">将当前技能手动关联到指定数字员工。</div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
            ${selectorHtml}
            <button type="button" data-link-employee-btn data-link-skill-id="${escapeHtml(detail.id || '')}" data-required-permission="admin.skills.write" ${candidates.length ? '' : 'disabled'}>关联</button>
          </div>
        </div>
      `;
    }

    async function openDetail(detail, options = {}) {
      const force = Boolean(options.force);
      const body = document.getElementById('skillDrawerBody');
      const title = document.getElementById('skillDrawerTitle');
      if (!body || !title) return;
      const incomingSkillId = String((detail && detail.id) || '');
      const nextDetailDigest = buildDetailDigest(detail);
      if (!force && body && incomingSkillId && incomingSkillId === getCurrentSkillId() && nextDetailDigest === getCurrentDetailDigest()) return;

      const existingRawDetails = document.getElementById('skillRawJsonDetails');
      const existingManagerDetails = document.getElementById('skillManagerDetails');
      const prevSkillId = getCurrentSkillId();
      const prevScrollTop = body.scrollTop;
      if (existingRawDetails && prevSkillId) rawJsonExpandedBySkillId.set(prevSkillId, Boolean(existingRawDetails.open));
      if (existingManagerDetails && prevSkillId) managerInfoExpandedBySkillId.set(prevSkillId, Boolean(existingManagerDetails.open));

      const linkedEmployees = Array.isArray(detail.linkedEmployees) ? detail.linkedEmployees : [];
      const structure = detail && detail.structure && typeof detail.structure === 'object' ? detail.structure : {};
      const linkedEmployeesHtml = linkedEmployees.length
        ? `<ul>${linkedEmployees.map((employee) => `
            <li>
              <strong>${escapeHtml(employee.name || employee.employeeCode || employee.id || '-')}</strong>
              <span class="skill-linked-employee-meta">${escapeHtml([employee.department, employee.role].filter(Boolean).join(' / ') || '未填写部门/角色')}</span>
              ${canUnlinkEmployee() ? `<button type="button" class="btn-link" data-unlink-employee-id="${escapeHtml(employee.id || '')}" data-required-permission="admin.skills.action.unlink-employee">解除关联</button>` : ''}
            </li>
          `).join('')}</ul>`
        : '<div class="empty">暂无关联员工</div>';
      const markdownSource = String(structure.skillMarkdown || '').trim();
      const skillMarkdownHtml = markdownSource ? renderMarkdownDocument(markdownSource) : '<div class="empty">该技能未上传 SKILL.md 全量内容</div>';
      const isRawJsonExpanded = rawJsonExpandedBySkillId.get(incomingSkillId) === true;
      const isManagerInfoExpanded = managerInfoExpandedBySkillId.get(incomingSkillId) === true;
      const proposal = detail && detail.proposal && typeof detail.proposal === 'object' ? detail.proposal : null;
      const hasManagerSection = Boolean(proposal || linkedEmployees.length || canDeleteSkill() || canWriteSkills());

      title.textContent = `技能详情 · ${escapeHtml(detail.name || detail.id || '-')}`;
      body.innerHTML = `
        <div class="skill-detail-meta">
          <div><span>技能名称</span><strong>${escapeHtml(detail.name || '-')}</strong></div>
          <div><span>技能ID</span><strong>${escapeHtml(detail.id || '-')}</strong></div>
          <div><span>状态</span><strong>${escapeHtml(detail.status || '-')}</strong></div>
          <div><span>版本</span><strong>${escapeHtml(detail.version || '-')}</strong></div>
          <div><span>来源</span><strong>${escapeHtml(detail.source || '-')}</strong></div>
        </div>
        <div class="skill-detail-description">${escapeHtml(detail.description || '暂无描述')}</div>
        <div class="skill-detail-card"><h4>SKILL.md（全量）</h4>${skillMarkdownHtml}</div>
        ${renderRuntimeTruth(detail)}
        <div class="skill-detail-card"><h4>资源声明（点击查看）</h4>${renderResourceGroups(structure, incomingSkillId)}</div>
        ${hasManagerSection ? `<details id="skillManagerDetails" class="skill-detail-card" ${isManagerInfoExpanded ? 'open' : ''}>
          <summary>管理信息（可选）</summary>
          ${proposal ? renderProposalDetail(proposal) : ''}
          <div class="skill-detail-card"><h4>关联员工</h4>${linkedEmployeesHtml}</div>
          ${renderLinkEmployeeSection(detail, linkedEmployees)}
          ${canDeleteSkill() ? `<div class="skill-detail-card"><h4>高权限操作</h4><div class="toolbar-note">删除技能前需无关联员工；若存在关联请先点击“解除关联”。</div><div style="display:flex;justify-content:flex-end;margin-top:8px;"><button type="button" class="primary" data-delete-skill-id="${escapeHtml(detail.id || '')}" data-required-permission="admin.skills.action.delete" ${linkedEmployees.length ? 'disabled' : ''}>删除技能</button></div></div>` : ''}
          <details id="skillRawJsonDetails" class="skill-raw-json" ${isRawJsonExpanded ? 'open' : ''}>
            <summary>查看原始 JSON</summary>
            <pre class="mono skill-detail-pre">${escapeHtml(JSON.stringify(detail, null, 2))}</pre>
          </details>
        </details>` : `<details id="skillRawJsonDetails" class="skill-raw-json" ${isRawJsonExpanded ? 'open' : ''}><summary>查看原始 JSON</summary><pre class="mono skill-detail-pre">${escapeHtml(JSON.stringify(detail, null, 2))}</pre></details>`}
      `;
      setCurrentSkillId(incomingSkillId);
      setCurrentDetailDigest(nextDetailDigest);
      body.scrollTop = prevScrollTop;

      const rawJsonDetailsNode = document.getElementById('skillRawJsonDetails');
      if (rawJsonDetailsNode) rawJsonDetailsNode.addEventListener('toggle', () => {
        const id = getCurrentSkillId();
        if (!id) return;
        rawJsonExpandedBySkillId.set(id, Boolean(rawJsonDetailsNode.open));
      });
      const managerDetailsNode = document.getElementById('skillManagerDetails');
      if (managerDetailsNode) managerDetailsNode.addEventListener('toggle', () => {
        const id = getCurrentSkillId();
        if (!id) return;
        managerInfoExpandedBySkillId.set(id, Boolean(managerDetailsNode.open));
      });

      body.querySelectorAll('[data-skill-resource-path]').forEach((node) => {
        node.addEventListener('click', () => {
          const path = node.getAttribute('data-skill-resource-path') || '';
          const id = getCurrentSkillId();
          if (!path || !id) return;
          selectedResourcePathBySkillId.set(id, path);
          openDetail(detail, { force: true });
        });
      });
      body.querySelectorAll('[data-unlink-employee-id]').forEach((node) => {
        node.addEventListener('click', async () => {
          const employeeId = String(node.getAttribute('data-unlink-employee-id') || '').trim();
          const skillId = getCurrentSkillId();
          if (!employeeId || !skillId) return;
          const skillLabel = String(detail.name || skillId).trim() || skillId;
          const employeeLabelNode = node.closest('li') && node.closest('li').querySelector('strong');
          const employeeLabel = String(employeeLabelNode ? employeeLabelNode.textContent : employeeId).trim() || employeeId;
          if (!window.confirm(`确认解除技能 ${skillLabel} 与员工 ${employeeLabel} 的关联吗？`)) return;
          if (String(window.prompt(`请输入员工ID进行二次确认：${employeeId}`, '') || '').trim() !== employeeId) {
            renderStatus('二次确认未通过，已取消解除关联', true);
            return;
          }
          try {
            await api(`/api/admin/skills/${encodeURIComponent(skillId)}/unlink`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId }) });
            renderStatus('已解除关联员工');
            await load();
            const refreshed = await fetchSkillDetail(skillId);
            openDetail(refreshed, { force: true });
          } catch (error) {
            renderStatus(`解除关联失败：${error.message}`, true);
          }
        });
      });

      const linkBtn = body.querySelector('[data-link-employee-btn]');
      if (linkBtn) linkBtn.addEventListener('click', async () => {
        const skillId = String(linkBtn.getAttribute('data-link-skill-id') || '').trim();
        const select = body.querySelector('[data-link-employee-select]');
        const employeeId = String(select && select.value ? select.value : '').trim();
        if (!skillId || !employeeId) {
          renderStatus('请先选择要关联的数字员工', true);
          return;
        }
        try {
          await api(`/api/admin/skills/${encodeURIComponent(skillId)}/link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId }) });
          renderStatus('已手动关联数字员工能力');
          await loadEmployeeCandidates();
          await load();
          const refreshed = await fetchSkillDetail(skillId);
          openDetail(refreshed, { force: true });
        } catch (error) {
          renderStatus(`手动关联失败：${error.message}`, true);
        }
      });

      const deleteBtn = body.querySelector('[data-delete-skill-id]');
      if (deleteBtn) deleteBtn.addEventListener('click', async () => {
        const skillName = String(detail.name || '').trim();
        const skillId = String(detail.id || '').trim();
        if (!skillId) return;
        if (!window.confirm(`确认删除技能 ${skillName || skillId} 吗？此操作不可恢复。`)) return;
        if (String(window.prompt(`请输入技能名称进行二次确认：${skillName}`, '') || '').trim() !== skillName) {
          renderStatus('二次确认未通过，已取消删除', true);
          return;
        }
        try {
          await api(`/api/admin/skills/${encodeURIComponent(skillId)}`, { method: 'DELETE' });
          renderStatus(`技能 ${skillName || skillId} 已删除`);
          setDrawerVisibility(false);
          setCurrentSkillId('');
          await load();
        } catch (error) {
          renderStatus(`删除失败：${error.message}`, true);
        }
      });
      applyActionAcl(body);
      setDrawerVisibility(true);
    }

    return { openDetail };
  }

  global.__adminSkillDetailRenderer = { createSkillDetailRenderer };
}(window));
