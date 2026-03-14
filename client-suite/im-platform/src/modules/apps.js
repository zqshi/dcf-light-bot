/**
 * Lite Apps — 轻应用面板，支持 Dock 自定义
 */
import { bus, Events } from '../lib/events.js';
import { $ } from '../lib/utils.js';

const PRESET_APPS = [
  { id: 'calendar', name: '日程', icon: 'calendar_month', color: '#007AFF', url: '' },
  { id: 'docs', name: '文档协作', icon: 'description', color: '#34C759', url: '' },
  { id: 'kanban', name: '看板', icon: 'view_column', color: '#AF52DE', url: '' },
  { id: 'mindmap', name: '脑图', icon: 'account_tree', color: '#FF9500', url: '' },
  { id: 'whiteboard', name: '白板', icon: 'draw', color: '#FF2D55', url: '' },
  { id: 'code-review', name: '代码审查', icon: 'rate_review', color: '#5856D6', url: '' },
  { id: 'monitor', name: '监控大盘', icon: 'monitoring', color: '#FF3B30', url: '' },
  { id: 'approval', name: '审批流', icon: 'approval', color: '#30D158', url: '' },
  { id: 'knowledge', name: '知识库', icon: 'menu_book', color: '#FF9500', url: '' },
  { id: 'skills', name: '技能商店', icon: 'extension', color: '#AF52DE', url: '' },
  { id: 'api-test', name: 'API 调试', icon: 'science', color: '#32ADE6', url: '' },
  { id: 'settings', name: '工作台设置', icon: 'tune', color: '#8E8E93', url: '' },
];

export function initApps() {
  bus.on(Events.DOCK_SWITCH, (tab) => {
    if (tab === 'apps') renderApps();
  });
  renderApps();
}

function renderApps() {
  renderGrid('#apps-grid');
  renderGrid('#apps-workspace-grid');
}

function renderGrid(selector) {
  const grid = $(selector);
  if (!grid) return;

  grid.innerHTML = PRESET_APPS.map(app => `
    <div class="lite-app-item" data-app-id="${app.id}" title="${app.name}">
      <div class="lite-app-icon" style="background:${app.color}15;color:${app.color}">
        <span class="material-symbols-outlined">${app.icon}</span>
      </div>
      <div class="lite-app-name">${app.name}</div>
    </div>
  `).join('');

  // Click handler
  grid.querySelectorAll('.lite-app-item').forEach(item => {
    item.addEventListener('click', () => {
      const appId = item.dataset.appId;
      const app = PRESET_APPS.find(a => a.id === appId);
      if (app) {
        bus.emit(Events.TOAST, { message: `${app.name} - 轻应用即将上线`, type: 'info' });
      }
    });
  });
}
