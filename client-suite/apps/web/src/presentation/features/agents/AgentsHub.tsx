/**
 * AgentsHub — 共享 Agent 大厅
 * 参考 im-platform agents.js
 */
import { useState, useEffect, useCallback } from 'react';
import { SearchInput } from '../../components/ui/SearchInput';
import { AgentCard } from './AgentCard';
import { useAgentStore } from '../../../application/stores/agentStore';
import { getMatrixClient, globalSelectRoom } from '../../../application/hooks/useMatrixClient';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';

export function AgentsSidebar() {
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const [selectedId, setSelectedId] = useState<string | null>(sharedAgents[0]?.id ?? null);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">共享 Agent</h3>
      <div className="space-y-0.5">
        {sharedAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setSelectedId(agent.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
              selectedId === agent.id ? 'bg-primary/10 text-primary' : 'hover:bg-bg-hover'
            }`}
          >
            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] shrink-0 ${
              selectedId === agent.id ? 'bg-primary/20' : 'bg-primary/10'
            }`}>
              {agent.icon || agent.name.charAt(0)}
            </span>
            <div className="min-w-0 text-left">
              <p className={`font-medium truncate ${selectedId === agent.id ? 'text-primary' : 'text-text-primary'}`}>{agent.name}</p>
              <p className="text-[10px] text-text-muted truncate">{agent.role}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentsHub() {
  const [search, setSearch] = useState('');
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const invokeAgent = useAgentStore((s) => s.invokeAgent);
  const loadPersistedAgents = useAgentStore((s) => s.loadPersistedAgents);
  const setDock = useUIStore((s) => s.setDock);

  useEffect(() => {
    loadPersistedAgents();
  }, [loadPersistedAgents]);

  const handleInvokeAgent = useCallback(async (agentId: string, agentUserId?: string) => {
    invokeAgent(agentId);
    if (!agentUserId) return;

    const client = getMatrixClient();
    if (!client) return;

    try {
      const roomId = await client.createDmRoom(agentUserId);
      if (roomId) {
        setDock('messages');
        await globalSelectRoom(roomId);
      }
    } catch {
      useToastStore.getState().addToast('创建对话失败', 'error');
    }
  }, [invokeAgent, setDock]);

  const filtered = sharedAgents.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 overflow-auto p-6 dcf-scrollbar">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-text-primary mb-1">共享 Agent 大厅</h2>
        <p className="text-sm text-text-secondary mb-4">浏览和使用团队共享的 AI 助手</p>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="搜索 Agent..."
          className="mb-4 max-w-xs"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <span className="material-symbols-rounded text-4xl opacity-30 block mb-2">smart_toy</span>
            <p className="text-sm">{search ? `没有找到匹配 "${search}" 的 Agent` : '暂无可用的 Agent'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => handleInvokeAgent(agent.id, agent.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
