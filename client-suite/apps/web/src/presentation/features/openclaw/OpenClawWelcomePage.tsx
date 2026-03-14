/**
 * OpenClawWelcomePage — OpenClaw v2 欢迎页 (openclaw_v2 设计稿)
 * Agent列表 + 欢迎语 + 快捷指令 + 控制面板看板 + 系统算力
 */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useAgentStore, type SharedAgent } from '../../../application/stores/agentStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { AgentItem } from './OpenClawSidebar';

/* ── Quick Commands ── */
const QUICK_COMMANDS = [
  { id: 'qc1', icon: 'mail', label: '总结邮件', desc: '汇总今日未读邮件并生成摘要' },
  { id: 'qc2', icon: 'dns', label: '检查服务器', desc: '扫描所有服务器健康状态' },
  { id: 'qc3', icon: 'event', label: '安排周会', desc: '自动协调团队日程安排周会' },
  { id: 'qc4', icon: 'query_stats', label: '竞品调研', desc: '分析竞品最新动态并生成报告' },
];

/* ── Recent Tasks ── */
const RECENT_TASKS = [
  { id: 'rt1', name: '安全扫描任务 #882', status: '进行中', progress: 84, time: '12:45' },
  { id: 'rt2', name: '市场数据抓取 #756', status: '已完成', progress: 100, time: '11:30' },
  { id: 'rt3', name: '代码审查 #901', status: '等待中', progress: 0, time: '10:15' },
];

/* ── Quick Resources ── */
const QUICK_RESOURCES = [
  { icon: 'description', label: '使用文档' },
  { icon: 'school', label: '教程中心' },
  { icon: 'forum', label: '社区论坛' },
  { icon: 'bug_report', label: '反馈建议' },
];

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  idle: { bg: 'bg-green-400/10', text: 'text-green-400' },
  working: { bg: 'bg-blue-400/10', text: 'text-blue-400' },
  offline: { bg: 'bg-slate-500/10', text: 'text-slate-500' },
  monitoring: { bg: 'bg-amber-400/10', text: 'text-amber-400' },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const CATEGORY_ICONS: Record<string, { color: string; icon: string; status: string; statusLabel: string }> = {
  dev: { color: '#007AFF', icon: 'code', status: 'working', statusLabel: '正在编码...' },
  docs: { color: '#34C759', icon: 'edit_note', status: 'idle', statusLabel: '空闲中' },
  data: { color: '#AF52DE', icon: 'analytics', status: 'idle', statusLabel: '空闲中' },
  design: { color: '#FF9500', icon: 'palette', status: 'offline', statusLabel: '离线' },
  test: { color: '#5856D6', icon: 'bug_report', status: 'idle', statusLabel: '空闲中' },
  ops: { color: '#FF9500', icon: 'settings', status: 'monitoring', statusLabel: '监控中' },
  translate: { color: '#00C7BE', icon: 'translate', status: 'idle', statusLabel: '空闲中' },
  security: { color: '#FF3B30', icon: 'shield', status: 'monitoring', statusLabel: '监控中' },
};

function sharedToItem(sa: SharedAgent): AgentItem {
  const d = CATEGORY_ICONS[sa.category] ?? { color: '#64748b', icon: 'smart_toy', status: 'idle', statusLabel: '空闲中' };
  return { id: sa.id, name: sa.name, status: d.status as AgentItem['status'], statusLabel: d.statusLabel, color: d.color, icon: d.icon };
}

interface WelcomePageProps {
  onStartChat: (text: string) => void;
}

export function OpenClawWelcomePage({ onStartChat }: WelcomePageProps) {
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const agents = useMemo(() => sharedAgents.map(sharedToItem), [sharedAgents]);
  const [input, setInput] = useState('');

  return (
    <div className="flex h-full">
      {/* Agent List (left rail inside main area) */}
      <div className="w-[220px] shrink-0 border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-sm font-semibold text-slate-100">代理列表</h3>
        </div>
        <div className="flex-1 overflow-y-auto dcf-scrollbar px-3 space-y-1">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto dcf-scrollbar">
        <div className="flex-1 px-8 py-6 space-y-6 max-w-[900px] mx-auto w-full">

          {/* Welcome section */}
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D4B8] to-[#00A893] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(0,212,184,0.3)]">
              <Icon name="auto_awesome" size={32} className="text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-100">{getGreeting()}，管理员</h1>
            <p className="text-sm text-slate-400 mt-1">OpenClaw AI 助手已就绪，随时为您服务</p>
          </div>

          {/* Quick Commands (2x2 grid) */}
          <section>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">快捷指令</h3>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => onStartChat(cmd.desc)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-bg-active flex items-center justify-center shrink-0">
                    <Icon name={cmd.icon} size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{cmd.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{cmd.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Dashboard panels row */}
          <div className="grid grid-cols-2 gap-4">
            {/* System Health */}
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xs font-medium text-slate-300 mb-3">系统健康</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <p className="text-[10px] text-slate-500">活跃 Agent</p>
                  <p className="text-lg font-bold text-primary">12</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <p className="text-[10px] text-slate-500">系统延迟</p>
                  <p className="text-lg font-bold text-green-400">42ms</p>
                </div>
              </div>
            </section>

            {/* Recent Tasks */}
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xs font-medium text-slate-300 mb-3">最近任务</h3>
              <div className="space-y-2">
                {RECENT_TASKS.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        task.progress === 100 ? 'bg-green-400' : task.progress > 0 ? 'bg-primary animate-pulse' : 'bg-slate-500'
                      }`} />
                      <span className="text-slate-200 truncate">{task.name}</span>
                    </div>
                    <span className="text-slate-500 shrink-0 ml-2">{task.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Quick Resources */}
          <section>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">快捷资源</h3>
            <div className="flex gap-3">
              {QUICK_RESOURCES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => useToastStore.getState().addToast(`${r.label}即将上线`, 'info')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Icon name={r.icon} size={14} className="text-slate-500" />
                  {r.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* System capacity bar + Pro badge */}
        <div className="border-t border-white/10 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>系统算力: <span className="text-primary font-medium">324 TFLOPS</span></span>
            <span>负载: <span className="text-green-400 font-medium">良好</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-gradient-to-r from-[rgba(0,212,184,0.2)] to-[rgba(0,122,255,0.15)] text-primary font-medium border border-primary/20">
              专业版已激活
            </span>
            <span className="text-slate-500">有效期 2025-12-31</span>
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-white/10 px-8 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <button type="button" onClick={() => useToastStore.getState().addToast('语音输入即将上线', 'info')} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Icon name="mic" size={20} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('文件上传即将上线', 'info')} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Icon name="attach_file" size={20} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('指令面板即将上线', 'info')} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Icon name="bolt" size={20} />
            </button>
            <input
              type="text"
              placeholder="输入指令或提问..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) { onStartChat(input.trim()); setInput(''); } }}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={() => { if (input.trim()) { onStartChat(input.trim()); setInput(''); } }}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Agent Card sub-component ── */
function AgentCard({ agent }: { agent: AgentItem }) {
  const badge = STATUS_BADGE[agent.status] ?? STATUS_BADGE.offline;
  return (
    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => useToastStore.getState().addToast(`查看 Agent: ${agent.name}`, 'info')}>
      <div className="relative shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: agent.color }}
        >
          <Icon name={agent.icon} size={18} className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{agent.name}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
          {agent.statusLabel}
        </span>
      </div>
    </div>
  );
}
