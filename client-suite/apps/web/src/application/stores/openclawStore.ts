import { create } from 'zustand';
import { AgentRuntime } from '../../domain/agent/AgentRuntime';
import { AgentTask } from '../../domain/agent/AgentTask';
import { CoTMessage } from '../../domain/agent/CoTMessage';
import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';
import { SystemHealthSnapshot } from '../../domain/agent/AgentOrchestrationService';
import { DecisionTree } from '../../domain/agent/DecisionTree';
import { CollaborationChain } from '../../domain/agent/CollaborationChain';
import { MockOpenClawDataSource } from '../../infrastructure/mock/MockOpenClawDataSource';
import type { OpenClawDrawerContent } from '../../domain/agent/DrawerContent';
import type { AttentionItem, AttentionItemKind } from '../../domain/agent/DrawerContent';
import type { MessageBlock, SuggestedActionsBlock } from '../../domain/agent/MessageBlock';
import { appEvents } from '../events/eventBus';
import { useNotificationStore } from './notificationStore';
import { useAgentStore } from './agentStore';
import { useToastStore } from './toastStore';
import type { Notification } from '../../domain/notification/Notification';
import type { CoTStep } from '../../domain/agent/CoTMessage';

// ── 深度讨论分析：综合通知上下文 + 进行中任务生成 Agent 回复 ──

interface DiscussionResponse {
  text: string;
  html?: string;
  cotSteps: CoTStep[];
  blocks: MessageBlock[];
}

/**
 * 综合通知内容、外部对话历史、Agent 原始分析、进行中任务，
 * 生成一条包含完整现状总结 + 风险评估 + 行动建议的 Agent 回复。
 */
function buildDeepDiscussionResponse(
  notification: Notification,
  channelLabel: string,
  activeTasks: AgentTask[],
  now: number,
): DiscussionResponse {
  const ctx = notification.contextMessages ?? [];
  const reaction = notification.agentReaction;
  const originalReasoning = reaction?.reasoningSteps ?? [];
  const isEmail = notification.channel === 'email';

  // ── 1. 梳理外部对话脉络（从 contextMessages 提取关键节点）──
  const ownMessages = ctx.filter((m) => m.isOwn);
  const externalMessages = ctx.filter((m) => !m.isOwn);
  const lastOwnMsg = ownMessages[ownMessages.length - 1];
  const recentExternalTrend = externalMessages.length >= 2
    ? `对方近期频率较高（${externalMessages.length} 条消息），注意响应及时性`
    : '';

  // ── 2. 任务全景扫描 ──
  const taskSummary: string[] = [];
  const runningSubtasks: string[] = [];
  const warnLogs: string[] = [];

  for (const task of activeTasks) {
    const subtaskDone = task.subtasks.filter((s) => s.status === 'success').length;
    const subtaskRunning = task.subtasks.find((s) => s.status === 'running');
    const subtaskPending = task.subtasks.filter((s) => s.status === 'pending').length;

    taskSummary.push(
      `${task.name}：进度 ${task.progress}%（${subtaskDone}/${task.subtasks.length} 子任务完成${subtaskPending > 0 ? `，${subtaskPending} 待执行` : ''}）`,
    );

    if (subtaskRunning) {
      runningSubtasks.push(`${task.name} 正在执行「${subtaskRunning.name}」`);
    }

    const warnings = task.logs.filter((l) => l.level === 'WARN' || l.level === 'ERROR');
    for (const w of warnings) {
      warnLogs.push(`[${task.name}] ${w.message}`);
    }
  }

  // ── 3. 关键词关联分析（通知内容 ↔ 任务名称）──
  const notificationKeywords = extractKeywords(notification.body + ' ' + (notification.title ?? ''));
  const relatedTasks: string[] = [];
  for (const task of activeTasks) {
    const taskKeywords = extractKeywords(task.name + ' ' + task.subtasks.map((s) => s.name).join(' '));
    const overlap = notificationKeywords.filter((k) => taskKeywords.includes(k));
    if (overlap.length > 0) {
      relatedTasks.push(`${task.name}（关联关键词：${overlap.join('、')}）`);
    }
  }

  // ── 4. 构建 CoT 推理链 ──
  const cotSteps: CoTStep[] = [];
  const step = (label: string, detail: string) =>
    cotSteps.push({ id: `cs-${now}-${cotSteps.length + 1}`, label, status: 'done' as const, detail });

  if (isEmail) {
    // 邮件专属推理链
    const subject = notification.title.replace(/^Email\s*·\s*/, '');
    const toField = notification.emailMeta?.to ?? '';
    const ccField = notification.emailMeta?.cc ?? '';

    step(
      '邮件解析',
      `主题: ${subject}，发件人: ${notification.sender.name}` +
      (toField ? `，收件人: ${toField}` : '') +
      (ccField ? `，抄送: ${ccField}` : '') +
      (ctx.length > 0 ? `，邮件往来: ${ctx.length} 封历史邮件` : '，独立邮件无历史往来'),
    );

    step(
      '意图识别',
      `邮件内容分析：${notification.body.slice(0, 80)}${notification.body.length > 80 ? '…' : ''}` +
      (reaction?.summary ? `\nAgent 判断：${reaction.summary}` : ''),
    );

    step(
      '回复策略评估',
      reaction?.draftReply
        ? 'Agent 已生成回复草稿，可基于草稿进行修改后直接发送'
        : '尚未生成回复草稿，需要根据邮件意图和上下文草拟回复',
    );

    if (activeTasks.length > 0) {
      step(
        '任务关联检查',
        `当前 ${activeTasks.length} 个进行中任务：${taskSummary.join('；')}` +
        (relatedTasks.length > 0 ? `\n邮件与以下任务相关：${relatedTasks.join('；')}` : '\n邮件与当前任务无直接关联'),
      );
    }

    step(
      '回复建议',
      '你可以告诉我：\n' +
      '- "直接发送草稿" — 采纳 Agent 建议的回复\n' +
      '- "修改回复，加上…" — 在草稿基础上调整\n' +
      '- "用更正式的语气重写" — 调整回复风格\n' +
      '- "转发给张总" — 转发邮件并附加说明',
    );
  } else {
    // 非邮件通用推理链（原有逻辑）
    // Step 1: 信息收集与事件定级
    step(
      '信息收集与事件定级',
      `来源: ${channelLabel}(${notification.sender.name})，类型: ${notification.type}，` +
      `对话上下文: ${ctx.length} 条历史消息，` +
      `Agent 原始判断: ${reaction?.summary ?? '未分析'}` +
      (reaction?.confidence ? `，置信度: ${reaction.confidence}` : '') +
      (notification.isNeedsHuman ? '，标记为待处理' : ''),
    );

    // Step 2: 外部对话脉络梳理
    const threadSummary = ctx.length > 0
      ? `完整对话线 ${ctx.length} 条：${notification.sender.name} 发起 → 你方 ${ownMessages.length} 次回复 → 当前等待处理。${recentExternalTrend}`
      : '无历史对话上下文，按独立事件处理。';
    step('对话脉络梳理', threadSummary);

    // Step 3: 任务全景评估
    step(
      '任务全景评估',
      activeTasks.length > 0
        ? `当前 ${activeTasks.length} 个进行中任务：${taskSummary.join('；')}`
        : '当前无进行中任务，可全力处理此事件。',
    );

    // Step 4: 关联分析
    if (relatedTasks.length > 0) {
      step(
        '关联分析',
        `事件内容与以下进行中任务存在关联：${relatedTasks.join('；')}。处理此事件可能影响关联任务进度或优先级。`,
      );
    } else if (activeTasks.length > 0) {
      step(
        '关联分析',
        `事件内容与当前进行中任务无直接关键词关联，但需评估是否需要调整任务优先级。`,
      );
    }

    // Step 5: 风险与阻塞点
    const riskParts: string[] = [];
    if (warnLogs.length > 0) {
      riskParts.push(`进行中任务告警: ${warnLogs.join('；')}`);
    }
    if (runningSubtasks.length > 0) {
      riskParts.push(`正在执行的关键子任务: ${runningSubtasks.join('；')}`);
    }
    if (notification.isNeedsHuman) {
      riskParts.push('此事件需要人工决策，不宜自动处理');
    }
    if (reaction?.confidence === 'low') {
      riskParts.push('Agent 置信度较低，建议人工复核');
    }
    step(
      '风险与阻塞点',
      riskParts.length > 0
        ? riskParts.join('；')
        : '当前未识别到显著风险点。',
    );

    // Step 6: 综合研判与行动建议
    if (originalReasoning.length > 0) {
      step(
        '综合研判',
        `基于 ${originalReasoning.length} 步原始分析：${originalReasoning.map((r) => `[${r.label}] ${r.detail}`).join(' → ')}`,
      );
    }
  }

  // ── 5. 构建回复文本 ──
  const blocks: MessageBlock[] = [];
  const suggestedActions = reaction?.suggestedActions ?? [];
  const parts: string[] = [];

  if (isEmail) {
    const subject = notification.title.replace(/^Email\s*·\s*/, '');
    const emailDate = notification.timestamp
      ? new Date(notification.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';

    // ── 邮件：以 HTML 格式渲染分析文本，blocks 放邮件草稿卡片 ──
    const htmlParts: string[] = [];

    htmlParts.push(`<p style="font-weight:600;color:#94a3b8;font-size:11px;margin:0 0 8px">邮件分析</p>`);
    htmlParts.push(`<div style="font-size:12px;color:#cbd5e1;line-height:1.6">`);
    htmlParts.push(`主题：<strong>${subject}</strong><br/>`);
    htmlParts.push(`发件人：${notification.sender.name}`);
    if (notification.emailMeta?.to) htmlParts.push(`<br/>收件人：${notification.emailMeta.to}`);
    htmlParts.push(`</div>`);

    if (reaction?.summary) {
      htmlParts.push(`<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:8px 0">Agent 判断：${escapeHtml(reaction.summary)}</p>`);
    }

    if (activeTasks.length > 0) {
      htmlParts.push(`<p style="font-weight:600;color:#94a3b8;font-size:11px;margin:8px 0 4px">相关任务</p>`);
      htmlParts.push(`<ul style="margin:0;padding-left:16px;font-size:11px;color:#cbd5e1;line-height:1.8">`);
      for (const s of taskSummary) htmlParts.push(`<li>${escapeHtml(s)}</li>`);
      htmlParts.push(`</ul>`);
    }

    htmlParts.push(`<p style="font-size:11px;color:#64748b;margin:8px 0 0">你可以直接告诉我需要怎样调整回复，我会帮你重新草拟。</p>`);

    // 邮件草稿作为 block 渲染
    if (reaction?.draftReply) {
      const emailBlock: MessageBlock = {
        type: 'email-draft',
        from: '我',
        to: notification.sender.name,
        subject: `Re: ${subject}`,
        date: emailDate,
        body: reaction.draftReply,
      };
      blocks.push(emailBlock);
    }

    const textForFallback = parts.join('\n');
    return {
      text: textForFallback || htmlParts.join('\n'),
      html: htmlParts.join('\n'),
      cotSteps,
      blocks,
    };
  } else {
    // 通用回复格式（原有逻辑）
    parts.push(`**现状总结**`);
    parts.push(
      `${notification.sender.name}(${channelLabel})：${notification.body}` +
      (lastOwnMsg ? `\n上次回复：${lastOwnMsg.body}` : ''),
    );
    parts.push('');

    if (activeTasks.length > 0) {
      parts.push(`**当前任务状态**`);
      parts.push(taskSummary.map((s) => `- ${s}`).join('\n'));
      if (runningSubtasks.length > 0) {
        parts.push(`正在执行：${runningSubtasks.join('、')}`);
      }
      parts.push('');
    }

    if (relatedTasks.length > 0) {
      parts.push(`**关联任务**`);
      parts.push(relatedTasks.map((r) => `- ${r}`).join('\n'));
      parts.push('');
    }

    const riskParts2: string[] = [];
    if (warnLogs.length > 0) riskParts2.push(`进行中任务告警: ${warnLogs.join('；')}`);
    if (runningSubtasks.length > 0) riskParts2.push(`正在执行的关键子任务: ${runningSubtasks.join('；')}`);
    if (notification.isNeedsHuman) riskParts2.push('此事件需要人工决策，不宜自动处理');
    if (reaction?.confidence === 'low') riskParts2.push('Agent 置信度较低，建议人工复核');
    if (riskParts2.length > 0) {
      parts.push(`**风险提示**`);
      parts.push(riskParts2.map((r) => `- ${r}`).join('\n'));
      parts.push('');
    }

    if (reaction?.draftReply) {
      parts.push(`**建议回复**`);
      parts.push(reaction.draftReply);
      parts.push('');
    }

    if (reaction?.summary) {
      parts.push(`*Agent 分析：${reaction.summary}*`);
    }
  }

  // ── 6. 构建 blocks（建议操作，仅非邮件类型） ──
  if (!isEmail && suggestedActions.length > 0) {
    const actionBlock: SuggestedActionsBlock = {
      type: 'suggested-actions',
      title: '建议操作',
      actions: suggestedActions.map((a) => ({
        id: a.id,
        icon: a.icon,
        label: a.label,
        command: a.command,
      })),
    };

    // 如果有关联任务，追加任务相关操作
    if (relatedTasks.length > 0) {
      for (const task of activeTasks) {
        const taskKeywords = extractKeywords(task.name + ' ' + task.subtasks.map((s) => s.name).join(' '));
        const overlap = notificationKeywords.filter((k) => taskKeywords.includes(k));
        if (overlap.length > 0) {
          actionBlock.actions.push({
            id: `sa-task-${task.id}`,
            icon: 'engineering',
            label: `查看 ${task.name}`,
            command: `查看任务「${task.name}」的详细进度和推理过程`,
          });
        }
      }
    }

    blocks.push(actionBlock);
  }

  return {
    text: parts.join('\n'),
    cotSteps,
    blocks,
  };
}

/** 简易中文关键词提取（去停用词、分词） */
function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
    '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会',
    '着', '没有', '看', '好', '自己', '这', '他', '吗', '可以', '已',
    '这个', '什么', '吗', '请', '对', '把', '还', '没', '能', '吧',
  ]);
  return [...new Set(
    text
      .replace(/[^\u4e00-\u9fff\w]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w)),
  )];
}

/** 简易 HTML 转义 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ProactiveActivity {
  id: string;
  icon: string;
  iconColor: string;
  action: string;
  detail: string;
  time: string;
  category: 'autonomous' | 'monitoring' | 'insight';
}

export interface ProactiveInsight {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'success';
}

interface OpenClawState {
  runtimes: AgentRuntime[];
  tasks: AgentTask[];
  selectedTaskId: string | null;
  /** 按上下文隔离的对话存储，key: 'primary' | 'task-<id>' | 'shared-<id>' */
  conversations: Record<string, CoTMessage[]>;
  /** 当前活跃的对话上下文 ID */
  activeConversationId: string;
  sessionId: string | null;
  isSending: boolean;
  systemHealth: SystemHealthSnapshot | null;
  quickCommands: Array<{ id: string; icon: string; label: string; desc: string }>;
  proactiveActivities: ProactiveActivity[];
  proactiveInsights: ProactiveInsight[];
  decisionTrees: Record<string, DecisionTree>;
  expandedActivityId: string | null;
  collaborationChains: CollaborationChain[];
  decisionRequests: DecisionRequest[];
  goals: UserGoal[];
  activeGoalId: string | null;
  drawerContent: OpenClawDrawerContent | null;
  drawerWidth: number;
  activeSharedAgentId: string | null;
  activeAttentionItemId: string | null;
  composerPrefill: string | null;
  /** C 栏正在讨论的通知 ID（非 null 时 C 栏显示事件上下文而非聊天） */
  discussingNotificationId: string | null;
  /** C 栏正在讨论的决策 ID（非 null 时 C 栏显示决策上下文） */
  discussingDecisionId: string | null;
  /** C 栏正在讨论的任务 ID（非 null 时 C 栏显示任务上下文） */
  discussingTaskId: string | null;
  /** C 栏正在讨论的目标 ID（非 null 时 C 栏显示目标上下文） */
  discussingGoalId: string | null;
  /** 派生自对话 blocks + 外部通知 */
  attentionItems: AttentionItem[];
  /** B 栏当前展示的任务 ID（与 selectedNotificationId 互斥） */
  bColumnTaskId: string | null;
  /** B 栏当前展示的目标 ID */
  bColumnGoalId: string | null;
  /** B 栏当前展示的决策 ID */
  bColumnDecisionId: string | null;
  /** 中栏需要滚动到的消息 ID */
  scrollToMessageId: string | null;
  _cleanup: (() => void) | null;

  openDrawer(content: OpenClawDrawerContent): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setDrawerWidth(width: number): void;
  setActiveAttentionItem(id: string | null): void;
  selectBColumnTask(id: string | null): void;
  selectBColumnGoal(id: string | null): void;
  selectBColumnDecision(id: string | null): void;
  /** 切换活跃对话上下文，自动创建空对话 */
  switchConversation(id: string): void;
  openDrawerForAttentionItem(itemId: string): void;
  clearScrollTarget(): void;
  rebuildAttentionItems(): void;
  setRuntimes(runtimes: AgentRuntime[]): void;
  updateRuntime(agentId: string, updater: (r: AgentRuntime) => AgentRuntime): void;
  setTasks(tasks: AgentTask[]): void;
  updateTask(taskId: string, updater: (t: AgentTask) => AgentTask): void;
  selectTask(taskId: string | null): void;
  appendMessage(msg: CoTMessage): void;
  updateLastMessage(updater: (m: CoTMessage) => CoTMessage): void;
  setIsSending(v: boolean): void;
  setSystemHealth(health: SystemHealthSnapshot): void;
  expandActivity(activityId: string | null): void;
  executeFollowUp(activityId: string, actionId: string): void;
  pauseTask(taskId: string): void;
  resumeTask(taskId: string): void;
  cancelTask(taskId: string): void;
  addDecisionRequest(request: DecisionRequest): void;
  respondToDecision(decisionId: string, updater: (d: DecisionRequest) => DecisionRequest): void;
  addGoal(goal: UserGoal): void;
  updateGoal(goalId: string, updater: (g: UserGoal) => UserGoal): void;
  setActiveGoal(goalId: string | null): void;
  startSharedAgentChat(agentId: string): void;
  returnToPrimaryAgent(): void;
  setComposerPrefill(text: string | null): void;
  setDiscussingNotificationId(id: string | null): void;
  setDiscussingDecisionId(id: string | null): void;
  setDiscussingTaskId(id: string | null): void;
  setDiscussingGoalId(id: string | null): void;
  initConversation(): void;
  initialize(): Promise<void>;
  reset(): void;
}

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
  _cleanup: null,

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

    // Set scroll target for center column
    set({ activeAttentionItemId: itemId, scrollToMessageId: item.messageId });

    // Open appropriate drawer content based on item kind
    if (item.kind === 'decision' && item.decisionId) {
      set({
        drawerContent: { type: 'decision-detail', title: item.title, data: { decisionId: item.decisionId } },
      });
    } else if (item.kind === 'task' && item.taskId) {
      const task = get().tasks.find((t) => t.id === item.taskId);
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

  /** Called by center column after scrolling to clear the target */
  clearScrollTarget() {
    set({ scrollToMessageId: null });
  },

  /** Rebuild attentionItems from active tasks + external notifications.
   *  Active tasks appear first (higher priority), then notifications. */
  rebuildAttentionItems() {
    const notifStore = useNotificationStore.getState();
    const items: AttentionItem[] = [];
    let priority = 0;

    // 0. Active goals — 最高优先级（战略层）
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

    // 0.5 Pending decisions — 高优先级（需要人判断）
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

    // 1. Active tasks (running/queued) — 高优先级
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

    // 2. Completed/failed tasks — 归档（低优先级）
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

    // 3. External cross-channel notifications (skip system/internal ones without channel)
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
      });
    }

    set({ attentionItems: items });
  },

  setDrawerWidth(width) {
    set({ drawerWidth: Math.max(280, Math.min(600, width)) });
  },

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
    set({
      conversations: {
        ...get().conversations,
        [id]: [...(get().conversations[id] ?? []), msg],
      },
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

  setDiscussingNotificationId(id) {
    const store = get();

    if (!id) {
      // 关闭讨论，切回 primary 对话
      set({
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: 'primary',
      });
      useNotificationStore.getState().selectNotification(null);
      return;
    }

    const notification = useNotificationStore.getState().notifications.find((n) => n.id === id);
    if (!notification) return;

    // 同步 B 栏选中状态（驱动 EventDetailPanel）
    useNotificationStore.getState().selectNotification(id);

    const convId = `discuss-${id}`;

    // 如果已经有该通知的讨论对话，直接切换过去，不重复注入
    if (store.conversations[convId]?.length > 0) {
      set({
        discussingNotificationId: id,
        discussingDecisionId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: convId,
      });
      return;
    }

    // ── 一次性准备所有状态变更 ──
    const sessionId = store.sessionId ?? '';
    const now = Date.now();
    const channelLabel: Record<string, string> = {
      lark: '飞书', email: '邮件', slack: 'Slack',
      matrix: 'Matrix', wechat: '微信', teams: 'Teams',
    };
    const ch = channelLabel[notification.channel ?? ''] ?? notification.channel ?? '';
    const ctxMessages = notification.contextMessages ?? [];
    const activeTasks = store.tasks.filter((t) => t.isActive);

    // 构建用户消息
    const isEmail = notification.channel === 'email';
    const userSummaryParts: string[] = [];
    if (isEmail) {
      const subject = notification.title.replace(/^Email\s*·\s*/, '');
      userSummaryParts.push(`邮件主题：${subject}`);
      userSummaryParts.push(`发件人：${notification.sender.name}`);
      if (notification.emailMeta?.to) userSummaryParts.push(`收件人：${notification.emailMeta.to}`);
      if (notification.emailMeta?.cc) userSummaryParts.push(`抄送：${notification.emailMeta.cc}`);
      userSummaryParts.push(`邮件正文：${notification.body}`);
      if (ctxMessages.length > 0) userSummaryParts.push(`邮件往来历史 ${ctxMessages.length} 条`);
    } else {
      userSummaryParts.push(`来自 ${ch}(${notification.sender.name})：${notification.body}`);
      if (ctxMessages.length > 0) userSummaryParts.push(`相关对话 ${ctxMessages.length} 条`);
    }
    const userPrompt = isEmail
      ? `帮我分析这封邮件并草拟回复：\n${userSummaryParts.join('\n')}`
      : `帮我分析这条外部消息并给出处理建议：\n${userSummaryParts.join('\n')}`;
    const userMsg = CoTMessage.create({
      id: `discuss-user-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'user',
      text: userPrompt,
      timestamp: now,
    });

    // Agent 深度分析
    const analysis = buildDeepDiscussionResponse(notification, ch, activeTasks, now);

    const botMsg = CoTMessage.create({
      id: `discuss-agent-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'agent',
      text: analysis.text,
      html: analysis.html,
      timestamp: now + 1,
      cotSteps: analysis.cotSteps,
      blocks: analysis.blocks,
    });

    // 单次 set() 完成所有状态变更
    set({
      activeConversationId: convId,
      conversations: {
        ...store.conversations,
        [convId]: [userMsg, botMsg],
      },
      discussingNotificationId: id,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
    });

    // 重建 attentionItems（包含 goals + decisions + tasks + notifications）
    get().rebuildAttentionItems();
  },

  setDiscussingDecisionId(id) {
    if (!id) {
      set({ discussingDecisionId: null, discussingTaskId: null, discussingGoalId: null, bColumnTaskId: null, bColumnGoalId: null, composerPrefill: null, activeConversationId: 'primary' });
      return;
    }

    const decision = get().decisionRequests.find((d) => d.id === id);
    if (!decision) return;

    const store = get();
    const convId = `discuss-decision-${id}`;
    const sessionId = store.sessionId ?? '';
    const now = Date.now();

    // 如果已有该决策的讨论对话，直接切换
    if (store.conversations[convId]?.length > 0) {
      set({
        discussingDecisionId: id,
        discussingNotificationId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: convId,
      });
      return;
    }

    // 构建用户消息：请求澄清/讨论决策
    const userMsg = CoTMessage.create({
      id: `discuss-dec-user-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'user',
      text: `关于决策「${decision.title}」，推荐方案是「${decision.recommendation.label}」，请帮我分析各方案利弊。`,
      timestamp: now,
    });

    // Agent 回复：方案对比分析
    const allOptions = [decision.recommendation, ...decision.alternatives];
    const analysisParts: string[] = [];
    analysisParts.push(`**决策分析：${decision.title}**`);
    analysisParts.push('');
    analysisParts.push(`背景：${decision.context}`);
    analysisParts.push('');

    for (let i = 0; i < allOptions.length; i++) {
      const opt = allOptions[i];
      const prefix = i === 0 ? '推荐' : `备选${i}`;
      analysisParts.push(`**${prefix}：${opt.label}**`);
      analysisParts.push(`- 描述：${opt.description}`);
      analysisParts.push(`- 风险：${opt.riskLevel === 'low' ? '低' : opt.riskLevel === 'medium' ? '中' : '高'}`);
      analysisParts.push(`- 推理：${opt.reasoning}`);
      if (opt.estimatedImpact) analysisParts.push(`- 预估影响：${opt.estimatedImpact}`);
      analysisParts.push('');
    }

    analysisParts.push(`你可以告诉我：`);
    analysisParts.push(`- "采纳推荐方案" — 确认执行`);
    analysisParts.push(`- "为什么风险高？" — 深入分析某个方案`);
    analysisParts.push(`- "有没有其他选择？" — 探索更多可能性`);

    const botMsg = CoTMessage.create({
      id: `discuss-dec-agent-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'agent',
      text: analysisParts.join('\n'),
      timestamp: now + 1,
      cotSteps: [{
        id: `cs-${now}-1`,
        label: '方案对比',
        status: 'done',
        detail: `共 ${allOptions.length} 个方案，推荐方案风险等级：${decision.recommendation.riskLevel}`,
      }],
    });

    set({
      activeConversationId: convId,
      conversations: {
        ...store.conversations,
        [convId]: [userMsg, botMsg],
      },
      discussingDecisionId: id,
      discussingNotificationId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
    });

    get().rebuildAttentionItems();
  },

  setDiscussingTaskId(id) {
    if (!id) {
      set({
        discussingTaskId: null,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingGoalId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: 'primary',
      });
      return;
    }

    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const store = get();
    const convId = `task-${id}`;

    // 如果已有该任务的对话，直接切换
    if (store.conversations[convId]?.length > 0) {
      set({
        discussingTaskId: id,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingGoalId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: convId,
      });
      return;
    }

    // 构建任务讨论初始消息
    const sessionId = store.sessionId ?? '';
    const now = Date.now();
    const subtaskSummary = task.subtasks.length > 0
      ? `\n子任务状态：${task.subtasks.map((s) => `${s.name}(${s.status})`).join('、')}`
      : '';

    const userMsg = CoTMessage.create({
      id: `discuss-task-user-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'user',
      text: `请汇报「${task.name}」的最新进展，当前进度 ${task.progress}%。${subtaskSummary}`,
      timestamp: now,
    });

    const logSummary = task.logs.slice(-3).map((l) => `[${l.level}] ${l.message}`).join('\n');
    const botText = [
      `**任务「${task.name}」状态报告**`,
      '',
      `当前进度：${task.progress}%`,
      subtaskSummary ? `\n**子任务**${subtaskSummary}` : '',
      logSummary ? `\n**最新日志**\n${logSummary}` : '',
      '',
      '你可以告诉我：',
      '- "暂停任务" — 临时挂起',
      '- "查看推理过程" — 了解 Agent 决策逻辑',
      '- "调整优先级" — 重新排列子任务',
    ].filter(Boolean).join('\n');

    const botMsg = CoTMessage.create({
      id: `discuss-task-agent-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'agent',
      text: botText,
      timestamp: now + 1,
      cotSteps: task.reasoningSteps?.map((s) => ({
        id: `cot-${s.label}`,
        label: s.label,
        detail: s.detail,
        status: 'done' as const,
      })),
    });

    set({
      activeConversationId: convId,
      conversations: {
        ...store.conversations,
        [convId]: [userMsg, botMsg],
      },
      discussingTaskId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingGoalId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
    });

    get().rebuildAttentionItems();
  },

  setDiscussingGoalId(id) {
    if (!id) {
      set({
        discussingGoalId: null,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: 'primary',
      });
      return;
    }

    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;

    const store = get();
    const convId = `goal-${id}`;

    // 如果已有该目标的对话，直接切换
    if (store.conversations[convId]?.length > 0) {
      set({
        discussingGoalId: id,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        bColumnTaskId: null,
        bColumnGoalId: null,
        composerPrefill: null,
        activeConversationId: convId,
      });
      return;
    }

    // 构建目标讨论初始消息
    const sessionId = store.sessionId ?? '';
    const now = Date.now();
    const activeMilestone = goal.milestones.find((m) => m.status === 'active');
    const completedMilestones = goal.milestones.filter((m) => m.status === 'completed');

    const userMsg = CoTMessage.create({
      id: `discuss-goal-user-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'user',
      text: `请汇报目标「${goal.title}」的整体进展，当前进度 ${goal.overallProgress}%。`,
      timestamp: now,
    });

    const milestoneSummary = goal.milestones.length > 0
      ? `\n**里程碑** (${completedMilestones.length}/${goal.milestones.length})\n${goal.milestones.map((m) =>
          `- ${m.status === 'completed' ? '~~' : ''}${m.name}${m.status === 'completed' ? '~~' : ''} (${m.status === 'completed' ? '已完成' : m.status === 'active' ? '进行中' : '待开始'})`
        ).join('\n')}`
      : '';

    const botText = [
      `**目标「${goal.title}」进展报告**`,
      '',
      `整体进度：${goal.overallProgress}%`,
      activeMilestone ? `当前里程碑：${activeMilestone.name}` : '',
      milestoneSummary,
      '',
      '你可以告诉我：',
      '- "分析风险" — 评估目标达成的障碍',
      '- "调整里程碑" — 重新规划节点',
      '- "关联任务进展" — 查看任务对目标的贡献',
    ].filter(Boolean).join('\n');

    const botMsg = CoTMessage.create({
      id: `discuss-goal-agent-${now}`,
      agentId: 'primary',
      sessionId,
      role: 'agent',
      text: botText,
      timestamp: now + 1,
    });

    set({
      activeConversationId: convId,
      conversations: {
        ...store.conversations,
        [convId]: [userMsg, botMsg],
      },
      discussingGoalId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      composerPrefill: null,
    });

    get().rebuildAttentionItems();
  },

  initConversation() {
    if (get().sessionId) return;
    const sessionId = `session-${Date.now()}`;
    set({ sessionId, conversations: { primary: [] }, activeConversationId: 'primary' });
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

    // Build decision trees Record
    const treesArray = MockOpenClawDataSource.getDecisionTrees();
    const decisionTrees: Record<string, DecisionTree> = {};
    for (const t of treesArray) {
      decisionTrees[t.activityId] = t;
    }

    set({
      runtimes, tasks, systemHealth, quickCommands,
      proactiveActivities, proactiveInsights, decisionTrees, collaborationChains, decisionRequests, goals, activeGoalId,
    });

    // Create notifications for decision requests
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

    // Start task progress simulation (respects paused state)
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

    // Start chain progress simulation
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
      _cleanup: null,
    });
  },
}));
