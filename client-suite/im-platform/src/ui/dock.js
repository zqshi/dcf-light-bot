/**
 * Dock Navigation — 左侧 64px 图标导航栏
 */
import { bus, Events } from '../lib/events.js';
import { getState, setState } from '../lib/store.js';
import { switchSidebarTab, setFullWidthMode } from './layout.js';
import { $$  } from '../lib/utils.js';

export function initDock() {
  $$('.dock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.dockTab;
      if (tab) switchDock(tab);
    });
  });

  // submenu items
  $$('.dock-submenu-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const subtab = btn.dataset.subtab;
      if (subtab) handleSubtab(subtab);
    });
  });

  // activate default
  switchDock('messages');
}

export function switchDock(tab) {
  setState({ currentDock: tab });

  // Update active state
  $$('.dock-btn').forEach(btn => {
    btn.classList.toggle('dock-active', btn.dataset.dockTab === tab);
  });

  // Switch workspace content
  $$('.workspace-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `workspace-${tab}`);
  });

  // Sidebar behavior per dock tab
  switch (tab) {
    case 'messages':
      setFullWidthMode(false);
      switchSidebarTab('conversations');
      break;
    case 'agents':
      setFullWidthMode(false);
      switchSidebarTab('agents-list');
      break;
    case 'apps':
      setFullWidthMode(false);
      switchSidebarTab('apps-list');
      break;
    case 'skills':
      setFullWidthMode(false);
      switchSidebarTab('skills-list');
      break;
    case 'factory':
      setFullWidthMode(false);
      switchSidebarTab('factory-list');
      break;
    case 'settings':
      setFullWidthMode(false);
      switchSidebarTab('settings');
      break;
  }

  bus.emit(Events.DOCK_SWITCH, tab);
}

function handleSubtab(subtab) {
  switch (subtab) {
    case 'conversations':
      switchDock('messages');
      switchSidebarTab('conversations');
      break;
    case 'factory-create':
      switchDock('factory');
      break;
  }
}
