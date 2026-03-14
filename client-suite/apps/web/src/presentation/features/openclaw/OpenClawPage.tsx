/**
 * OpenClawPage — 主页面：CoT 对话区 + 输入框
 * 根据 subView 可切换到 TaskDetailView。
 * 接入 WeKnora RAG API (SSE streaming) — Task #25
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '../../../application/stores/uiStore';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { weKnoraApi } from '../../../infrastructure/api/weKnoraClient';
import { Icon } from '../../components/ui/Icon';
import { TaskMonitorPanel } from './TaskMonitorPanel';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { TaskDetailView } from './TaskDetailView';
import { IMReplyModal } from './IMReplyModal';
import { OpenClawWelcomePage } from './OpenClawWelcomePage';

interface CoTStep {
  id: string;
  label: string;
  status: 'done' | 'running' | 'pending';
  detail: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  html?: string;
  time: string;
  cotSteps?: CoTStep[];
}

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    text: '帮我对 auth-service.js 做一次全面安全审计，重点检查 JWT 和 Cookie 相关的风险。',
    time: '12:42 PM',
  },
  {
    id: 'm2',
    role: 'agent',
    html: '正在为您生成报告。初步检查发现模块 <code>auth-service.js</code> 存在 JWT 硬编码风险，Cookie 缺少 <code>HttpOnly</code> 标志。详细报告将在扫描完成后输出。',
    text: '正在为您生成报告。初步检查发现模块 auth-service.js 存在 JWT 硬编码风险，Cookie 缺少 HttpOnly 标志。详细报告将在扫描完成后输出。',
    time: '12:43 PM',
    cotSteps: [
      { id: 's1', label: '扫描代码仓库', status: 'done', detail: '发现 3 个潜在依赖风险点' },
      { id: 's2', label: '检索知识库', status: 'done', detail: '已提取 OWASP 2024 准则' },
      { id: 's3', label: '生成初步安全建议', status: 'running', detail: '正在分析内存泄漏风险...' },
    ],
  },
];

/** Per-agent greeting messages */
const AGENT_GREETINGS: Record<string, ChatMessage[]> = {
  'sa-1': MOCK_MESSAGES,
  'sa-2': [{ id: 'g-doc', role: 'agent', text: '你好！我是文档写手，可以帮你撰写 PRD、技术方案、API 文档等。有什么需要？', time: '12:00 PM' }],
  'sa-3': [{ id: 'g-data', role: 'agent', text: '你好！我是数据分析师，擅长 SQL 生成、数据可视化和报表分析。请描述你的需求。', time: '12:00 PM' }],
  'sa-5': [{ id: 'g-test', role: 'agent', text: '你好！我是测试工程师，可以帮你生成单元测试、集成测试和 E2E 测试。', time: '12:00 PM' }],
  'sa-6': [{ id: 'g-ops', role: 'agent', text: '你好！我是运维助手，擅长 Docker、K8s 和 CI/CD 配置。有什么可以帮你？', time: '12:00 PM' }],
  'sa-8': [{ id: 'g-sec', role: 'agent', text: '你好！我是安全审计员，可以为你做代码安全审计和漏洞扫描。请描述目标。', time: '12:00 PM' }],
};

const STEP_ICON: Record<CoTStep['status'], { icon: string; cls: string }> = {
  done: { icon: 'check_circle', cls: 'text-green-400' },
  running: { icon: 'autorenew', cls: 'text-primary animate-spin' },
  pending: { icon: 'hourglass_empty', cls: 'text-slate-500' },
};

/** Notification context for IMReplyModal */
interface ReplyContext {
  id: string;
  source: string;
  sender: string;
  message: string;
  roomId?: string;
}

export function OpenClawPage() {
  const subView = useUIStore((s) => s.subView);
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [showDrawer, setShowDrawer] = useState(false);
  const [replyCtx, setReplyCtx] = useState<ReplyContext | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable session ID — one per component lifecycle
  const sessionIdRef = useRef<string>(`oc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // When agent changes, reset messages to that agent's greeting and generate new session
  useEffect(() => {
    if (!selectedAgentId) return;
    sessionIdRef.current = `oc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const greeting = AGENT_GREETINGS[selectedAgentId];
    if (greeting) {
      setMessages([...greeting]);
      setShowWelcome(false);
    }
  }, [selectedAgentId]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const getAgentName = useCallback(() => {
    if (!selectedAgentId) return 'AI 助手';
    const agent = useAgentStore.getState().sharedAgents.find((a) => a.id === selectedAgentId);
    return agent?.name ?? 'AI 助手';
  }, [selectedAgentId]);

  /**
   * Send query to WeKnora RAG backend.
   * Strategy: try SSE streaming first; fall back to non-streaming ask(); show error on total failure.
   */
  const sendToWeKnora = useCallback(async (userText: string) => {
    const botMsgId = `r-${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // Insert placeholder bot message with CoT "thinking" step
    const thinkingStep: CoTStep = {
      id: `s-${Date.now()}-1`,
      label: '检索知识库',
      status: 'running',
      detail: '正在连接 WeKnora RAG...',
    };

    setMessages((prev) => [
      ...prev,
      { id: botMsgId, role: 'agent', text: '', time: timeStr, cotSteps: [thinkingStep] },
    ]);
    setIsSending(true);

    // Abort previous request if any
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Helper: update the bot message in-place
    const updateBotMsg = (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === botMsgId ? updater(m) : m)));
    };

    try {
      // ── Attempt 1: SSE streaming ──
      let streamFailed = false;
      let accumulated = '';

      await weKnoraApi.chat(sessionIdRef.current, userText, {
        signal: controller.signal,
        onChunk: (text) => {
          accumulated += text;
          updateBotMsg((m) => ({
            ...m,
            text: accumulated,
            cotSteps: m.cotSteps?.map((s) =>
              s.id === thinkingStep.id
                ? { ...s, status: 'done' as const, label: '知识检索完成', detail: '正在生成回答...' }
                : s,
            ),
          }));
        },
        onSources: (sources) => {
          updateBotMsg((m) => ({
            ...m,
            cotSteps: [
              ...(m.cotSteps ?? []),
              {
                id: `s-src-${Date.now()}`,
                label: '引用来源',
                status: 'done' as const,
                detail: sources.map((s) => s.title).join('、') || '无引用',
              },
            ],
          }));
        },
        onDone: () => {
          updateBotMsg((m) => ({
            ...m,
            cotSteps: m.cotSteps?.map((s) =>
              s.status === 'running' ? { ...s, status: 'done' as const, detail: '完成' } : s,
            ),
          }));
        },
        onError: (err) => {
          console.warn('[OpenClaw] SSE stream error, will try non-streaming fallback:', err.message);
          streamFailed = true;
        },
      });

      // ── Attempt 2: non-streaming fallback ──
      if (streamFailed && !controller.signal.aborted) {
        try {
          updateBotMsg((m) => ({
            ...m,
            text: '',
            cotSteps: [{ ...thinkingStep, detail: '流式连接失败，正在尝试非流式请求...' }],
          }));
          const result = await weKnoraApi.ask(userText);
          updateBotMsg((m) => ({
            ...m,
            text: result.answer,
            cotSteps: [
              { ...thinkingStep, status: 'done' as const, label: '知识检索完成', detail: '非流式回答' },
              ...(result.sources?.length
                ? [{
                    id: `s-src-${Date.now()}`,
                    label: '引用来源',
                    status: 'done' as const,
                    detail: result.sources.map((s) => s.title).join('、'),
                  }]
                : []),
            ],
          }));
        } catch (fallbackErr: any) {
          // Both paths failed
          updateBotMsg((m) => ({
            ...m,
            text: `抱歉，AI 服务暂时不可用。错误信息：${fallbackErr?.message || '未知错误'}`,
            cotSteps: [{ ...thinkingStep, status: 'done' as const, label: '连接失败', detail: '请稍后重试' }],
          }));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateBotMsg((m) => ({
          ...m,
          text: `抱歉，请求出错：${err?.message || '未知错误'}`,
          cotSteps: [{ ...thinkingStep, status: 'done' as const, label: '请求失败', detail: err?.message || '' }],
        }));
      }
    } finally {
      setIsSending(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isSending) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: 'user', text, time: timeStr }]);
    setInput('');
    setShowWelcome(false);
    sendToWeKnora(text);
  }, [input, isSending, sendToWeKnora]);

  // Callback from WelcomePage: user sends from welcome input or clicks quick command
  const handleStartChat = useCallback((text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: 'user', text, time: timeStr }]);
    setShowWelcome(false);
    sendToWeKnora(text);
  }, [sendToWeKnora]);

  const handleReply = useCallback((ctx: ReplyContext) => {
    setReplyCtx(ctx);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Task detail full-screen view
  if (subView === 'openclaw:task-detail') {
    return <TaskDetailView />;
  }

  // Welcome page (openclaw_v2 design)
  if (showWelcome) {
    return <OpenClawWelcomePage onStartChat={handleStartChat} />;
  }

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto dcf-scrollbar px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-500">发送消息开始对话</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {/* CoT Steps */}
                {msg.cotSteps && (
                  <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon name="psychology" size={16} className="text-primary" />
                      <span className="text-xs font-medium text-primary">思维链路 (Chain of Thought)</span>
                    </div>
                    <div className="relative">
                      {msg.cotSteps.map((step, idx) => {
                        const si = STEP_ICON[step.status];
                        const isLast = idx === (msg.cotSteps?.length ?? 0) - 1;
                        return (
                          <div key={step.id} className="flex items-start gap-2 relative">
                            {!isLast && (
                              <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%+2px)] bg-white/10" />
                            )}
                            <Icon name={si.icon} size={16} className={`${si.cls} relative z-10`} />
                            <div className="min-w-0 pb-2.5">
                              <span className="text-xs font-medium text-slate-200">{step.label}</span>
                              <span className="text-xs text-slate-400 ml-1.5">— {step.detail}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed [&_code]:text-primary [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono ${
                    msg.role === 'user'
                      ? 'bg-bg-active text-slate-100 chat-bubble-sent'
                      : 'bg-white/5 text-slate-200 chat-bubble-received'
                  }`}
                  {...(msg.html ? { dangerouslySetInnerHTML: { __html: msg.html } } : { children: msg.text })}
                />
                <p className={`text-[10px] text-slate-500 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.time}{msg.role === 'user' ? ' · 已送达' : ''}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 px-6 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <button type="button" onClick={() => useToastStore.getState().addToast('附件上传功能开发中', 'info')} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Icon name="attach_file" size={20} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('语音输入功能开发中', 'info')} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Icon name="mic" size={20} />
            </button>
            <input
              type="text"
              placeholder="发送消息或输入 '/' 唤起指令圈…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — task monitor */}
      <TaskMonitorPanel
        onOpenTaskDetail={() => setShowDrawer(true)}
        onReply={handleReply}
      />

      {/* Task detail drawer */}
      {showDrawer && <TaskDetailDrawer onClose={() => setShowDrawer(false)} />}

      {/* IM Reply modal */}
      {replyCtx && (
        <IMReplyModal
          roomId={replyCtx.roomId}
          senderName={`${replyCtx.source} · ${replyCtx.sender}`}
          originalMessage={replyCtx.message}
          onClose={() => setReplyCtx(null)}
        />
      )}
    </div>
  );
}

/* Sidebar wrapper — reuses OpenClawSidebar with uiStore state */
import { OpenClawSidebar } from './OpenClawSidebar';
import { Sidebar } from '../../layouts/Sidebar';

export function OpenClawSidebarWrapper() {
  const selectedAgent = useUIStore((s) => s.selectedAgentId);
  const setSelectedAgent = useUIStore((s) => s.setSelectedAgentId);
  return (
    <Sidebar>
      <OpenClawSidebar selectedAgentId={selectedAgent} onSelectAgent={setSelectedAgent} />
    </Sidebar>
  );
}
