/**
 * App — 应用入口
 * 根据认证状态切换 LoginPage / WorkspacePage
 */
import { useEffect, useState } from 'react';
import { useAuth } from './application/hooks/useAuth';
import { useMatrixClient } from './application/hooks/useMatrixClient';
import { LoginPage } from './presentation/pages/LoginPage';
import { WorkspacePage } from './presentation/pages/WorkspacePage';
import { ToastContainer } from './presentation/components/ui/Toast';
import { ErrorBoundary } from './presentation/components/ErrorBoundary';

export default function App() {
  const { isLoggedIn } = useAuth();
  const { login, loginDemo, restoreSession, ssoRedirect, loginWithToken } = useMatrixClient();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    // Check for SSO loginToken callback
    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get('loginToken');
    if (loginToken) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      const hs = localStorage.getItem('dcf_sso_homeserver') || `${window.location.protocol}//${window.location.hostname}:8008`;
      loginWithToken(hs, loginToken).finally(() => setRestoring(false));
      return;
    }
    restoreSession().finally(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (restoring) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666' }}>
        正在恢复会话…
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? (
        <WorkspacePage />
      ) : (
        <LoginPage
          onLogin={login}
          onDemoLogin={loginDemo}
          onSsoLogin={(hs) => {
            localStorage.setItem('dcf_sso_homeserver', hs);
            ssoRedirect(hs);
          }}
        />
      )}
      <ToastContainer />
    </ErrorBoundary>
  );
}
