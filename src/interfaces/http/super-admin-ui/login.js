(function () {
  'use strict';

  const API_BASE = '/api/platform/auth';

  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = '/super-admin/tenants.html';
      }
    } catch { /* ignore */ }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('errorMsg');
    errorEl.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
      errorEl.textContent = '请输入用户名和密码';
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.authenticated) {
        if (data.token) {
          sessionStorage.setItem('platform_token', data.token);
        }
        window.location.href = '/super-admin/tenants.html';
      } else {
        errorEl.textContent = data.error || '登录失败，请检查账号密码';
      }
    } catch (err) {
      errorEl.textContent = err.message || '网络错误，请稍后重试';
    }
  });

  checkSession();
})();
