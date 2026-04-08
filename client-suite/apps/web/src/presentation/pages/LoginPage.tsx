/**
 * LoginPage — 登录页
 * 支持 Matrix 账密登录、企业 SSO、Demo 模式
 */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface LoginPageProps {
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  onDemoLogin: () => Promise<void>;
  onSsoLogin?: (homeserver: string) => void;
}

export function LoginPage({ onLogin, onDemoLogin, onSsoLogin }: LoginPageProps) {
  const [homeserver, setHomeserver] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const hs = homeserver || window.location.origin;
      await onLogin(hs, username, password);
    } catch (e) {
      setError((e as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      await onDemoLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-primary/5 animate-pulse" />
        <div className="absolute top-1/3 -right-10 w-40 h-40 rounded-full bg-indigo-400/5 animate-pulse [animation-delay:1s]" />
        <div className="absolute -bottom-10 left-1/3 w-48 h-48 rounded-full bg-blue-400/5 animate-pulse [animation-delay:2s]" />
      </div>
      <Card className="w-[380px] p-8 backdrop-blur-xl bg-white/80 shadow-lg login-card-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-xl mb-3">
            D
          </div>
          <h1 className="text-xl font-bold text-text-primary">DCF 数字员工协作平台</h1>
          <p className="text-sm text-text-secondary mt-1">登录以开始使用</p>
        </div>

        {/* Login form */}
        <div className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {error && <p className="text-xs text-error">{error}</p>}

          <Button onClick={handleLogin} disabled={loading || !username || !password} className="w-full" size="lg">
            {loading ? '登录中...' : '登录'}
          </Button>

          <div className="flex items-center gap-2 text-text-muted text-xs">
            <span className="flex-1 border-t border-border" />
            <span>或</span>
            <span className="flex-1 border-t border-border" />
          </div>

          <Button variant="secondary" onClick={handleDemo} disabled={loading} className="w-full" size="lg">
            🎮 Demo 模式
          </Button>

          {onSsoLogin && (
            <Button
              variant="ghost"
              onClick={() => {
                const hs = homeserver || window.location.origin;
                onSsoLogin(hs);
              }}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              🏢 企业 SSO 登录
            </Button>
          )}
        </div>

        {/* Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 text-xs text-text-muted hover:text-primary"
        >
          {showAdvanced ? '收起' : '高级设置'}
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <input
              type="text"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="Homeserver 地址 (可选)"
              className="w-full h-9 px-3 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
