/**
 * OpenClawHeader — 顶部状态栏 (OpenClaw 模式专用)
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useAuthStore } from '../../../application/stores/authStore';

interface ChannelStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'syncing';
}

const INITIAL_CHANNELS: ChannelStatus[] = [
  { name: '飞书', status: 'connected' },
  { name: 'Slack', status: 'disconnected' },
  { name: 'Matrix', status: 'connected' },
];

const CHANNEL_COLORS: Record<ChannelStatus['status'], string> = {
  connected: 'bg-green-400',
  disconnected: 'bg-red-400',
  syncing: 'bg-yellow-400',
};

export function OpenClawHeader() {
  const user = useAuthStore((s) => s.user);
  const [clock, setClock] = useState(formatTime());
  const [tokenCount, setTokenCount] = useState(1_240_892);
  const [agentStatus, setAgentStatus] = useState<'running' | 'idle' | 'error'>('running');
  const [channels] = useState<ChannelStatus[]>(INITIAL_CHANNELS);

  useEffect(() => {
    const tid = setInterval(() => setClock(formatTime()), 1000);
    return () => clearInterval(tid);
  }, []);

  // Simulate token count increments
  useEffect(() => {
    const tid = setInterval(() => {
      setTokenCount((prev) => prev + Math.floor(Math.random() * 50 + 10));
    }, 5000);
    return () => clearInterval(tid);
  }, []);

  // Simulate agent status changes
  useEffect(() => {
    const tid = setInterval(() => {
      setAgentStatus((prev) => (prev === 'running' ? (Math.random() > 0.9 ? 'idle' : 'running') : 'running'));
    }, 8000);
    return () => clearInterval(tid);
  }, []);

  const agentStatusText = agentStatus === 'running' ? '运行中' : agentStatus === 'idle' ? '空闲' : '异常';
  const agentStatusColor = agentStatus === 'running' ? 'text-green-400' : agentStatus === 'idle' ? 'text-yellow-400' : 'text-red-400';

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border bg-panel backdrop-blur-[12px]">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Icon name="smart_toy" size={20} className="text-primary" />
          <span className="text-sm font-semibold text-text-primary">OpenClaw</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span>代理状态:</span>
          <span className={`${agentStatusColor} font-medium`}>{agentStatusText}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">IM 通道:</span>
          {channels.map((ch) => (
            <div key={ch.name} className="flex items-center gap-1" title={`${ch.name} — ${ch.status === 'connected' ? '已连接' : ch.status === 'syncing' ? '同步中' : '断开'}`}>
              <span className={`w-3 h-3 rounded-sm ${CHANNEL_COLORS[ch.status]} inline-block`} />
              <span className="text-text-muted text-[10px]">{ch.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs bg-primary/12 rounded-full px-2.5 py-1">
          <Icon name="generating_tokens" size={14} className="text-primary" />
          <span className="text-primary font-medium tabular-nums">令牌: {tokenCount.toLocaleString()}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-text-muted tabular-nums">{clock}</span>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="text-[10px] text-text-muted uppercase">{user?.role ?? 'Admin'}</span>
          <span className="font-medium">{user?.displayName ?? 'Alex Chen'}</span>
          <div className="w-6 h-6 rounded-full bg-fill-tertiary flex items-center justify-center">
            <Icon name="person" size={14} className="text-text-muted" />
          </div>
        </div>
      </div>
    </header>
  );
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
