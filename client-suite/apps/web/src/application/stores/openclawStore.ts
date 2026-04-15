import { create } from 'zustand';
import { AgentRuntime } from '../../domain/agent/AgentRuntime';
import { AgentTask } from '../../domain/agent/AgentTask';
import { CoTMessage } from '../../domain/agent/CoTMessage';
import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';
import { ProjectBoard } from '../../domain/agent/ProjectBoard';
import { DecisionTree } from '../../domain/agent/DecisionTree';
import { CollaborationChain } from '../../domain/agent/CollaborationChain';
import { MockOpenClawDataSource } from '../../infrastructure/mock/MockOpenClawDataSource';
import type { AttentionItem } from '../../domain/agent/DrawerContent';
import { appEvents } from '../events/eventBus';
import { useNotificationStore } from './notificationStore';
import { useAgentStore } from './agentStore';
import { useToastStore } from './toastStore';
import {
  handleSetDiscussingNotificationId,
  handleSetDiscussingDecisionId,
  handleSetDiscussingTaskId,
  handleSetDiscussingGoalId,
} from './openclawDiscussionActions';
import type { OpenClawState, ConversationSession } from './openclawTypes';

export type { MockApp, MockDocument, ProactiveActivity, ProactiveInsight, ConversationSession, OpenClawState } from './openclawTypes';

export const useOpenClawStore = create<OpenClawState>((set, get) => ({
  runtimes: [],
  tasks: [],
  selectedTaskId: null,
  conversations: {},
  activeConversationId: 'primary',
  sessionId: null,
  isSending: false,
  systemHealth: null,
  quickCommands: [],
  proactiveActivities: [],
  proactiveInsights: [],
  decisionTrees: {},
  expandedActivityId: null,
  collaborationChains: [],
  decisionRequests: [],
  goals: [],
  activeGoalId: null,
  apps: [],
  documents: [],
  boards: [],
  drawerContent: null,
  drawerWidth: 360,
  activeSharedAgentId: null,
  activeAttentionItemId: null,
  composerPrefill: null,
  discussingNotificationId: null,
  discussingDecisionId: null,
  discussingTaskId: null,
  discussingGoalId: null,
  attentionItems: [],
  bColumnTaskId: null,
  bColumnGoalId: null,
  bColumnDecisionId: null,
  scrollToMessageId: null,
  conversationSessions: [],
  aColumnTab: 'attention' as const,
  _cleanup: null,

  // ── Drawer actions ──

  openDrawer(content) {
    set({ drawerContent: content });
  },

  closeDrawer() {
    set({ drawerContent: null, activeAttentionItemId: null });
  },

  toggleDrawer() {
    const current = get().drawerContent;
    if (current) {
      set({ drawerContent: null, activeAttentionItemId: null });
    }
  },

  setActiveAttentionItem(id) {
    set({ activeAttentionItemId: id });
  },

  // ── B-column selection ──

  selectBColumnTask(id) {
    set({
      bColumnTaskId: id,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      ...(id ? { selectedTaskId: null } : {}),
    });
    if (id) {
      useNotificationStore.getState().selectNotification(null);
      get().switchConversation(`task-${id}`);
    } else {
      get().switchConversation('primary');
    }
  },

  selectBColumnGoal(id) {
    set({
      bColumnGoalId: id,
      bColumnTaskId: null,
      bColumnDecisionId: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
    });
    if (id) {
      useNotificationStore.getState().selectNotification(null);
      get().switchConversation('primary');
    } else {
      get().switchConversation('primary');
    }
  },

  selectBColumnDecision(id) {
    set({
      bColumnDecisionId: id,
      bColumnTaskId: null,
      bColumnGoalId: null,
    });
    if (id) {
      useNotificationStore.getState().selectNotification(null);
      get().switchConversation('primary');
    } else {
      get().switchConversation('primary');
    }
  },

  // ── Conversation management ──

  switchConversation(id) {
    const convs = get().conversations;
    if (!convs[id]) {
      set({ conversations: { ...convs, [id]: [] }, activeConversationId: id });
    } else {
      set({ activeConversationId: id });
    }
  },

  openDrawerForAttentionItem(itemId) {
    const item = get().attentionItems.find((a) => a.id === itemId);
    if (!item) return;

    set({ activeAttentionItemId: itemId, scrollToMessageId: item.messageId });

    if (item.kind === 'decision' && item.decisionId) {
      set({
        drawerContent: { type: 'decision-detail', title: item.title, data: { decisionId: item.decisionId } },
      });
    } else if (item.kind === 'task' && item.taskId) {
      set({
        drawerContent: { type: 'task-detail', title: item.title, data: { taskId: item.taskId } },
        selectedTaskId: item.taskId,
      });
    } else if (item.notificationId) {
      set({
        drawerContent: { type: 'notification-detail', title: item.title, data: { notificationId: item.notificationId } },
      });
    }
  },

  clearScrollTarget() {
    set({ scrollToMessageId: null });
  },

  // ── Attention items rebuild ──

  rebuildAttentionItems() {
    const notifStore = useNotificationStore.getState();
    const items: AttentionItem[] = [];
    let priority = 0;

    for (const g of get().goals) {
      if (g.status !== 'active' && g.status !== 'paused') continue;
      items.push({
        id: `attn-goal-${g.id}`,
        kind: 'goal',
        title: g.title,
        messageId: '',
        goalId: g.id,
        resolved: false,
        priority: priority++,
        goalProgress: g.overallProgress,
        goalPriority: g.priority,
      });
    }

    for (const d of get().decisionRequests) {
      if (!d.isPending || d.isExpired) continue;
      items.push({
        id: `attn-decision-${d.id}`,
        kind: 'decision',
        title: d.title,
        summary: d.recommendation.label,
        messageId: '',
        decisionId: d.id,
        deadline: d.deadline,
        resolved: false,
        priority: priority++,
      });
    }

    for (const t of get().tasks) {
      if (!t.isActive) continue;
      const runningSubtask = t.subtasks.find(s => s.status === 'running');
      const lastReasoning = t.reasoningSteps?.[t.reasoningSteps.length - 1];
      items.push({
        id: `attn-task-${t.id}`,
        kind: 'task',
        title: t.name,
        messageId: '',
        taskId: t.id,
        resolved: false,
        priority: priority++,
        taskProgress: t.progress,
        taskColor: t.color,
        currentSubtask: runningSubtask?.name,
        reasoningSummary: lastReasoning?.detail,
        taskStatusLabel: t.status === 'running' ? '运行中' : t.status === 'queued' ? '排队中' : undefined,
      });
    }

    for (const t of get().tasks) {
      if (t.isActive) continue;
      items.push({
        id: `attn-task-${t.id}`,
        kind: 'task',
        title: t.name,
        messageId: '',
        taskId: t.id,
        resolved: true,
        priority: priority++,
        taskProgress: t.progress,
        taskColor: t.color,
        taskStatusLabel: t.status === 'completed' ? '已完成' : t.status === 'failed' ? '已停止' : t.status === 'paused' ? '已暂停' : t.status,
      });
    }

    const notifications = notifStore.notifications;
    for (const n of notifications) {
      if (!n.channel || n.channel === 'system') continue;
      items.push({
        id: `attn-notif-${n.id}`,
        kind: 'notification' as const,
        title: n.title,
        summary: n.body,
        messageId: '',
        notificationId: n.id,
        channel: n.channel,
        priority: priority++,
        resolved: n.isAutoHandled,
        isNeedsHuman: n.isNeedsHuman,
        timestamp: n.timestamp ? new Date(n.timestamp).getTime() : 0,
      });
    }

    set({ attentionItems: items });
  },

  setDrawerWidth(width) {
    set({ drawerWidth: Math.max(280, Math.min(600, width)) });
  },

  // ── Runtime/Task CRUD ──

  setRuntimes(runtimes) {
    set({ runtimes });
  },

  updateRuntime(agentId, updater) {
    set({
      runtimes: get().runtimes.map((r) =>
        r.agentId === agentId ? updater(r) : r,
      ),
    });
  },

  setTasks(tasks) {
    set({ tasks });
  },

  updateTask(taskId, updater) {
    set({
      tasks: get().tasks.map((t) =>
        t.id === taskId ? updater(t) : t,
      ),
    });
    get().rebuildAttentionItems();
  },

  selectTask(taskId) {
    set({ selectedTaskId: taskId });
  },

  appendMessage(msg) {
    const id = get().activeConversationId;
    const now = Date.now();
    const sessions = get().conversationSessions;
    const hasSession = sessions.some((s) => s.id === id);

    let updatedSessions: ConversationSession[];
    if (hasSession) {
      updatedSessions = sessions.map((s) =>
        s.id === id ? { ...s, lastMessageAt: now, messageCount: s.messageCount + 1 } : s,
      );
    } else {
      let title = '对话';
      if (id.startsWith('discuss-decision-')) {
        const decId = id.replace('discuss-decision-', '');
        const dec = get().decisionRequests.find((d) => d.id === decId);
        title = dec ? `决策 · ${dec.title}` : '决策讨论';
      } else if (id.startsWith('discuss-')) {
        const notifId = id.replace('discuss-', '');
        const notif = useNotificationStore.getState().notifications.find((n) => n.id === notifId);
        title = notif ? `${notif.sender.name}: ${notif.title}` : '消息讨论';
      } else if (id.startsWith('task-')) {
        const taskId = id.replace('task-', '');
        const task = get().tasks.find((t) => t.id === taskId);
        title = task ? `任务 · ${task.name}` : '任务讨论';
      } else if (id.startsWith('goal-')) {
        const goalId = id.replace('goal-', '');
        const goal = get().goals.find((g) => g.id === goalId);
        title = goal ? `目标 · ${goal.title}` : '目标讨论';
      } else if (id === 'primary') {
        title = '主对话';
      }
      const newSession: ConversationSession = {
        id,
        title,
        createdAt: now,
        lastMessageAt: now,
        messageCount: 1,
        type: id === 'primary' ? 'primary' : id.startsWith('shared-') ? 'shared' : 'discussion',
      };
      updatedSessions = [newSession, ...sessions];
    }

    set({
      conversations: {
        ...get().conversations,
        [id]: [...(get().conversations[id] ?? []), msg],
      },
      conversationSessions: updatedSessions,
    });
    get().rebuildAttentionItems();
  },

  updateLastMessage(updater) {
    const id = get().activeConversationId;
    const conv = get().conversations[id] ?? [];
    if (conv.length === 0) return;
    const updated = [...conv];
    updated[updated.length - 1] = updater(updated[updated.length - 1]);
    set({
      conversations: { ...get().conversations, [id]: updated },
    });
    get().rebuildAttentionItems();
  },

  setIsSending(v) {
    set({ isSending: v });
  },

  setSystemHealth(health) {
    set({ systemHealth: health });
  },

  // ── Decision Tree actions ──

  expandActivity(activityId) {
    const current = get().expandedActivityId;
    set({ expandedActivityId: current === activityId ? null : activityId });
  },

  executeFollowUp(activityId, actionId) {
    const tree = get().decisionTrees[activityId];
    if (!tree) return;
    const action = tree.followUpActions.find((a) => a.id === actionId);
    if (!action) return;
    useToastStore.getState().addToast(`正在执行: ${action.label}`, 'info');
  },

  // ── Workflow intervention actions ──

  pauseTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canPause) return;
    get().updateTask(taskId, (t) => t.pause());
    useToastStore.getState().addToast(`已暂停任务: ${task.name}`, 'info');
  },

  resumeTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canResume) return;
    get().updateTask(taskId, (t) => t.resume());
    useToastStore.getState().addToast(`已恢复任务: ${task.name}`, 'info');
  },

  cancelTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canCancel) return;
    get().updateTask(taskId, (t) => t.cancel());
    useToastStore.getState().addToast(`已停止任务: ${task.name}`, 'error');
    appEvents.emit('agent:task-updated', { taskId, progress: task.progress, status: 'failed' });
  },

  // ── Decision requests ──

  addDecisionRequest(request) {
    set({ decisionRequests: [request, ...get().decisionRequests] });
    appEvents.emit('decision:created', { decisionId: request.id, agentId: request.agentId, urgency: request.urgency });
    get().rebuildAttentionItems();
  },

  respondToDecision(decisionId, updater) {
    set({
      decisionRequests: get().decisionRequests.map((d) =>
        d.id === decisionId ? updater(d) : d,
      ),
    });
    const updated = get().decisionRequests.find((d) => d.id === decisionId);
    if (updated) {
      appEvents.emit('decision:responded', { decisionId, response: updated.responseStatus });
    }
    get().rebuildAttentionItems();
  },

  respondDecision(decisionId: string, action: 'accept' | 'modify' | 'decline' | 'defer', params?: {
    feedback?: string;
    optionId?: string;
    deferUntil?: number;
  }) {
    const decision = get().decisionRequests.find((d) => d.id === decisionId);
    if (!decision) {
      console.error(`[OpenClawStore] Decision not found: ${decisionId}`);
      return;
    }

    let updatedDecision = decision;

    switch (action) {
      case 'accept':
        updatedDecision = decision.accept();
        break;
      case 'modify':
        updatedDecision = decision.modify(
          params?.optionId ?? decision.recommendation.id,
          params?.feedback ?? ''
        );
        break;
      case 'decline':
        updatedDecision = decision.decline(params?.feedback ?? '');
        break;
      case 'defer':
        updatedDecision = decision.defer(
          params?.deferUntil ?? Date.now() + 2 * 60 * 60 * 1000
        );
        break;
    }

    set({
      decisionRequests: get().decisionRequests.map((d) =>
        d.id === decisionId ? updatedDecision : d,
      ),
    });

    appEvents.emit('decision:responded', { decisionId, response: updatedDecision.responseStatus });

    const extra = (updatedDecision as any).extra as Record<string, unknown> | undefined;
    if (extra?.goalId) {
      const goal = get().goals.find((g) => g.id === extra.goalId);
      if (goal) {
        const updatedGoal = goal.linkDecision(decisionId);
        set({
          goals: get().goals.map((g) =>
            g.id === extra.goalId ? updatedGoal : g
          ),
        });
      }
    }

    get().rebuildAttentionItems();

    const toastStore = useToastStore.getState();
    const actionLabels: Record<string, string> = {
      accept: '已采纳',
      modify: '已修改',
      decline: '已拒绝',
      defer: '已延后'
    };
    toastStore.addToast(`${actionLabels[action]}: ${decision.title}`, 'success');
  },

  // ── Goals ──

  addGoal(goal) {
    set({ goals: [...get().goals, goal] });
  },

  updateGoal(goalId, updater) {
    set({
      goals: get().goals.map((g) =>
        g.id === goalId ? updater(g) : g,
      ),
    });
  },

  setActiveGoal(goalId) {
    set({ activeGoalId: goalId });
  },

  addApp(app) {
    set({ apps: [...get().apps, app] });
  },
  updateApp(appId, updater) {
    set({ apps: get().apps.map((a) => a.id === appId ? updater(a) : a) });
  },
  addDocument(doc) {
    set({ documents: [...get().documents, doc] });
  },
  updateDocument(docId, updater) {
    set({ documents: get().documents.map((d) => d.id === docId ? updater(d) : d) });
  },
  addBoard(board) {
    set({ boards: [...get().boards, board] });
  },
  updateBoard(boardId, updater) {
    set({ boards: get().boards.map((b) => b.id === boardId ? updater(b) : b) });
  },

  // ── Shared Agent direct chat ──

  startSharedAgentChat(agentId) {
    const sessionId = `session-${Date.now()}`;
    set({ activeSharedAgentId: agentId, sessionId, bColumnTaskId: null, discussingTaskId: null, discussingGoalId: null });
    get().switchConversation(`shared-${agentId}`);
  },

  returnToPrimaryAgent() {
    const sessionId = `session-${Date.now()}`;
    set({ activeSharedAgentId: null, sessionId });
    get().switchConversation('primary');
  },

  setComposerPrefill(text) {
    set({ composerPrefill: text });
  },

  // ── Discussion actions (delegated) ──

  setDiscussingNotificationId(id) {
    handleSetDiscussingNotificationId(id, set, get);
  },

  setDiscussingDecisionId(id) {
    handleSetDiscussingDecisionId(id, set, get);
  },

  setDiscussingTaskId(id) {
    handleSetDiscussingTaskId(id, set, get);
  },

  setDiscussingGoalId(id) {
    handleSetDiscussingGoalId(id, set, get);
  },

  returnToHome() {
    set({
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    useNotificationStore.getState().selectNotification(null);
  },

  setAColumnTab(tab) {
    set({ aColumnTab: tab });
  },

  createNewConversation(title) {
    const now = Date.now();
    const id = `conv-${now}`;
    const session: ConversationSession = {
      id,
      title: title || `对话 ${new Date(now).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      type: 'primary',
    };
    set({
      conversations: { ...get().conversations, [id]: [] },
      conversationSessions: [session, ...get().conversationSessions],
      activeConversationId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
    });
    useNotificationStore.getState().selectNotification(null);
  },

  switchToSession(sessionId) {
    const session = get().conversationSessions.find((s) => s.id === sessionId);
    if (!session) return;
    set({
      activeConversationId: sessionId,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
    });
    useNotificationStore.getState().selectNotification(null);
  },

  initConversation() {
    if (get().sessionId) return;
    const sessionId = `session-${Date.now()}`;
    const now = Date.now();
    const primarySession: ConversationSession = {
      id: 'primary',
      title: '主对话',
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      type: 'primary',
    };
    set({
      sessionId,
      conversations: { primary: [] },
      activeConversationId: 'primary',
      conversationSessions: [primarySession],
    });
  },

  async initialize() {
    if (get().runtimes.length > 0) return;

    const templates = useAgentStore.getState().capabilityRegistry.getAvailableTemplates();
    const runtimes = MockOpenClawDataSource.createRuntimesFromTemplates(templates);
    const tasks = MockOpenClawDataSource.createTasks();
    const systemHealth = MockOpenClawDataSource.createSystemHealth(runtimes);
    const quickCommands = MockOpenClawDataSource.getQuickCommands();
    const proactiveActivities = MockOpenClawDataSource.getProactiveActivities();
    const proactiveInsights = MockOpenClawDataSource.getProactiveInsights();
    const collaborationChains = MockOpenClawDataSource.getCollaborationChains();
    const decisionRequests = MockOpenClawDataSource.createDecisionRequests();
    const goals = MockOpenClawDataSource.getDefaultGoals();
    const activeGoalId = goals.find((g) => g.status === 'active')?.id ?? null;

    const treesArray = MockOpenClawDataSource.getDecisionTrees();
    const decisionTrees: Record<string, DecisionTree> = {};
    for (const t of treesArray) {
      decisionTrees[t.activityId] = t;
    }

    set({
      runtimes, tasks, systemHealth, quickCommands,
      proactiveActivities, proactiveInsights, decisionTrees, collaborationChains, decisionRequests, goals, activeGoalId,
    });

    const notifStore = useNotificationStore.getState();
    for (const dr of decisionRequests) {
      if (dr.responseStatus === 'pending') {
        notifStore.mergeCrossChannelNotifications([{
          id: `notif-dec-${dr.id}`,
          type: 'decision' as const,
          title: dr.title,
          body: dr.recommendation.label,
          timestamp: new Date(dr.createdAt).toISOString(),
          read: false,
          sender: { name: '数字员工' },
          decisionId: dr.id,
        }]);
      }
    }

    const taskCleanup = MockOpenClawDataSource.simulateTaskProgress((taskId, progress) => {
      const task = get().tasks.find(t => t.id === taskId);
      if (!task || task.status === 'paused') return;
      get().updateTask(taskId, (t) => {
        const updated = t.withProgress(progress);
        if (progress >= 100 && t.progress < 100) {
          useNotificationStore.getState().addCompletionNotification(taskId, t.name);
          appEvents.emit('agent:task-updated', { taskId, progress: 100, status: 'completed' });
        }
        return updated;
      });
    });

    const chainCleanup = MockOpenClawDataSource.simulateChainProgress((chainId, nodeId, status) => {
      set({
        collaborationChains: get().collaborationChains.map((c) => {
          if (c.id !== chainId) return c;
          const updated = c.withNodeStatus(nodeId, status);
          const allDone = updated.nodes.every((n) => n.status === 'completed');
          return allDone ? updated.withStatus('completed') : updated;
        }),
      });
    });

    const cleanup = () => { taskCleanup(); chainCleanup(); };
    set({ _cleanup: cleanup });

    useNotificationStore.getState().mergeCrossChannelNotifications(
      MockOpenClawDataSource.createCrossChannelNotifications()
    );

    get().switchConversation('primary');
    get().rebuildAttentionItems();
  },

  reset() {
    const cleanup = get()._cleanup;
    if (cleanup) cleanup();
    set({
      runtimes: [],
      tasks: [],
      selectedTaskId: null,
      conversations: {},
      activeConversationId: 'primary',
      sessionId: null,
      isSending: false,
      systemHealth: null,
      quickCommands: [],
      proactiveActivities: [],
      proactiveInsights: [],
      decisionTrees: {},
      expandedActivityId: null,
      collaborationChains: [],
      goals: [],
      activeGoalId: null,
      apps: [],
      documents: [],
      drawerContent: null,
      drawerWidth: 360,
      activeSharedAgentId: null,
      activeAttentionItemId: null,
      composerPrefill: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      attentionItems: [],
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      scrollToMessageId: null,
      conversationSessions: [],
      aColumnTab: 'attention' as const,
      _cleanup: null,
    });
  },
}));
