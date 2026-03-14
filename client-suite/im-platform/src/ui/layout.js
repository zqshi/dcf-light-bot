/**
 * Layout — 四栏布局管理、Resizer 拖拽、Tab 切换
 * 复用 After-sales 的布局逻辑，适配 IM 场景
 */
import { bus, Events } from '../lib/events.js';
import { $, $$ } from '../lib/utils.js';

const DRAWER_MIN = 360;
const DRAWER_MAX = 900; /* stitch: w-[55%], allow wider drawer */
const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 400;

let drawerEl = null;

export function initLayout() {
  initResizers();
  initDrawer();
}

/* ── Resizers ── */
function initResizers() {
  const container = $('.layout-container');
  const sidebar = $('.left-sidebar');
  const main = $('.main-content');
  if (!container || !sidebar || !main) return;

  const leftResizer = document.createElement('div');
  leftResizer.className = 'resizer';
  leftResizer.id = 'left-resizer';
  container.insertBefore(leftResizer, sidebar.nextSibling);

  setupDrag(leftResizer, {
    getStartWidth: () => sidebar.offsetWidth,
    apply: (w) => { sidebar.style.width = `${Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w))}px`; },
    direction: 1,
  });
}

function setupDrag(handle, { getStartWidth, apply, direction = 1 }) {
  let dragging = false, startX = 0, startW = 0;

  const start = (e) => {
    e.preventDefault();
    dragging = true;
    startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    startW = getStartWidth();
    handle.classList.add('active');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };
  const move = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    apply(startW + (x - startX) * direction);
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  handle.addEventListener('mousedown', start);
  handle.addEventListener('touchstart', start, { passive: false });
  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}

/* ── Drawer (Right Panel) ── */
function initDrawer() {
  drawerEl = $('.right-drawer');
  if (!drawerEl) return;

  const resizer = $('.drawer-resizer', drawerEl);
  if (resizer) {
    setupDrag(resizer, {
      getStartWidth: () => drawerEl.offsetWidth,
      apply: (w) => {
        const maxW = Math.min(DRAWER_MAX, window.innerWidth - 120);
        const clamped = Math.max(DRAWER_MIN, Math.min(maxW, w));
        drawerEl.style.width = `${clamped}px`;
        drawerEl.style.transition = 'none';
      },
      direction: -1,
    });
    // restore transition after drag
    document.addEventListener('mouseup', () => { if (drawerEl) drawerEl.style.transition = ''; });
    document.addEventListener('touchend', () => { if (drawerEl) drawerEl.style.transition = ''; });
  }

  bus.on(Events.DRAWER_TOGGLE, ({ open, type, data }) => {
    if (open) openDrawer(type, data);
    else closeDrawer();
  });
}

function getDrawerWidth() {
  const dockW = $('.dock-nav')?.offsetWidth || 80;
  const sideW = $('.left-sidebar')?.offsetWidth || 320;
  /* stitch: drawer is w-[55%], compute 55% of viewport but ensure chat has min 360px */
  const target = Math.round(window.innerWidth * 0.55);
  const chatMin = 360;
  const maxAllowed = window.innerWidth - dockW - sideW - chatMin;
  return Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.min(target, maxAllowed)));
}

export function openDrawer(type, data) {
  if (!drawerEl) drawerEl = $('.right-drawer');
  if (!drawerEl) return;

  const width = getDrawerWidth();
  drawerEl.style.display = 'flex';
  drawerEl.style.width = '0px';
  drawerEl.style.overflow = 'hidden';
  drawerEl.offsetWidth; // reflow
  drawerEl.style.width = `${width}px`;
  drawerEl.style.overflow = '';
  drawerEl.classList.add('drawer-open');

  bus.emit(Events.DRAWER_CONTENT, { type, data });
}

export function closeDrawer() {
  if (!drawerEl) return;
  drawerEl.style.width = '0px';
  drawerEl.style.overflow = 'hidden';
  drawerEl.classList.remove('drawer-open');

  const onEnd = () => {
    if (!drawerEl.classList.contains('drawer-open')) {
      drawerEl.style.display = 'none';
    }
    drawerEl.removeEventListener('transitionend', onEnd);
  };
  drawerEl.addEventListener('transitionend', onEnd);
  setTimeout(() => {
    if (!drawerEl.classList.contains('drawer-open')) drawerEl.style.display = 'none';
  }, 350);
}

export function toggleDrawer(type, data) {
  if (!drawerEl) drawerEl = $('.right-drawer');
  const isOpen = drawerEl?.classList.contains('drawer-open');
  if (isOpen) closeDrawer();
  else openDrawer(type, data);
}

/* ── Sidebar Tab Switching ── */
export function switchSidebarTab(tabId) {
  $$('.sidebar-tab').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.tab === tabId);
  });
  $$('.sidebar-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `${tabId}-panel`);
  });
}

/* ── Layout mode helpers ── */
export function setFullWidthMode(enabled) {
  const sidebar = $('.left-sidebar');
  const resizer = $('#left-resizer');
  if (sidebar) sidebar.style.display = enabled ? 'none' : '';
  if (resizer) resizer.style.display = enabled ? 'none' : '';
}
