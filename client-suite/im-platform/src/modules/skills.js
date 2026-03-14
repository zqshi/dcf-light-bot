/**
 * Skills Center — 技能中心
 * 支持数字员工的技能管理、共享、按岗位关联
 */
import { bus, Events } from '../lib/events.js';
import { getState, setState } from '../lib/store.js';
import { $, escHtml, loadFromStorage } from '../lib/utils.js';

const PRESET_SKILLS = [
  { id: 'sk-code-review', name: '代码审查', desc: '自动检测代码质量问题，提供重构建议和安全漏洞扫描', category: 'general', icon: '🔍', roles: ['开发工程师', '架构师'], usage: 234, author: '系统内置', source: 'builtin' },
  { id: 'sk-unit-test', name: '单元测试生成', desc: '基于源代码自动生成单元测试用例，支持多种测试框架', category: 'general', icon: '🧪', roles: ['开发工程师', '测试工程师'], usage: 189, author: '系统内置', source: 'builtin' },
  { id: 'sk-api-doc', name: 'API 文档生成', desc: '从代码注释和路由定义自动生成 OpenAPI/Swagger 文档', category: 'domain', icon: '📖', roles: ['开发工程师', '技术文档工程师'], usage: 156, author: '系统内置', source: 'builtin' },
  { id: 'sk-prd-write', name: 'PRD 撰写', desc: '根据需求描述生成结构化产品需求文档，含功能列表和验收标准', category: 'domain', icon: '📋', roles: ['产品经理'], usage: 142, author: '系统内置', source: 'builtin' },
  { id: 'sk-data-analysis', name: '数据分析报告', desc: '自动分析数据集，生成可视化报告和关键指标解读', category: 'domain', icon: '📊', roles: ['数据分析师', '产品经理'], usage: 98, author: '系统内置', source: 'builtin' },
  { id: 'sk-i18n', name: '国际化翻译', desc: '自动提取文案并翻译为多语言版本，保持术语一致性', category: 'general', icon: '🌍', roles: ['开发工程师', '翻译专员'], usage: 87, author: '系统内置', source: 'builtin' },
  { id: 'sk-ui-prototype', name: 'UI 原型生成', desc: '根据描述生成交互式 UI 原型，支持 HTML/CSS 输出', category: 'domain', icon: '🎨', roles: ['设计师', '产品经理', '前端工程师'], usage: 76, author: '系统内置', source: 'builtin' },
  { id: 'sk-deploy', name: '部署配置生成', desc: '生成 Dockerfile、K8s manifest、CI/CD pipeline 配置', category: 'domain', icon: '🚀', roles: ['运维工程师', '开发工程师'], usage: 65, author: '系统内置', source: 'builtin' },
  { id: 'sk-security-scan', name: '安全审计', desc: '代码安全扫描，检测 OWASP Top 10 漏洞和依赖风险', category: 'general', icon: '🔒', roles: ['安全工程师', '开发工程师'], usage: 54, author: '系统内置', source: 'builtin' },
  { id: 'sk-meeting-summary', name: '会议纪要', desc: '从会议记录中提取关键决议、Action Item 和待确认事项', category: 'general', icon: '📝', roles: ['全员'], usage: 201, author: '系统内置', source: 'builtin' },
  { id: 'sk-git-commit', name: 'Git 提交规范', desc: '自动生成符合 Conventional Commits 规范的提交信息', category: 'general', icon: '📦', roles: ['开发工程师'], usage: 167, author: '小码 (Agent)', source: 'agent-created' },
  { id: 'sk-sql-gen', name: 'SQL 生成器', desc: '根据自然语言描述生成 SQL 查询，支持多种数据库方言', category: 'domain', icon: '🗃️', roles: ['数据分析师', '后端工程师'], usage: 89, author: '小码 (Agent)', source: 'agent-created' },
];

let currentFilter = 'all';

export function initSkills() {
  // Load persisted skills
  const persisted = loadPersistedSkills();
  const allSkills = [...PRESET_SKILLS, ...persisted];
  setState({ skills: allSkills });

  bus.on(Events.DOCK_SWITCH, (tab) => {
    if (tab === 'skills') {
      renderSkillsHall();
      renderSkillsSidebar();
    }
  });

  // Search
  document.addEventListener('input', (e) => {
    if (e.target.id === 'skills-search') {
      const term = e.target.value;
      renderSkillsSidebar(term);
      renderSkillsHall(term);
    }
  });

  // Filter tabs in sidebar
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('#skills-list-panel .sidebar-tab');
    if (!tab) return;
    currentFilter = tab.dataset.filter || 'all';
    document.querySelectorAll('#skills-list-panel .sidebar-tab').forEach(t =>
      t.classList.toggle('tab-active', t === tab));
    renderSkillsSidebar();
    renderSkillsHall();
  });

  renderSkillsSidebar();
}

function filterSkills(search) {
  const term = (search || '').toLowerCase();
  const skills = getState().skills || PRESET_SKILLS;
  return skills.filter(s => {
    if (currentFilter !== 'all' && s.category !== currentFilter) return false;
    if (term && !s.name.toLowerCase().includes(term) && !s.desc.toLowerCase().includes(term)) return false;
    return true;
  });
}

function renderSkillsHall(search) {
  const grid = $('#skills-hall-grid');
  if (!grid) return;

  const skills = filterSkills(search);
  grid.innerHTML = skills.map(s => `
    <div class="agent-hall-card" data-skill-id="${s.id}">
      <div class="agent-hall-avatar" style="background:${getCategoryBg(s.category)};font-size:24px">${s.icon}</div>
      <div class="agent-hall-name">${escHtml(s.name)}</div>
      <div class="agent-hall-desc">${escHtml(s.desc)}</div>
      <div class="agent-hall-tags">
        <span class="agent-hall-tag" style="background:${s.category === 'general' ? '#DBEAFE' : '#FEF3C7'};color:${s.category === 'general' ? '#007AFF' : '#92400E'}">${s.category === 'general' ? '通用技能' : '领域技能'}</span>
        ${s.roles.slice(0, 2).map(r => `<span class="agent-hall-tag">${escHtml(r)}</span>`).join('')}
        ${s.source === 'agent-created' ? '<span class="agent-hall-tag" style="background:#F0FDF4;color:#166534">Agent创建</span>' : ''}
      </div>
      <div class="agent-hall-stats">
        <span><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">download</span>${s.usage} 次使用</span>
        <span><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">person</span>${escHtml(s.author)}</span>
      </div>
    </div>
  `).join('');
}

function renderSkillsSidebar(search) {
  const list = $('#skills-sidebar-list');
  if (!list) return;

  const skills = filterSkills(search);
  list.innerHTML = skills.map(s => `
    <div class="conv-item" data-skill-id="${s.id}" style="cursor:pointer">
      <div class="conv-avatar" style="background:${getCategoryBg(s.category)};font-size:16px;border-radius:var(--radius-md)">${s.icon}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(s.name)}</div>
        <div class="conv-preview">${escHtml(s.desc)}</div>
      </div>
      <div class="conv-meta">
        <span style="font-size:10px;color:var(--text-muted)">${s.usage}次</span>
      </div>
    </div>
  `).join('');
}

function getCategoryBg(cat) {
  return cat === 'general'
    ? 'linear-gradient(135deg,#60A5FA,#3B82F6)'
    : 'linear-gradient(135deg,#FBBF24,#F59E0B)';
}

function loadPersistedSkills() {
  return loadFromStorage('dcf_skills', []);
}
