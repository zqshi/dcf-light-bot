/**
 * Login Page — SSO 单点登录 + Matrix 账号登录
 */
import { login, getSsoLoginUrl } from '../lib/matrix.js';
import { demoLogin } from '../lib/mock-matrix.js';
import { bus, Events } from '../lib/events.js';

export function renderLoginPage(container) {
  container.innerHTML = `
    <div class="login-container">
      <div class="login-card fade-in">
        <svg class="logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="10" fill="#007AFF"/>
          <path d="M14 16h6l4 8 4-8h6v16h-5V22l-5 10-5-10v10h-5V16z" fill="white"/>
        </svg>
        <h1>DCF 数字员工协作平台</h1>
        <p class="subtitle">Digital Collaboration Factory</p>

        <div class="login-error" id="login-error"></div>

        <form id="login-form">
          <div class="login-field">
            <label for="login-user">用户名</label>
            <input type="text" id="login-user" placeholder="输入 Matrix 用户名" autocomplete="username" />
          </div>
          <div class="login-field">
            <label for="login-pass">密码</label>
            <input type="password" id="login-pass" placeholder="输入密码" autocomplete="current-password" />
          </div>
          <button type="submit" class="login-btn" id="login-submit">
            <span class="btn-text">登 录</span>
          </button>
        </form>

        <div class="login-sso-divider">或</div>
        <button class="login-sso-btn" id="sso-btn">
          <span class="material-symbols-outlined">business</span>
          企业 SSO 单点登录
        </button>

        <div style="margin-top:16px">
          <button class="login-sso-btn" id="demo-btn" style="background:rgba(0,122,255,0.04);border-color:rgba(0,122,255,0.15);color:#007AFF">
            <span class="material-symbols-outlined">play_arrow</span>
            Demo 模式体验（无需服务器）
          </button>
        </div>

        <div class="login-server-field">
          <span class="login-server-toggle" id="server-toggle">高级设置 ▾</span>
          <div id="server-config" class="hidden" style="margin-top:12px">
            <div class="login-field">
              <label for="homeserver-url">Homeserver 地址</label>
              <input type="url" id="homeserver-url" placeholder="https://matrix.example.com" value="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Detect homeserver from current URL or default
  const hsInput = container.querySelector('#homeserver-url');
  const defaultHs = `${window.location.protocol}//${window.location.hostname}:8008`;
  hsInput.value = localStorage.getItem('dcf_homeserver') || defaultHs;

  // Toggle server config
  container.querySelector('#server-toggle').addEventListener('click', () => {
    const cfg = container.querySelector('#server-config');
    cfg.classList.toggle('hidden');
  });

  // Login form
  container.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = container.querySelector('#login-user').value.trim();
    const password = container.querySelector('#login-pass').value;
    const homeserverUrl = hsInput.value.trim().replace(/\/$/, '');
    const errEl = container.querySelector('#login-error');
    const btn = container.querySelector('#login-submit');

    if (!username || !password) {
      showError(errEl, '请输入用户名和密码');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spin-animation" style="font-size:18px;vertical-align:-3px">progress_activity</span> 登录中...';
    errEl.style.display = 'none';

    try {
      localStorage.setItem('dcf_homeserver', homeserverUrl);
      await login(homeserverUrl, username, password);
      bus.emit(Events.LOGIN_SUCCESS);
    } catch (err) {
      const msg = err?.data?.error || err?.message || '登录失败，请检查账号密码';
      showError(errEl, msg);
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-text">登 录</span>';
    }
  });

  // Demo button
  container.querySelector('#demo-btn').addEventListener('click', async () => {
    await demoLogin();
    bus.emit(Events.LOGIN_SUCCESS);
  });

  // SSO button
  container.querySelector('#sso-btn').addEventListener('click', () => {
    const homeserverUrl = hsInput.value.trim().replace(/\/$/, '');
    localStorage.setItem('dcf_homeserver', homeserverUrl);
    const redirectUrl = `${window.location.origin}${window.location.pathname}?sso_redirect=1`;
    window.location.href = getSsoLoginUrl(homeserverUrl, redirectUrl);
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}
