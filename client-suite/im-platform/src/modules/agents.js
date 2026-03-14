/**
 * Shared Agents Hall — 共享 Agent 大厅
 * 数字员工创建的子 Agent 进入共享区域，避免重复创建
 */
import { bus, Events } from '../lib/events.js';
import { getState, setState } from '../lib/store.js';
import { createDmRoom, selectRoom } from '../lib/matrix.js';
import { isDemoMode, demoSelectRoom } from '../lib/mock-matrix.js';
import { $, escHtml, loadFromStorage, saveToStorage } from '../lib/utils.js';

// 预置共享 Agent 示例
const PRESET_AGENTS = [
  {
    id: 'shared-coder', name: '代码助手', desc: '精通多种编程语言，支持代码生成、审查、重构和调试',
    tags: ['编程', '代码审查', '调试'], icon: '💻', usage: 128, creator: '系统预置',
    category: 'development'
  },
  {
    id: 'shared-writer', name: '文档写手', desc: '专业技术文档、PRD、API文档撰写与优化',
    tags: ['文档', 'PRD', '写作'], icon: '📝', usage: 96, creator: '系统预置',
    category: 'content'
  },
  {
    id: 'shared-analyst', name: '数据分析师', desc: '数据清洗、统计分析、可视化报表生成',
    tags: ['数据分析', '报表', '可视化'], icon: '📊', usage: 74, creator: '系统预置',
    category: 'analysis'
  },
  {
    id: 'shared-designer', name: '原型设计师', desc: '快速生成 UI 原型、交互设计方案和设计规范',
    tags: ['UI设计', '原型', '交互'], icon: '🎨', usage: 62, creator: '系统预置',
    category: 'design'
  },
  {
    id: 'shared-tester', name: '测试工程师', desc: '自动化测试用例生成、测试报告和覆盖率分析',
    tags: ['测试', '自动化', '质量'], icon: '🧪', usage: 45, creator: '系统预置',
    category: 'quality'
  },
  {
    id: 'shared-ops', name: '运维助手', desc: 'K8s 集群管理、CI/CD 流水线、监控告警配置',
    tags: ['运维', 'K8s', 'CI/CD'], icon: '⚙️', usage: 38, creator: '系统预置',
    category: 'operations'
  },
  {
    id: 'shared-translator', name: '翻译专员', desc: '多语言翻译和国际化(i18n)支持，保持语境和专业术语准确',
    tags: ['翻译', 'i18n', '多语言'], icon: '🌍', usage: 51, creator: '系统预置',
    category: 'content'
  },
  {
    id: 'shared-security', name: '安全审计员', desc: '代码安全审计、漏洞扫描、合规检查和安全加固建议',
    tags: ['安全', '审计', '合规'], icon: '🔒', usage: 29, creator: '系统预置',
    category: 'security'
  },
];

export function initAgents() {
  // Initialize shared agents
  const persisted = loadPersistedSharedAgents();
  setState({ sharedAgents: [...PRESET_AGENTS, ...persisted] });

  // Render on dock switch
  bus.on(Events.DOCK_SWITCH, (tab) => {
    if (tab === 'agents') renderAgentsHall();
  });

  // When new agent is created, add to shared pool
  bus.on(Events.AGENT_CREATED, (agent) => {
    const shared = {
      id: agent.id,
      name: agent.name,
      desc: agent.persona || `${agent.role} - ${agent.personality}`,
      tags: [agent.role, agent.model, agent.personality].filter(Boolean),
      icon: '🤖',
      usage: 0,
      creator: getState().user?.displayName || '未知',
      category: 'custom',
    };
    const agents = [...getState().sharedAgents, shared];
    setState({ sharedAgents: agents });
    persistSharedAgents(agents.filter(a => !PRESET_AGENTS.find(p => p.id === a.id)));
  });

  // Agent card click from chat
  bus.on(Events.AGENT_CARD_CLICK, async (agentData) => {
    bus.emit(Events.TOAST, { message: `正在与 ${agentData.name} 建立连接...`, type: 'info' });
    if (isDemoMode()) {
      // Find existing room matching the agent
      const rooms = getState().rooms;
      const match = rooms.find(r => r.dmUserId?.includes(agentData.id) || r.name.includes(agentData.name));
      if (match) {
        demoSelectRoom(match.roomId);
        // Switch to messages dock
        const dockBtn = document.querySelector('[data-dock-tab="messages"]');
        if (dockBtn) dockBtn.click();
      } else {
        bus.emit(Events.TOAST, { message: `已记录 ${agentData.name}，在消息列表中查看`, type: 'success' });
      }
    } else {
      try {
        const agentUserId = `@${agentData.id || 'agent'}:localhost`;
        const roomId = await createDmRoom(agentUserId);
        if (roomId) await selectRoom(roomId);
      } catch { /* agent user may not exist on homeserver */ }
    }
  });

  // Search
  document.addEventListener('input', (e) => {
    if (e.target.id === 'agent-search') {
      renderAgentsSidebar(e.target.value);
      renderAgentsHall(e.target.value);
    }
  });

  // Hall card click
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.agent-hall-card');
    if (!card) return;
    const agentId = card.dataset.agentId;
    if (agentId) invokeSharedAgent(agentId);
  });

  renderAgentsSidebar();
}

function renderAgentsHall(search = '') {
  const grid = $('#agents-hall-grid');
  if (!grid) return;

  const agents = filterAgents(search);
  grid.innerHTML = agents.map(a => `
    <div class="agent-hall-card" data-agent-id="${a.id}">
      <div class="agent-hall-avatar" style="background:${getAvatarBg(a.category)};font-size:24px">
        ${a.icon}
      </div>
      <div class="agent-hall-name">${escHtml(a.name)}</div>
      <div class="agent-hall-desc">${escHtml(a.desc)}</div>
      <div class="agent-hall-tags">
        ${a.tags.map(t => `<span class="agent-hall-tag">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="agent-hall-stats">
        <span><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">open_in_new</span>${a.usage} 次调用</span>
      </div>
      <div class="agent-hall-creator">
        <span class="material-symbols-outlined" style="font-size:14px">person</span> ${escHtml(a.creator)}
      </div>
    </div>
  `).join('');
}

function renderAgentsSidebar(search = '') {
  const list = $('#agents-sidebar-list');
  if (!list) return;

  const agents = filterAgents(search);
  list.innerHTML = agents.map(a => `
    <div class="conv-item" data-agent-id="${a.id}" style="cursor:pointer">
      <div class="conv-avatar agent" style="background:${getAvatarBg(a.category)};font-size:16px">
        ${a.icon}
      </div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(a.name)}</div>
        <div class="conv-preview">${escHtml(a.desc)}</div>
      </div>
      <div class="conv-meta">
        <span style="font-size:10px;color:var(--text-muted)">${a.usage}次</span>
      </div>
    </div>
  `).join('');
}

function filterAgents(search) {
  const term = (search || '').toLowerCase();
  return getState().sharedAgents.filter(a => {
    if (!term) return true;
    return a.name.toLowerCase().includes(term) ||
           a.desc.toLowerCase().includes(term) ||
           a.tags.some(t => t.toLowerCase().includes(term));
  });
}

function invokeSharedAgent(agentId) {
  const agent = getState().sharedAgents.find(a => a.id === agentId);
  if (!agent) return;

  bus.emit(Events.TOAST, { message: `正在调用共享 Agent: ${agent.name}`, type: 'info' });

  // Increment usage
  agent.usage = (agent.usage || 0) + 1;
  setState({ sharedAgents: [...getState().sharedAgents] });

  bus.emit(Events.SHARED_AGENT_INVOKE, agent);
}

function getAvatarBg(category) {
  const map = {
    development: 'linear-gradient(135deg,#818CF8,#6366F1)',
    content: 'linear-gradient(135deg,#34D399,#10B981)',
    analysis: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
    design: 'linear-gradient(135deg,#F472B6,#EC4899)',
    quality: 'linear-gradient(135deg,#60A5FA,#3B82F6)',
    operations: 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
    security: 'linear-gradient(135deg,#F87171,#EF4444)',
    custom: 'linear-gradient(135deg,#94A3B8,#64748B)',
  };
  return map[category] || map.custom;
}

function loadPersistedSharedAgents() {
  return loadFromStorage('dcf_shared_agents', []);
}

function persistSharedAgents(agents) {
  saveToStorage('dcf_shared_agents', agents);
}

// escHtml 已从 lib/utils.js 统一导入
