import { create } from 'zustand';
import { Agent } from '../../domain/agent/Agent';
import type { AgentCategory } from '../../domain/shared/types';
import { agentApi, type SharedAgentDTO } from '../../infrastructure/api/dcfApiClient';

export interface SharedAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  category: string;
  invokeCount: number;
  tags: string[];
  icon: string;
  creator: string;
  userId?: string; // Matrix userId for DM creation
}

const INITIAL_SHARED_AGENTS: SharedAgent[] = [
  { id: 'sa-1', name: '代码助手', role: '全栈开发工程师', description: '编写、审查、调试代码', category: 'dev', invokeCount: 128, tags: ['code', 'review'], icon: '💻', creator: 'system', userId: '@agent-coder:dcf.local' },
  { id: 'sa-2', name: '文档写手', role: '技术文档工程师', description: 'PRD、API 文档、技术方案撰写', category: 'docs', invokeCount: 96, tags: ['doc', 'prd'], icon: '📝', creator: 'system', userId: '@agent-writer:dcf.local' },
  { id: 'sa-3', name: '数据分析师', role: '数据分析工程师', description: 'SQL 生成、数据可视化、报表分析', category: 'data', invokeCount: 72, tags: ['sql', 'data'], icon: '📊', creator: 'system' },
  { id: 'sa-4', name: '原型设计师', role: 'UI/UX 设计师', description: '原型设计、交互方案', category: 'design', invokeCount: 54, tags: ['design', 'ux'], icon: '🎨', creator: 'system' },
  { id: 'sa-5', name: '测试工程师', role: '质量保障工程师', description: '单元测试、集成测试、E2E 测试生成', category: 'test', invokeCount: 67, tags: ['test', 'qa'], icon: '🧪', creator: 'system' },
  { id: 'sa-6', name: '运维助手', role: '运维工程师', description: 'Docker、K8s、CI/CD 配置', category: 'ops', invokeCount: 45, tags: ['devops', 'k8s'], icon: '⚙️', creator: 'system' },
  { id: 'sa-7', name: '翻译专员', role: '国际化工程师', description: '多语言翻译、i18n 资源管理', category: 'translate', invokeCount: 33, tags: ['i18n', 'l10n'], icon: '🌐', creator: 'system' },
  { id: 'sa-8', name: '安全审计员', role: '安全工程师', description: '代码安全审计、漏洞扫描', category: 'security', invokeCount: 28, tags: ['security', 'audit'], icon: '🔒', creator: 'system' },
];

const LS_AGENTS_KEY = 'dcf_agents';
const LS_SHARED_AGENTS_KEY = 'dcf_shared_agents';

interface AgentSerialized {
  id: string;
  name: string;
  role: string;
  department: string;
  personality: 'professional' | 'friendly' | 'creative' | 'analytical';
  model: string;
  status?: 'online' | 'busy' | 'offline';
  category?: AgentCategory;
  employeeId?: string;
  email?: string;
  invokeCount?: number;
  creatorId?: string;
  createdAt?: number;
  description?: string;
  avatarGradient?: string;
}

function serializeAgent(agent: Agent): AgentSerialized {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    department: agent.department,
    personality: agent.personality,
    model: agent.model,
    status: agent.status,
    category: agent.category,
    employeeId: agent.employeeId,
    email: agent.email,
    invokeCount: agent.invokeCount,
    creatorId: agent.creatorId,
    createdAt: agent.createdAt,
    description: agent.description,
    avatarGradient: agent.avatarGradient,
  };
}

function deserializeAgent(data: AgentSerialized): Agent {
  return Agent.create({
    id: data.id,
    name: data.name,
    role: data.role,
    department: data.department,
    personality: data.personality,
    model: data.model as Agent['model'],
    status: data.status,
    category: data.category,
    employeeId: data.employeeId,
    email: data.email,
    invokeCount: data.invokeCount,
    creatorId: data.creatorId,
    createdAt: data.createdAt,
    description: data.description,
    avatarGradient: data.avatarGradient,
  });
}

function dtoToSharedAgent(dto: SharedAgentDTO): SharedAgent {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.description ?? dto.name,
    description: dto.description ?? '',
    category: dto.category ?? 'dev',
    invokeCount: 0,
    tags: [],
    icon: '',
    creator: dto.source ?? 'system',
    userId: dto.matrixUserId,
  };
}

interface AgentState {
  createdAgents: Agent[];
  sharedAgents: SharedAgent[];
  addCreatedAgent(agent: Agent): void;

  loadPersistedAgents(): void;
  invokeAgent(agentId: string): void;
  reset(): void;
  /** Fetch shared agents from DCF backend; falls back to local data on failure */
  fetchFromBackend(): Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  createdAgents: [],
  sharedAgents: [...INITIAL_SHARED_AGENTS],

  addCreatedAgent(agent: Agent) {
    set((state) => {
      const next = [...state.createdAgents, agent];
      try {
        localStorage.setItem(LS_AGENTS_KEY, JSON.stringify(next.map(serializeAgent)));
      } catch { /* quota exceeded — ignore */ }
      return { createdAgents: next };
    });
  },


  loadPersistedAgents() {
    try {
      const raw = localStorage.getItem(LS_AGENTS_KEY);
      if (raw) {
        const parsed: AgentSerialized[] = JSON.parse(raw);
        set({ createdAgents: parsed.map(deserializeAgent) });
      }
    } catch { /* corrupted data — ignore */ }

    try {
      const raw = localStorage.getItem(LS_SHARED_AGENTS_KEY);
      if (raw) {
        const parsed: SharedAgent[] = JSON.parse(raw);
        set({ sharedAgents: parsed });
      }
    } catch { /* corrupted data — ignore */ }
  },

  reset() {
    set({ createdAgents: [], sharedAgents: [...INITIAL_SHARED_AGENTS] });
  },

  async fetchFromBackend() {
    try {
      const res = await agentApi.listShared();
      if (res.rows && res.rows.length > 0) {
        set({ sharedAgents: res.rows.map(dtoToSharedAgent) });
        return;
      }
    } catch {
      // Backend unreachable — keep local data
    }
  },

  invokeAgent(agentId: string) {
    // Check created agents first
    const { createdAgents, sharedAgents } = get();
    const createdIdx = createdAgents.findIndex((a) => a.id === agentId);
    if (createdIdx >= 0) {
      const updated = [...createdAgents];
      updated[createdIdx] = updated[createdIdx].withInvoke();
      try {
        localStorage.setItem(LS_AGENTS_KEY, JSON.stringify(updated.map(serializeAgent)));
      } catch { /* ignore */ }
      set({ createdAgents: updated });
      return;
    }

    // Check shared agents
    const sharedIdx = sharedAgents.findIndex((a) => a.id === agentId);
    if (sharedIdx >= 0) {
      const updated = [...sharedAgents];
      updated[sharedIdx] = { ...updated[sharedIdx], invokeCount: updated[sharedIdx].invokeCount + 1 };
      try {
        localStorage.setItem(LS_SHARED_AGENTS_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      set({ sharedAgents: updated });
    }
  },
}));
