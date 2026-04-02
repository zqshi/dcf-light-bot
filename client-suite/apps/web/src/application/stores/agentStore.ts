import { create } from 'zustand';
import { Agent, type AgentProps } from '../../domain/agent/Agent';
import { CapabilityRegistry } from '../../domain/agent/CapabilityRegistry';
import { DEFAULT_CAPABILITY_TEMPLATES, type CapabilityTemplate } from '../../domain/agent/CapabilityTemplate';
import type { AgentCategory, ModelId } from '../../domain/shared/types';
import { agentApi, type SharedAgentDTO } from '../../infrastructure/api/dcfApiClient';
import { getCategoryDisplay } from '../../domain/agent/AgentCategoryConfig';
import { useAuthStore } from './authStore';

/**
 * SharedAgent — backward-compatible DTO for IM-mode components (AgentsHub, AgentCard).
 * Derived from CapabilityTemplate in the new architecture.
 * @deprecated Use CapabilityTemplate / Agent directly in new code.
 */
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
  userId?: string;
}

const LS_PRIMARY_AGENT_KEY = 'dcf_primary_agent';
const LS_ACTIVE_CAPS_KEY = 'dcf_active_capabilities';
const LS_OC_VISITED_KEY = 'dcf_openclaw_visited';

/** Derive SharedAgent[] from capability templates for backward compat */
function templatesToSharedAgents(templates: CapabilityTemplate[]): SharedAgent[] {
  return templates.map((t) => ({
    id: `sa-${t.category}`,
    name: t.name,
    role: t.description,
    description: t.description,
    category: t.category,
    invokeCount: 0,
    tags: [t.category],
    icon: getCategoryDisplay(t.category).icon,
    creator: 'system',
  }));
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

interface PrimaryAgentSetupProps {
  name: string;
  role: string;
  department: string;
  persona: string;
  model: ModelId;
}

interface AgentState {
  // ── New model ──────────────────────────────────────────────────
  primaryAgent: Agent | null;
  capabilityRegistry: CapabilityRegistry;
  isPrimaryAgentSetup: boolean;
  /** True if user has never visited OpenClaw before (show intro card) */
  isFirstVisit: boolean;

  /** Manual setup (kept for edge cases) */
  setupPrimaryAgent(props: PrimaryAgentSetupProps): void;
  /** Auto-create Primary Agent from login identity — zero user input */
  autoSetupFromAuth(): void;
  /** Update existing Primary Agent fields (edit mode) */
  updatePrimaryAgent(props: Partial<PrimaryAgentSetupProps>): void;
  /** Mark first visit as complete */
  markVisited(): void;
  activateCapability(templateId: string): Agent;
  getAgentById(id: string): Agent | undefined;

  // ── Backward-compat (derived from templates) ───────────────────
  /** @deprecated Use capabilityRegistry.getAvailableTemplates() */
  sharedAgents: SharedAgent[];

  invokeAgent(agentId: string): void;
  loadPersistedAgents(): void;
  reset(): void;
  fetchFromBackend(): Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  primaryAgent: null,
  capabilityRegistry: CapabilityRegistry.createDefault(),
  isPrimaryAgentSetup: false,
  isFirstVisit: !localStorage.getItem(LS_OC_VISITED_KEY),
  sharedAgents: templatesToSharedAgents(DEFAULT_CAPABILITY_TEMPLATES),

  setupPrimaryAgent(props) {
    const agent = Agent.create({
      id: `primary-${Date.now()}`,
      name: props.name,
      role: props.role,
      department: props.department,
      personality: 'professional',
      model: props.model,
      agentType: 'primary',
      persona: props.persona,
      ownerId: 'current-user',
    });
    set({ primaryAgent: agent, isPrimaryAgentSetup: true });

    // Persist
    try {
      localStorage.setItem(LS_PRIMARY_AGENT_KEY, JSON.stringify(agent.toProps()));
    } catch { /* quota exceeded */ }
  },

  autoSetupFromAuth() {
    // Already set up — skip
    if (get().isPrimaryAgentSetup) return;

    const { user, dcfUser } = useAuthStore.getState();
    if (!user) return;

    const displayName = user.displayName || dcfUser?.username || '我的助手';
    const role = user.role || dcfUser?.role || '员工';
    const department = user.department || '未设置';

    get().setupPrimaryAgent({
      name: `${displayName}的数字分身`,
      role,
      department,
      persona: `你是${displayName}的数字分身，担任${role}，隶属${department}。协助处理日常工作并在需要时调用专业能力。`,
      model: 'claude-sonnet-4-6',
    });
  },

  updatePrimaryAgent(props) {
    const { primaryAgent } = get();
    if (!primaryAgent) return;

    let updated = primaryAgent;
    if (props.name !== undefined) updated = Agent.create({ ...updated.toProps(), name: props.name });
    if (props.role !== undefined) updated = Agent.create({ ...updated.toProps(), role: props.role });
    if (props.department !== undefined) updated = Agent.create({ ...updated.toProps(), department: props.department });
    if (props.persona !== undefined) updated = Agent.create({ ...updated.toProps(), persona: props.persona });
    if (props.model !== undefined) updated = Agent.create({ ...updated.toProps(), model: props.model });

    set({ primaryAgent: updated });
    try {
      localStorage.setItem(LS_PRIMARY_AGENT_KEY, JSON.stringify(updated.toProps()));
    } catch { /* ignore */ }
  },

  markVisited() {
    set({ isFirstVisit: false });
    try { localStorage.setItem(LS_OC_VISITED_KEY, '1'); } catch { /* ignore */ }
  },

  activateCapability(templateId) {
    const { capabilityRegistry, primaryAgent } = get();
    const existing = capabilityRegistry.getActiveAgent(templateId);
    if (existing) return existing;

    const template = capabilityRegistry.findTemplate(templateId);
    if (!template) throw new Error(`Unknown capability template: ${templateId}`);

    const agent = Agent.create({
      id: `cap-agent-${template.category}-${Date.now()}`,
      name: template.name,
      role: template.description,
      department: '能力中心',
      personality: 'professional',
      model: primaryAgent?.model ?? 'claude-sonnet-4-6',
      agentType: 'capability',
      category: template.category,
      description: template.systemPrompt,
    });

    const nextRegistry = capabilityRegistry.registerAgent(templateId, agent);
    const nextPrimary = primaryAgent?.withCapability(templateId) ?? null;
    set({ capabilityRegistry: nextRegistry, primaryAgent: nextPrimary });

    // Persist activated capabilities
    try {
      const caps = [...nextRegistry.getAllActiveAgents().map((a) => ({
        templateId: a.category ? `cap-${a.category}` : templateId,
        agentProps: a.toProps(),
      }))];
      localStorage.setItem(LS_ACTIVE_CAPS_KEY, JSON.stringify(caps));
    } catch { /* ignore */ }

    return agent;
  },

  getAgentById(id) {
    const { primaryAgent, capabilityRegistry } = get();
    if (primaryAgent?.id === id) return primaryAgent;
    return capabilityRegistry.getAllActiveAgents().find((a) => a.id === id);
  },

  loadPersistedAgents() {
    // Restore primary agent
    try {
      const raw = localStorage.getItem(LS_PRIMARY_AGENT_KEY);
      if (raw) {
        const props: AgentProps = JSON.parse(raw);
        const agent = Agent.create(props);
        set({ primaryAgent: agent, isPrimaryAgentSetup: true });
      }
    } catch { /* corrupted */ }

    // Restore activated capabilities
    try {
      const raw = localStorage.getItem(LS_ACTIVE_CAPS_KEY);
      if (raw) {
        const items: Array<{ templateId: string; agentProps: AgentProps }> = JSON.parse(raw);
        let registry = get().capabilityRegistry;
        for (const item of items) {
          const agent = Agent.create(item.agentProps);
          registry = registry.registerAgent(item.templateId, agent);
        }
        set({ capabilityRegistry: registry });
      }
    } catch { /* corrupted */ }
  },

  reset() {
    set({
      primaryAgent: null,
      capabilityRegistry: CapabilityRegistry.createDefault(),
      isPrimaryAgentSetup: false,
      isFirstVisit: !localStorage.getItem(LS_OC_VISITED_KEY),
      sharedAgents: templatesToSharedAgents(DEFAULT_CAPABILITY_TEMPLATES),
    });
  },

  async fetchFromBackend() {
    try {
      const res = await agentApi.listShared();
      if (res.rows && res.rows.length > 0) {
        set({ sharedAgents: res.rows.map(dtoToSharedAgent) });
      }
    } catch {
      // Backend unreachable — keep local data
    }
  },

  invokeAgent(agentId) {
    // Backward compat for IM mode
    const { sharedAgents } = get();
    const idx = sharedAgents.findIndex((a) => a.id === agentId);
    if (idx >= 0) {
      const updated = [...sharedAgents];
      updated[idx] = { ...updated[idx], invokeCount: updated[idx].invokeCount + 1 };
      set({ sharedAgents: updated });
    }
  },
}));
