(function () {
  'use strict';

  const API_BASE = '/api/platform/auth';
  let _currentUser = null;

  const NAV_ITEMS = [
    { path: '/super-admin/tenants.html', label: '租户管理' },
    { path: '/super-admin/platform-users.html', label: '平台用户' },
    { path: '/super-admin/platform-config.html', label: '全局配置' },
    { path: '/super-admin/platform-monitoring.html', label: '运营监控' },
    { path: '/super-admin/platform-audit.html', label: '审计日志' }
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function apiHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = sessionStorage.getItem('platform_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: { ...apiHeaders(), ...(options.headers || {}) }
    });
    if (res.status === 401) {
      window.location.href = '/super-admin/login.html';
      throw new Error('未登录或会话已过期');
    }
    return res;
  }

  async function checkAuth() {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        credentials: 'same-origin',
        headers: apiHeaders()
      });
      const data = await res.json();
      if (!data.authenticated) {
        window.location.href = '/super-admin/login.html';
        return null;
      }
      _currentUser = data.user;
      return data.user;
    } catch {
      window.location.href = '/super-admin/login.html';
      return null;
    }
  }

  function getCurrentUser() { return _currentUser; }

  async function logout() {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'same-origin' });
    } catch { /* ignore */ }
    sessionStorage.removeItem('platform_token');
    window.location.href = '/super-admin/login.html';
  }

  /* ── Sidebar: brand section ── */
  function renderSidebarBrand(sidebar, user) {
    if (!sidebar || !user) return;
    const roleLabelMap = {
      platform_admin: '平台管理员',
      platform_ops: '平台运维'
    };
    const roleLabel = roleLabelMap[user.role] || '平台成员';

    let brand = sidebar.querySelector('.sidebar-brand');
    if (!brand) {
      brand = document.createElement('div');
      brand.className = 'sidebar-brand';
      sidebar.prepend(brand);
    }
    brand.innerHTML = `
      <div class="sidebar-brand-head">
        <div class="sidebar-logo" aria-hidden="true">
          <svg viewBox="0 0 72 72" role="img" focusable="false">
            <defs>
              <linearGradient id="spLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1"></stop>
                <stop offset="100%" stop-color="#14b8a6"></stop>
              </linearGradient>
            </defs>
            <circle cx="36" cy="36" r="30" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.24)" stroke-width="1.5"></circle>
            <path d="M22 40 L32 26 L42 36 L52 22" fill="none" stroke="url(#spLogoGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="22" cy="40" r="4.5" fill="#6366f1"></circle>
            <circle cx="32" cy="26" r="4.5" fill="#4f46e5"></circle>
            <circle cx="42" cy="36" r="4.5" fill="#0ea5e9"></circle>
            <circle cx="52" cy="22" r="4.5" fill="#14b8a6"></circle>
          </svg>
        </div>
        <h2 class="sidebar-title">租户运营平台</h2>
      </div>
      <div class="sidebar-kicker">Digital Crew Factory</div>
      <p class="sidebar-subtitle">平台级租户管理、资源配置与运营监控</p>
      <div class="sidebar-brand-meta">
        <span class="sidebar-role-chip">${escapeHtml(roleLabel)}</span>
        <span class="sidebar-session-chip"><span class="sidebar-session-dot" aria-hidden="true"></span>会话正常</span>
      </div>
    `;
  }

  /* ── Sidebar: nav items ── */
  function renderSidebarNav(sidebar) {
    if (!sidebar) return;
    let navContainer = sidebar.querySelector('.sidebar-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'sidebar-nav';
      sidebar.appendChild(navContainer);
    }
    navContainer.innerHTML = '';

    const currentPath = window.location.pathname;
    NAV_ITEMS.forEach((item) => {
      const link = document.createElement('a');
      link.href = item.path;
      link.textContent = item.label;
      if (item.path === currentPath) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      navContainer.appendChild(link);
    });
  }

  /* ── Sidebar: user box ── */
  function renderUserBox(sidebar, user) {
    if (!sidebar || !user) return;
    let box = sidebar.querySelector('.admin-user-box');
    if (box) box.remove();

    const displayName = String(user.displayName || user.username || '管理员');
    const username = String(user.username || '');
    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

    box = document.createElement('div');
    box.className = 'admin-user-box';
    box.innerHTML = `
      <button type="button" class="admin-user-trigger" data-sp-user-toggle="1" aria-haspopup="menu" aria-expanded="false">
        <span class="admin-user-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
        <span class="admin-user-meta">
          <span class="admin-user-name">${escapeHtml(displayName)}</span>
          <span class="admin-user-account">${escapeHtml(username)}</span>
        </span>
        <span class="admin-user-chevron" aria-hidden="true">\u25BE</span>
      </button>
      <div class="admin-user-menu hidden" data-sp-user-menu="1">
        <button type="button" class="admin-user-menu-item" data-sp-logout="1">退出登录</button>
      </div>
    `;
    sidebar.appendChild(box);
  }

  /* ── Global event delegation ── */
  function bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // User menu toggle
      const toggle = target.closest('[data-sp-user-toggle="1"]');
      const userBox = target.closest('.admin-user-box');
      const nextExpanded = Boolean(toggle)
        && userBox
        && toggle.getAttribute('aria-expanded') !== 'true';

      document.querySelectorAll('.admin-user-box').forEach((box) => {
        const trigger = box.querySelector('[data-sp-user-toggle="1"]');
        const menu = box.querySelector('[data-sp-user-menu="1"]');
        if (!trigger || !menu) return;
        const expanded = Boolean(nextExpanded) && box === userBox;
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        menu.classList.toggle('hidden', !expanded);
      });

      if (toggle) {
        event.preventDefault();
        return;
      }

      // Logout
      if (target.closest('[data-sp-logout="1"]')) {
        event.preventDefault();
        logout();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.admin-user-box').forEach((box) => {
        const trigger = box.querySelector('[data-sp-user-toggle="1"]');
        const menu = box.querySelector('[data-sp-user-menu="1"]');
        if (!trigger || !menu) return;
        trigger.setAttribute('aria-expanded', 'false');
        menu.classList.add('hidden');
      });
    });
  }

  /* ── Table pagination ── */
  function setupTablePagination() {
    const PAGE_SIZE = 12;
    const states = new Map();

    function getRows(tbody) {
      return Array.from(tbody.children).filter((r) => !r.classList.contains('empty'));
    }

    function ensurePager(tableWrap, tbody, key) {
      let pager = tableWrap.nextElementSibling;
      if (!pager || !pager.classList.contains('table-pager')) {
        pager = document.createElement('div');
        pager.className = 'table-pager';
        pager.innerHTML = `
          <div class="table-pager-meta" data-role="meta"></div>
          <div class="table-pager-controls">
            <button type="button" class="table-pager-btn" data-role="prev">\u4E0A\u4E00\u9875</button>
            <button type="button" class="table-pager-btn" data-role="next">\u4E0B\u4E00\u9875</button>
          </div>
        `;
        tableWrap.insertAdjacentElement('afterend', pager);
      }
      const prevBtn = pager.querySelector('[data-role="prev"]');
      const nextBtn = pager.querySelector('[data-role="next"]');
      if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', () => {
          const s = states.get(key) || { page: 1 };
          s.page = Math.max(1, s.page - 1);
          states.set(key, s);
          renderPager(tableWrap, tbody, key);
        });
      }
      if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', () => {
          const s = states.get(key) || { page: 1 };
          s.page += 1;
          states.set(key, s);
          renderPager(tableWrap, tbody, key);
        });
      }
      return pager;
    }

    function renderPager(tableWrap, tbody, key) {
      const rows = getRows(tbody);
      const pager = ensurePager(tableWrap, tbody, key);
      const meta = pager.querySelector('[data-role="meta"]');
      const prevBtn = pager.querySelector('[data-role="prev"]');
      const nextBtn = pager.querySelector('[data-role="next"]');
      if (!rows.length) { pager.style.display = 'none'; return; }
      pager.style.display = '';
      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const s = states.get(key) || { page: 1 };
      s.page = Math.min(Math.max(1, s.page), totalPages);
      states.set(key, s);
      const start = (s.page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      rows.forEach((row, idx) => { row.style.display = (idx >= start && idx < end) ? '' : 'none'; });
      if (meta) meta.textContent = `\u7B2C ${s.page} / ${totalPages} \u9875\uFF0C\u5171 ${total} \u6761`;
      if (prevBtn) prevBtn.disabled = s.page <= 1;
      if (nextBtn) nextBtn.disabled = s.page >= totalPages;
    }

    function renderAll() {
      const wraps = Array.from(document.querySelectorAll('.content .table-wrap'));
      wraps.forEach((wrap, idx) => {
        const tbody = wrap.querySelector('tbody');
        if (!tbody) return;
        const key = `${window.location.pathname}:${tbody.id || idx}`;
        renderPager(wrap, tbody, key);
      });
    }

    const content = document.querySelector('.content');
    if (!content) return;
    const observer = new MutationObserver(() => requestAnimationFrame(renderAll));
    observer.observe(content, { childList: true, subtree: true });
    window.__spRefreshPagination = renderAll;
    requestAnimationFrame(renderAll);
  }

  /* ── Init ── */
  window.__platformAuth = { checkAuth, getCurrentUser, logout, apiHeaders, apiFetch };

  window.__platformReady = (async () => {
    if (window.location.pathname === '/super-admin/login.html') return;
    const user = await checkAuth();
    if (!user) return;

    const sidebar = document.querySelector('.sidebar');
    renderSidebarBrand(sidebar, user);
    renderSidebarNav(sidebar);
    renderUserBox(sidebar, user);

    requestAnimationFrame(() => document.body.classList.add('admin-entered'));
    return user;
  })();

  bindGlobalEvents();
  setupTablePagination();
})();
