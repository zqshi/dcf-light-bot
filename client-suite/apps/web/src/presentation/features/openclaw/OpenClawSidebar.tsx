/**
 * OpenClawSidebar — Agent 列表侧栏
 * 左侧展示可用的数字员工列表，搜索、状态指示。
 */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useAgentStore, type SharedAgent } from '../../../application/stores/agentStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';

type AgentStatus = 'idle' | 'working' | 'offline' | 'monitoring';

interface AgentItem {
  id: string;
  name: string;
  status: AgentStatus;
  statusLabel: string;
  color: string;
  icon: string;
}

/** Map agentStore categories to display properties */
const CATEGORY_DISPLAY: Record<string, { color: string; icon: string; status: AgentStatus; statusLabel: string }> = {
  dev: { color: '#007AFF', icon: 'code', status: 'working', statusLabel: '正在编码...' },
  docs: { color: '#34C759', icon: 'edit_note', status: 'idle', statusLabel: '空闲中' },
  data: { color: '#AF52DE', icon: 'analytics', status: 'idle', statusLabel: '空闲中' },
  design: { color: '#FF9500', icon: 'palette', status: 'offline', statusLabel: '离线' },
  test: { color: '#5856D6', icon: 'bug_report', status: 'idle', statusLabel: '空闲中' },
  ops: { color: '#FF9500', icon: 'settings', status: 'monitoring', statusLabel: '监控中' },
  translate: { color: '#00C7BE', icon: 'translate', status: 'idle', statusLabel: '空闲中' },
  security: { color: '#FF3B30', icon: 'shield', status: 'monitoring', statusLabel: '监控中' },
};

const DEFAULT_DISPLAY = { color: '#64748b', icon: 'smart_toy', status: 'idle' as AgentStatus, statusLabel: '空闲中' };

function toAgentItem(sa: SharedAgent): AgentItem {
  const d = CATEGORY_DISPLAY[sa.category] ?? DEFAULT_DISPLAY;
  return { id: sa.id, name: sa.name, status: d.status, statusLabel: d.statusLabel, color: d.color, icon: d.icon };
}

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: 'bg-green-400',
  working: 'bg-blue-400 animate-pulse',
  offline: 'bg-slate-500',
  monitoring: 'bg-amber-400 animate-pulse',
};

interface OpenClawSidebarProps {
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

export function OpenClawSidebar({ selectedAgentId, onSelectAgent }: OpenClawSidebarProps) {
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const [search, setSearch] = useState('');

  const agents = useMemo(() => sharedAgents.map(toAgentItem), [sharedAgents]);
  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h2 className="text-sm font-semibold text-slate-100">我的数字员工</h2>
        <button type="button" onClick={() => useUIStore.getState().setDock('factory')} className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-white/5 transition-colors">
          <Icon name="add" size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索代理..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30"
          />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar px-2">
        {filtered.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all text-left ${
              selectedAgentId === agent.id
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: agent.color }}
              >
                <Icon name={agent.icon} size={20} className="text-white" />
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-bg-light ${STATUS_DOT[agent.status]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{agent.name}</p>
              <span className="text-[11px] text-slate-400 truncate">{agent.statusLabel}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-2 py-2 flex flex-col gap-0.5">
        <button type="button" onClick={() => useToastStore.getState().addToast('帮助文档即将上线', 'info')} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors text-sm">
          <Icon name="help" size={18} />
          <span>帮助</span>
        </button>
        <button type="button" onClick={() => useUIStore.getState().setDock('settings')} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors text-sm">
          <Icon name="tune" size={18} />
          <span>系统配置</span>
        </button>
      </div>
    </div>
  );
}

export type { AgentItem };
