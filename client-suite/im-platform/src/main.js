/**
 * DCF 数字员工协作平台 — 主入口
 */
import './styles/app.css';
import { bus, Events } from './lib/events.js';
import { getState, setState, loadAuth, clearAuth } from './lib/store.js';
import { initClient, logout } from './lib/matrix.js';
import { isDemoMode, demoLogin } from './lib/mock-matrix.js';
import { renderLoginPage } from './pages/login.js';
import { renderWorkspace } from './pages/workspace.js';
import { initLayout } from './ui/layout.js';
import { initDock } from './ui/dock.js';
import { initDrawerPanels } from './ui/drawer.js';
import { initChat } from './modules/chat.js';
import { initFactory, loadPersistedAgents } from './modules/factory.js';
import { initAgents } from './modules/agents.js';
import { initApps } from './modules/apps.js';
import { initSkills } from './modules/skills.js';
import { escHtml } from './lib/utils.js';

const app = document.getElementById('app');

async function bootstrap() {
  // Check for SSO redirect callback
  const params = new URLSearchParams(window.location.search);
  if (params.has('loginToken')) {
    // Handle SSO callback — would exchange loginToken for access_token via Matrix API
    // For now, redirect to login page
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Check persisted auth
  const auth = loadAuth();
  if (auth?.accessToken) {
    setState({ user: auth.user, accessToken: auth.accessToken, homeserverUrl: auth.homeserverUrl });
    showWorkspace();
    if (auth.accessToken === 'demo-token') {
      // Restore demo session
      await demoLogin();
    } else {
      try {
        await initClient(auth.homeserverUrl, auth.accessToken, auth.user.userId);
      } catch (err) {
        console.error('[DCF] Failed to restore session:', err);
        clearAuth();
        showLogin();
      }
    }
  } else {
    showLogin();
  }

  // Global events
  bus.on(Events.LOGIN_SUCCESS, () => showWorkspace());
  bus.on(Events.LOGOUT, handleLogout);
  bus.on(Events.TOAST, showToast);
}

function showLogin() {
  app.className = '';
  app.style.height = '100%';
  renderLoginPage(app);
}

function showWorkspace() {
  app.className = '';
  app.style.height = '100%';
  renderWorkspace(app);

  // Initialize all modules
  initLayout();
  initDock();
  initDrawerPanels();
  initChat();
  loadPersistedAgents();
  initFactory();
  initAgents();
  initApps();
  initSkills();

  // Bind header avatar menu
  setupUserMenu();
  setupSettings();

  // Server info
  const serverInfo = document.getElementById('server-info');
  if (serverInfo) {
    serverInfo.textContent = `Homeserver: ${getState().homeserverUrl || '未连接'}`;
  }
}

function setupUserMenu() {
  const avatar = document.getElementById('dock-user-avatar');
  const menu = document.getElementById('user-menu');
  if (!avatar || !menu) return;

  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = avatar.getBoundingClientRect();
    menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    menu.style.left = `${rect.right + 8}px`;
    menu.style.top = 'auto';
    menu.style.right = 'auto';
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => menu.classList.add('hidden'));

  menu.querySelector('#menu-logout')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    bus.emit(Events.LOGOUT);
  });

  menu.querySelector('#menu-settings')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    const btn = document.querySelector('[data-dock-tab="settings"]');
    if (btn) btn.click();
  });
}

function setupSettings() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#settings-logout')) {
      bus.emit(Events.LOGOUT);
    }
  });
}

async function handleLogout() {
  try { await logout(); } catch {}
  clearAuth();
  localStorage.removeItem('dcf_agents');
  localStorage.removeItem('dcf_shared_agents');
  showLogin();
}

/* ── Toast Notifications ── */
function showToast({ message, type = 'info' }) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.className = 'toast-container';
  c.id = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// Boot
bootstrap().catch(err => console.error('[DCF] Bootstrap error:', err));
