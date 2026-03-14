/**
 * Digital Factory — 数字员工创建流程
 * 通过"数字工厂"Bot对话创建数字员工，支持引导式配置
 */
import { bus, Events } from '../lib/events.js';
import { getState, setState } from '../lib/store.js';
import { sendMessage, createDmRoom, getClient } from '../lib/matrix.js';
import { $, escHtml, loadFromStorage } from '../lib/utils.js';

const MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', desc: '最强推理能力' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: '多模态通用' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', desc: '深度推理' },
];

const PERSONALITIES = [
  { id: 'professional', name: '专业严谨', icon: '🎯' },
  { id: 'friendly', name: '友善亲和', icon: '😊' },
  { id: 'creative', name: '创意发散', icon: '🎨' },
  { id: 'analytical', name: '分析导向', icon: '📊' },
];

let wizardState = { step: 0, data: {} };

export function initFactory() {
  bus.on(Events.DOCK_SWITCH, (tab) => {
    if (tab === 'factory') renderFactoryWorkspace();
  });

  // Factory agent list click
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.factory-agent-item');
    if (item) {
      const agentId = item.dataset.agentId;
      if (agentId === 'new') startWizard();
    }
  });

  renderFactoryList();
}

function renderFactoryList() {
  const list = $('#factory-agent-list');
  if (!list) return;

  const { createdAgents } = getState();

  list.innerHTML = `
    <div class="conv-item factory-agent-item" data-agent-id="new" style="border:1.5px dashed var(--border-color);border-radius:var(--radius-md);margin-bottom:8px;justify-content:center">
      <div style="text-align:center">
        <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary-light);margin-bottom:4px;display:block">add</span>
        <div style="font-size:13px;font-weight:500;color:var(--primary-color)">创建数字员工</div>
      </div>
    </div>
    ${createdAgents.map(a => `
      <div class="conv-item factory-agent-item" data-agent-id="${a.id}">
        <div class="conv-avatar agent">
          <span class="material-symbols-outlined">smart_toy</span>
          <span class="status-dot ${a.status || 'online'}"></span>
        </div>
        <div class="conv-info">
          <div class="conv-name">${escHtml(a.name)}</div>
          <div class="conv-preview">${escHtml(a.role)} · ${escHtml(a.model)}</div>
        </div>
      </div>
    `).join('')}
  `;
}

function renderFactoryWorkspace() {
  const workspace = $('#factory-workspace-content');
  if (!workspace) return;

  const { createdAgents } = getState();

  if (createdAgents.length === 0 && wizardState.step === 0) {
    workspace.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><span class="material-symbols-outlined">precision_manufacturing</span></div>
        <div class="empty-state-title">数字员工工厂</div>
        <div class="empty-state-desc">
          通过自然语言描述创建你的专属数字员工，<br>
          赋予他们独特的人设、技能和工作方式
        </div>
        <button class="factory-btn factory-btn-primary" style="margin-top:20px" id="factory-start-btn">
          <span class="material-symbols-outlined" style="font-size:18px;margin-right:6px">auto_awesome</span>开始创建
        </button>
      </div>
    `;
    workspace.querySelector('#factory-start-btn')?.addEventListener('click', startWizard);
  } else if (wizardState.step > 0) {
    renderWizardStep(workspace);
  } else {
    workspace.innerHTML = `
      <div style="padding:20px 24px;border-bottom:1px solid var(--border-color);background:var(--bg-white);display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2 style="font-size:18px;font-weight:700">我的数字员工</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">管理和配置已创建的数字员工</p>
        </div>
        <button class="factory-btn factory-btn-primary" id="factory-new-btn">
          <span class="material-symbols-outlined" style="font-size:18px;margin-right:4px">auto_awesome</span>创建新员工
        </button>
      </div>
      <div class="agents-grid">
        ${createdAgents.map(a => `
          <div class="agent-hall-card">
            <div class="agent-hall-avatar" style="background:linear-gradient(135deg,#818CF8,#6366F1);color:white">
              <span class="material-symbols-outlined">smart_toy</span>
            </div>
            <div class="agent-hall-name">${escHtml(a.name)}</div>
            <div class="agent-hall-desc">${escHtml(a.persona || '未设置人设')}</div>
            <div class="agent-hall-tags">
              <span class="agent-hall-tag">${escHtml(a.role)}</span>
              <span class="agent-hall-tag">${escHtml(a.model)}</span>
              <span class="agent-hall-tag">${escHtml(a.personality)}</span>
            </div>
            <div class="agent-hall-stats">
              <span><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">check_circle</span>ID: ${a.id}</span>
              <span><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">schedule</span>${formatDate(a.createdAt)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    workspace.querySelector('#factory-new-btn')?.addEventListener('click', startWizard);
  }
}

function startWizard() {
  const { user } = getState();
  wizardState = {
    step: 1,
    data: {
      name: '',
      role: user?.role || '通用助手',
      persona: '',
      personality: 'professional',
      model: 'claude-sonnet-4-6',
      department: user?.department || '',
    }
  };
  renderFactoryWorkspace();
}

function renderWizardStep(container) {
  const { step, data } = wizardState;
  const totalSteps = 4;

  const progressHtml = Array.from({ length: totalSteps }, (_, i) => {
    const cls = i + 1 < step ? 'done' : i + 1 === step ? 'active' : '';
    return `<div class="factory-progress-step ${cls}"></div>`;
  }).join('');

  let stepContent = '';

  switch (step) {
    case 1: // 基本信息
      stepContent = `
        <div class="factory-step-title">基本信息</div>
        <div class="factory-step-desc">为你的数字员工设定基本身份</div>
        <div class="factory-field">
          <label>姓名</label>
          <input type="text" id="wiz-name" placeholder="给数字员工起个名字" value="${escHtml(data.name)}" />
        </div>
        <div class="factory-field">
          <label>岗位/角色</label>
          <input type="text" id="wiz-role" placeholder="如：前端开发工程师、产品经理" value="${escHtml(data.role)}" />
        </div>
        <div class="factory-field">
          <label>所属部门</label>
          <input type="text" id="wiz-dept" placeholder="继承创建者部门或自定义" value="${escHtml(data.department)}" />
        </div>
      `;
      break;
    case 2: // 人设与性格
      stepContent = `
        <div class="factory-step-title">人设与性格</div>
        <div class="factory-step-desc">定义数字员工的工作方式和沟通风格</div>
        <div class="factory-field">
          <label>人设描述</label>
          <textarea id="wiz-persona" placeholder="描述数字员工的角色定位和专业领域...">${escHtml(data.persona)}</textarea>
        </div>
        <div class="factory-field">
          <label>性格类型</label>
          <div class="factory-model-grid">
            ${PERSONALITIES.map(p => `
              <div class="factory-model-option ${data.personality === p.id ? 'selected' : ''}" data-personality="${p.id}">
                <div style="font-size:24px;margin-bottom:4px">${p.icon}</div>
                <div class="factory-model-name">${p.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      break;
    case 3: // 模型选择
      stepContent = `
        <div class="factory-step-title">运行模型</div>
        <div class="factory-step-desc">选择数字员工的底层大模型（后续可随时更换）</div>
        <div class="factory-model-grid">
          ${MODELS.map(m => `
            <div class="factory-model-option ${data.model === m.id ? 'selected' : ''}" data-model="${m.id}">
              <div class="factory-model-name">${m.name}</div>
              <div class="factory-model-desc">${m.desc}</div>
            </div>
          `).join('')}
        </div>
      `;
      break;
    case 4: // 确认
      stepContent = `
        <div class="factory-step-title">确认创建</div>
        <div class="factory-step-desc">请确认数字员工配置信息</div>
        <div style="background:var(--bg-light);border-radius:var(--radius-md);padding:20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
            <div style="width:56px;height:56px;border-radius:var(--radius-md);background:linear-gradient(135deg,#818CF8,#6366F1);color:white;display:flex;align-items:center;justify-content:center;font-size:24px">
              <span class="material-symbols-outlined">smart_toy</span>
            </div>
            <div>
              <div style="font-size:18px;font-weight:700">${escHtml(data.name || '未命名')}</div>
              <div style="font-size:13px;color:var(--text-secondary)">${escHtml(data.role)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
            <div><span style="color:var(--text-muted)">部门:</span> ${escHtml(data.department)}</div>
            <div><span style="color:var(--text-muted)">性格:</span> ${PERSONALITIES.find(p => p.id === data.personality)?.name || data.personality}</div>
            <div><span style="color:var(--text-muted)">模型:</span> ${MODELS.find(m => m.id === data.model)?.name || data.model}</div>
            <div><span style="color:var(--text-muted)">创建者:</span> ${escHtml(getState().user?.displayName || '')}</div>
          </div>
          ${data.persona ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color)"><span style="color:var(--text-muted);font-size:12px">人设:</span><div style="font-size:13px;margin-top:4px;line-height:1.5">${escHtml(data.persona)}</div></div>` : ''}
        </div>
      `;
      break;
  }

  container.innerHTML = `
    <div class="factory-wizard fade-in">
      <div class="factory-progress">${progressHtml}</div>
      <div class="factory-step active">${stepContent}</div>
      <div class="factory-actions">
        ${step > 1 ? '<button class="factory-btn factory-btn-secondary" id="wiz-prev">上一步</button>' : ''}
        ${step < totalSteps
          ? '<button class="factory-btn factory-btn-primary" id="wiz-next">下一步</button>'
          : '<button class="factory-btn factory-btn-primary" id="wiz-create"><span class="material-symbols-outlined" style="font-size:18px;margin-right:4px">auto_awesome</span>创建数字员工</button>'}
      </div>
    </div>
  `;

  // Bind events
  container.querySelector('#wiz-prev')?.addEventListener('click', () => { collectStepData(); wizardState.step--; renderFactoryWorkspace(); });
  container.querySelector('#wiz-next')?.addEventListener('click', () => { collectStepData(); wizardState.step++; renderFactoryWorkspace(); });
  container.querySelector('#wiz-create')?.addEventListener('click', createAgent);

  // Model selection
  container.querySelectorAll('[data-model]').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('[data-model]').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      wizardState.data.model = el.dataset.model;
    });
  });

  // Personality selection
  container.querySelectorAll('[data-personality]').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('[data-personality]').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      wizardState.data.personality = el.dataset.personality;
    });
  });
}

function collectStepData() {
  const d = wizardState.data;
  const v = (id) => document.querySelector(id)?.value?.trim() || '';
  switch (wizardState.step) {
    case 1: d.name = v('#wiz-name'); d.role = v('#wiz-role'); d.department = v('#wiz-dept'); break;
    case 2: d.persona = v('#wiz-persona'); break;
  }
}

async function createAgent() {
  const { data } = wizardState;
  if (!data.name) {
    bus.emit(Events.TOAST, { message: '请输入数字员工姓名', type: 'error' });
    return;
  }

  const agentId = `agent-${Date.now().toString(36)}`;
  const agent = {
    id: agentId,
    name: data.name,
    role: data.role,
    persona: data.persona,
    personality: data.personality,
    model: data.model,
    department: data.department,
    status: 'online',
    createdAt: Date.now(),
    createdBy: getState().user?.userId,
    email: `${agentId}@dcf.local`,
    employeeId: `DE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };

  // Add to state
  const agents = [...getState().createdAgents, agent];
  setState({ createdAgents: agents });
  localStorage.setItem('dcf_agents', JSON.stringify(agents));

  // Reset wizard
  wizardState = { step: 0, data: {} };

  bus.emit(Events.AGENT_CREATED, agent);
  bus.emit(Events.TOAST, { message: `数字员工 "${agent.name}" 创建成功！`, type: 'success' });

  // Try to send factory bot message about creation
  try {
    const client = getClient();
    if (client) {
      // Look for factory bot room or create one
      const rooms = getState().rooms;
      let factoryRoom = rooms.find(r => r.name.includes('数字工厂') || r.dmUserId?.includes('factory'));
      if (!factoryRoom) {
        // Try creating DM with factory bot
        try {
          const roomId = await createDmRoom('@dcf-factory-bot:localhost');
          if (roomId) {
            await sendMessage(roomId, `创建数字员工: ${agent.name}, 岗位: ${agent.role}, 模型: ${agent.model}`);
          }
        } catch { /* factory bot may not exist */ }
      }
    }
  } catch { /* non-critical */ }

  renderFactoryWorkspace();
  renderFactoryList();
}

// Load persisted agents on init
export function loadPersistedAgents() {
  const agents = loadFromStorage('dcf_agents', null);
  if (agents) setState({ createdAgents: agents });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// escHtml 已从 lib/utils.js 统一导入
