import { useCallback, useEffect, useRef } from 'react';
import { useOpenClawStore } from '../stores/openclawStore';
import { useAgentStore } from '../stores/agentStore';
import { AgentRoutingService } from '../../domain/agent/AgentRoutingService';
import { weKnoraApi } from '../../infrastructure/api/weKnoraClient';
import { CoTMessage } from '../../domain/agent/CoTMessage';
import type { CoTStep, Attachment } from '../../domain/agent/CoTMessage';
import type { MessageBlock } from '../../domain/agent/MessageBlock';
import { MockOpenClawDataSource } from '../../infrastructure/mock/MockOpenClawDataSource';
import { UserGoal } from '../../domain/agent/UserGoal';
import { appEvents } from '../events/eventBus';

/** Stable empty array to avoid new-reference re-renders */
const EMPTY_MESSAGES: CoTMessage[] = [];

/**
 * useAgentChat — Primary Agent 统一对话 hook
 *
 * 用户始终与 Primary Agent 对话，AgentRoutingService
 * 自动检测意图并路由到对应能力 Agent。
 */
export function useAgentChat() {
  const activeConversationId = useOpenClawStore((s) => s.activeConversationId);
  const conversations = useOpenClawStore((s) => s.conversations);
  const conversation = conversations[activeConversationId] ?? EMPTY_MESSAGES;
  const messages = conversation.length > 0 ? conversation : EMPTY_MESSAGES;
  const isSending = useOpenClawStore((s) => s.isSending);
  const appendMessage = useOpenClawStore((s) => s.appendMessage);
  const updateLastMessage = useOpenClawStore((s) => s.updateLastMessage);
  const setIsSending = useOpenClawStore((s) => s.setIsSending);
  const sessionId = useOpenClawStore((s) => s.sessionId);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const getPrimaryAgentName = useCallback((): string => {
    const activeSharedAgentId = useOpenClawStore.getState().activeSharedAgentId;
    if (activeSharedAgentId) {
      const sharedAgent = useAgentStore.getState().sharedAgents.find((a) => a.id === activeSharedAgentId);
      return sharedAgent?.name ?? 'AI 助手';
    }
    const agent = useAgentStore.getState().primaryAgent;
    return agent?.name ?? 'AI 助手';
  }, []);

  /** Detect task intent in bot response and create corresponding AgentTask + TaskCardBlock */
  const detectAndCreateTask = useCallback((responseText: string) => {
    const intent = MockOpenClawDataSource.detectTaskIntent(responseText);
    if (!intent) return;

    const primaryAgent = useAgentStore.getState().primaryAgent;
    const agentId = primaryAgent?.id ?? 'primary';

    const task = MockOpenClawDataSource.createTaskFromIntent(agentId, intent, responseText);

    // Add task to store
    const store = useOpenClawStore.getState();
    store.setTasks([...store.tasks, task]);

    // Append TaskCardBlock to the last bot message
    const block: MessageBlock = { type: 'task-card', taskId: task.id };
    store.updateLastMessage((m) => m.appendBlock(block));

    // Start progress simulation for this new task
    let lastCompletedSubtask = '';
    const cleanup = MockOpenClawDataSource.simulateTaskProgress((taskId, progress) => {
      if (taskId !== task.id) return;
      const s = useOpenClawStore.getState();
      const t = s.tasks.find((x) => x.id === taskId);
      if (!t) return;
      s.updateTask(taskId, (existing) => {
        const updated = existing.withProgress(progress);

        // --- Gap 1: 追加子任务完成消息到 C 栏 ---
        const completedSubs = (updated.subtasks ?? []).filter((st) => st.status === 'success');
        const latestDone = completedSubs[completedSubs.length - 1];
        if (latestDone && latestDone.name !== lastCompletedSubtask) {
          lastCompletedSubtask = latestDone.name;
          const progressMsg = CoTMessage.create({
            id: `progress-${taskId}-${Date.now()}`,
            agentId: 'primary',
            sessionId: useOpenClawStore.getState().sessionId ?? '',
            role: 'agent',
            text: `**${latestDone.name}** 已完成（整体进度 ${Math.round(progress)}%）`,
            timestamp: Date.now(),
            cotSteps: [{
              id: `ps-${Date.now()}`,
              label: `子任务完成: ${latestDone.name}`,
              status: 'done',
              detail: `任务 "${task.name}" 进度 ${Math.round(progress)}%`,
            }],
          }).appendBlock({ type: 'task-card', taskId: task.id } as MessageBlock);
          useOpenClawStore.getState().appendMessage(progressMsg);
        }

        // --- 任务完成时追加总结消息 ---
        if (progress >= 100 && existing.progress < 100) {
          const doneMsg = CoTMessage.create({
            id: `done-${taskId}-${Date.now()}`,
            agentId: 'primary',
            sessionId: useOpenClawStore.getState().sessionId ?? '',
            role: 'agent',
            text: `任务 **${existing.name}** 已全部完成！所有子任务均已通过，可在右侧抽屉查看完整执行报告。`,
            timestamp: Date.now(),
            cotSteps: [
              { id: `ds-1-${Date.now()}`, label: '任务执行', status: 'done', detail: `共 ${(existing.subtasks ?? []).length} 个子任务` },
              { id: `ds-2-${Date.now()}`, label: '质量检查', status: 'done', detail: '所有子任务通过验证' },
              { id: `ds-3-${Date.now()}`, label: '报告生成', status: 'done', detail: '执行报告已生成' },
            ],
          }).appendBlock({ type: 'task-card', taskId: task.id } as MessageBlock);
          useOpenClawStore.getState().appendMessage(doneMsg);

          import('../stores/notificationStore').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addCompletionNotification(taskId, existing.name);
          });
          appEvents.emit('agent:task-updated', { taskId, progress: 100, status: 'completed' });
        }
        return updated;
      });
    });

    // Store cleanup
    const existingCleanup = store._cleanup;
    useOpenClawStore.setState({
      _cleanup: () => {
        cleanup();
        existingCleanup?.();
      },
    });
  }, []);

  /** Detect goal intent in user message and create a UserGoal with initial milestone */
  const detectAndCreateGoal = useCallback((userText: string) => {
    const goalIntent = MockOpenClawDataSource.detectGoalIntent(userText);
    if (!goalIntent) return;

    const primaryAgent = useAgentStore.getState().primaryAgent;
    const agentId = primaryAgent?.id ?? 'primary';
    const goal = MockOpenClawDataSource.createGoalFromIntent(agentId, goalIntent, userText);

    const store = useOpenClawStore.getState();
    if (store.goals.some((g) => g.title === goal.title)) return; // deduplicate
    store.addGoal(goal);
    store.setActiveGoal(goal.id);

    // Append GoalProgressBlock to the last bot message
    const activeMs = goal.activeMilestone;
    const block: MessageBlock = {
      type: 'goal-progress',
      goalId: goal.id,
      title: goal.title,
      milestoneName: activeMs?.name ?? '',
      progress: goal.overallProgress,
    };
    store.updateLastMessage((m) => m.appendBlock(block));
  }, []);

  const sendMessage = useCallback(async (text: string, attachments?: Attachment[]) => {
    if (!sessionId || isSending) return;

    // Determine routing context: direct shared agent chat or primary agent routing
    const activeSharedAgentId = useOpenClawStore.getState().activeSharedAgentId;
    let systemHint = '';
    let routedCapName = '';

    if (activeSharedAgentId) {
      // Direct chat with shared agent — always use its system prompt
      const sharedAgent = useAgentStore.getState().sharedAgents.find((a) => a.id === activeSharedAgentId);
      if (sharedAgent) {
        const templateId = `cap-${sharedAgent.category}`;
        const registry = useAgentStore.getState().capabilityRegistry;
        const template = registry.findTemplate(templateId);
        if (template) {
          systemHint = template.systemPrompt;
          routedCapName = template.name;
        }
      }
    } else {
      // Primary agent: route intent through capability registry
      const detectedIntent = AgentRoutingService.detectIntent(text);
      if (detectedIntent) {
        const registry = useAgentStore.getState().capabilityRegistry;
        const routeResult = AgentRoutingService.route(detectedIntent, registry);
        if (routeResult) {
          if (routeResult.action === 'create') {
            useAgentStore.getState().activateCapability(detectedIntent.templateId);
          }
          systemHint = routeResult.template.systemPrompt;
          routedCapName = routeResult.template.name;

          // Increment invoke count for auto-dispatched shared agent
          const category = detectedIntent.templateId.replace('cap-', '');
          useAgentStore.getState().invokeAgent(`sa-${category}`);
        }
      }
    }

    // Build query text with attachment context for API
    const attachmentHint = attachments?.length
      ? '\n\n' + attachments.map((a) => `[附件: ${a.name} (${formatFileSize(a.size)})]`).join('\n')
      : '';
    const queryText = (systemHint ? `${systemHint}\n\n${text}` : text) + attachmentHint;

    // Add user message
    const userMsg = CoTMessage.create({
      id: `m-${Date.now()}`,
      agentId: 'primary',
      sessionId,
      role: 'user',
      text,
      timestamp: Date.now(),
      attachments,
    });
    appendMessage(userMsg);

    // --- Gap 3: Agent 路由可视化 — 插入路由系统消息 ---
    if (routedCapName) {
      const routingMsg = CoTMessage.create({
        id: `routing-${Date.now()}`,
        agentId: 'primary',
        sessionId,
        role: 'agent',
        text: `🔀 正在调用 **${routedCapName}** 处理您的请求...`,
        timestamp: Date.now(),
        cotSteps: [
          { id: `rt-${Date.now()}`, label: '意图识别', status: 'done', detail: `检测到 "${routedCapName}" 相关意图` },
          { id: `rt2-${Date.now()}`, label: `路由到 ${routedCapName}`, status: 'running', detail: '正在调度能力 Agent...' },
        ],
      });
      appendMessage(routingMsg);
    }

    // Detect goal intent from user message
    detectAndCreateGoal(text);

    // Add placeholder bot message with thinking CoT step
    const botMsgId = `r-${Date.now()}`;
    const thinkingStep: CoTStep = {
      id: `s-${Date.now()}-1`,
      label: routedCapName ? `调用 [${routedCapName}] 能力` : '检索知识库',
      status: 'running',
      detail: routedCapName ? `正在路由到 ${routedCapName}...` : '正在连接 WeKnora RAG...',
    };
    const botMsg = CoTMessage.create({
      id: botMsgId,
      agentId: 'primary',
      sessionId,
      role: 'agent',
      text: '',
      timestamp: Date.now(),
      cotSteps: [thinkingStep],
    });
    appendMessage(botMsg);
    setIsSending(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let streamFailed = false;
      let accumulated = '';

      await weKnoraApi.chat(sessionId, queryText, {
        signal: controller.signal,
        onChunk: (chunk) => {
          accumulated += chunk;
          updateLastMessage((m) =>
            m.withText(accumulated).withSteps(
              (m.cotSteps ?? []).map((s) =>
                s.id === thinkingStep.id
                  ? { ...s, status: 'done' as const, label: routedCapName ? `${routedCapName} 检索完成` : '知识检索完成', detail: '正在生成回答...' }
                  : s,
              ),
            ),
          );
        },
        onSources: (sources) => {
          const sourceBlocks: MessageBlock[] = sources.slice(0, 3).map((src, i) => ({
            type: 'source-ref' as const,
            sourceId: src.id || `src-${Date.now()}-${i}`,
            title: src.title,
          }));

          updateLastMessage((m) => {
            let updated = m.withSteps([
              ...(m.cotSteps ?? []),
              { id: `s-src-${Date.now()}`, label: '引用来源', status: 'done' as const, detail: sources.map((s) => s.title).join('、') || '无引用' },
            ]);
            if (sourceBlocks.length > 0) {
              updated = updated.withBlocks([...(updated.blocks ?? []), ...sourceBlocks]);
            }
            return updated;
          });
        },
        onDone: () => {
          updateLastMessage((m) =>
            m.withSteps((m.cotSteps ?? []).map((s) => s.status === 'running' ? { ...s, status: 'done' as const, detail: '完成' } : s)),
          );
          detectAndCreateTask(accumulated);
        },
        onError: (err) => {
          console.warn('[useAgentChat] SSE error, trying fallback:', err.message);
          streamFailed = true;
        },
      });

      if (streamFailed && !controller.signal.aborted) {
        try {
          updateLastMessage((m) =>
            m.withText('').withSteps([{ ...thinkingStep, detail: '流式连接失败，正在尝试非流式请求...' }]),
          );
          const result = await weKnoraApi.ask(text);
          updateLastMessage((m) =>
            m.withText(result.answer).withSteps([
              { ...thinkingStep, status: 'done' as const, label: '知识检索完成', detail: '非流式回答' },
              ...(result.sources?.length
                ? [{ id: `s-src-${Date.now()}`, label: '引用来源', status: 'done' as const, detail: result.sources.map((s) => s.title).join('、') }]
                : []),
            ]),
          );
          detectAndCreateTask(result.answer);
        } catch {
          // Both stream and non-stream failed — use mock fallback
          const mockResp = MockOpenClawDataSource.getMockChatResponse(text);
          updateLastMessage((m) =>
            m.withText(mockResp.text)
              .withSteps([
                { ...thinkingStep, status: 'done' as const, label: routedCapName ? `${routedCapName} 处理完成` : '智能分析完成', detail: '本地模式' },
                ...(mockResp.cotSteps ?? []),
              ])
              .withBlocks(mockResp.blocks ?? []),
          );
          detectAndCreateTask(mockResp.text);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // API completely unreachable — use mock fallback
        const mockResp = MockOpenClawDataSource.getMockChatResponse(text);
        updateLastMessage((m) =>
          m.withText(mockResp.text)
            .withSteps([
              { ...thinkingStep, status: 'done' as const, label: routedCapName ? `${routedCapName} 处理完成` : '智能分析完成', detail: '本地模式' },
              ...(mockResp.cotSteps ?? []),
            ])
            .withBlocks(mockResp.blocks ?? []),
        );
        detectAndCreateTask(mockResp.text);
      }
    } finally {
      setIsSending(false);
    }
  }, [sessionId, isSending, appendMessage, updateLastMessage, setIsSending, detectAndCreateTask, detectAndCreateGoal]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isSending, abort, getAgentName: getPrimaryAgentName };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
