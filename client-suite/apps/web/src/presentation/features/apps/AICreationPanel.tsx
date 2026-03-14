/**
 * AICreationPanel — 对话式创建（左侧对话 + 右侧实时预览）
 * 借鉴 Coze IDE 分栏模式，用户可通过自然语言持续迭代修改
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

/* ─── Types ─── */

type MsgType =
  | 'user'
  | 'ai-thinking'
  | 'ai-action'
  | 'ai-text'
  | 'ai-code';

interface ChatMessage {
  id: string;
  type: MsgType;
  content: string;
  /** For ai-action: icon + label */
  actionIcon?: string;
  actionLabel?: string;
  /** Whether this message is still "streaming" */
  streaming?: boolean;
}

type PreviewState = 'idle' | 'loading' | 'ready';
type ViewportMode = 'desktop' | 'mobile';

/* ─── Simulated AI workflow ─── */

interface WorkflowStep {
  delay: number;
  msg: Omit<ChatMessage, 'id'>;
}

function buildInitialWorkflow(prompt: string): WorkflowStep[] {
  return [
    { delay: 300, msg: { type: 'ai-thinking', content: '正在分析需求，规划实现方案…', streaming: true } },
    { delay: 1200, msg: { type: 'ai-thinking', content: `用户要求创建「${prompt.slice(0, 30)}${prompt.length > 30 ? '…' : ''}」，这是一个需要表单和数据查询的应用。让我先分析一下：\n1. 这是一个单页应用，需要表单输入\n2. 需要对接后端查询接口\n3. 需要结果展示区域` } },
    { delay: 1800, msg: { type: 'ai-action', content: '更新计划', actionIcon: 'checklist', actionLabel: '更新计划' } },
    { delay: 2200, msg: { type: 'ai-action', content: '分析数据模型与接口依赖', actionIcon: 'schema', actionLabel: '思考过程' } },
    { delay: 2800, msg: { type: 'ai-action', content: '正在生成页面布局与交互逻辑…', actionIcon: 'code', actionLabel: '创建文件' } },
    { delay: 3600, msg: { type: 'ai-code', content: '// screens/leave-query/index.tsx\nexport default function LeaveQueryApp() {\n  const [name, setName] = useState("");\n  const [result, setResult] = useState(null);\n  \n  return (\n    <div className="app-container">\n      <Header title="剩余年假查询" />\n      <QueryForm onSubmit={handleQuery} />\n      <ResultPanel data={result} />\n    </div>\n  );\n}' } },
    { delay: 4200, msg: { type: 'ai-action', content: '优化样式与响应式布局', actionIcon: 'palette', actionLabel: '思考过程' } },
    { delay: 4800, msg: { type: 'ai-text', content: '应用已生成完毕！右侧是实时预览。\n\n你可以继续用自然语言告诉我需要修改的地方，例如：\n- 「把配色改成深色主题」\n- 「增加一个日期范围选择器」\n- 「底部加上数据来源说明」' } },
  ];
}

function buildIterationWorkflow(prompt: string): WorkflowStep[] {
  return [
    { delay: 300, msg: { type: 'ai-thinking', content: `正在理解修改需求：「${prompt}」`, streaming: true } },
    { delay: 1000, msg: { type: 'ai-action', content: '分析变更影响范围', actionIcon: 'manage_search', actionLabel: '思考过程' } },
    { delay: 1600, msg: { type: 'ai-action', content: '正在修改界面代码…', actionIcon: 'edit_note', actionLabel: '修改文件' } },
    { delay: 2200, msg: { type: 'ai-text', content: '已完成修改，右侧预览已更新。还有其他需要调整的吗？' } },
  ];
}

let _msgId = 0;
function nextId() { return `msg-${++_msgId}`; }

/* ─── Main Component ─── */

interface AICreationPanelProps {
  mode: 'create' | 'view' | 'edit';
  onClose: () => void;
  initialAppName?: string | null;
  /** view → edit transition */
  onSwitchToEdit?: () => void;
}

export function AICreationPanel({ mode, onClose, initialAppName, onSwitchToEdit }: AICreationPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>(mode === 'create' ? 'idle' : 'ready');
  const [leaveType, setLeaveType] = useState('带薪年假');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* In edit mode, seed the chat with editing context */
  useEffect(() => {
    if (mode !== 'edit' || !initialAppName) return;
    setMessages([
      { id: nextId(), type: 'ai-text', content: `正在编辑应用「${initialAppName}」。\n\n你可以通过自然语言告诉我需要修改的地方，例如：\n- 「把配色改成深色主题」\n- 「增加一个导出按钮」\n- 「标题改成英文」` },
    ]);
  }, [mode, initialAppName]);

  /* Auto-scroll chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Cleanup timers */
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  /* Escape key to close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Auto-grow textarea */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  /* Run a workflow: push messages sequentially with delays */
  const runWorkflow = useCallback((steps: WorkflowStep[], onDone?: () => void) => {
    setIsProcessing(true);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setMessages((prev) => {
          // Replace last streaming message if it was thinking
          const last = prev[prev.length - 1];
          if (last?.streaming && step.msg.type !== 'ai-thinking') {
            return [...prev.slice(0, -1), { ...last, streaming: false }, { id: nextId(), ...step.msg }];
          }
          if (last?.streaming && step.msg.type === 'ai-thinking') {
            return [...prev.slice(0, -1), { id: nextId(), ...step.msg }];
          }
          return [...prev, { id: nextId(), ...step.msg }];
        });

        if (i === steps.length - 1) {
          setIsProcessing(false);
          onDone?.();
        }
      }, step.delay);
      timersRef.current.push(t);
    });
  }, []);

  /* First message: user sends initial prompt */
  const handleSend = useCallback((directText?: string) => {
    const text = (directText ?? input).trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = { id: nextId(), type: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const isFirst = messages.filter((m) => m.type === 'user').length === 0;

    if (isFirst) {
      setPreviewState('loading');
      const workflow = buildInitialWorkflow(text);
      runWorkflow(workflow, () => setPreviewState('ready'));
    } else {
      setPreviewState('loading');
      const workflow = buildIterationWorkflow(text);
      runWorkflow(workflow, () => setPreviewState('ready'));
    }
  }, [input, isProcessing, messages, runWorkflow]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePublish = () => {
    setShowDeployConfirm(true);
  };

  const confirmPublish = () => {
    setShowDeployConfirm(false);
    useToastStore.getState().addToast('应用已发布！', 'success');
    onClose();
  };

  const showChat = mode === 'create' || mode === 'edit';

  const topTitle = mode === 'view'
    ? initialAppName ?? '应用预览'
    : mode === 'edit'
      ? `编辑 · ${initialAppName}`
      : '创建新应用';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-text-secondary transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon name={mode === 'view' ? 'visibility' : 'auto_awesome'} size={14} className="text-primary" />
            </span>
            <span className="text-sm font-semibold text-text-primary">{topTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Viewport toggle — always visible when preview is ready */}
          {previewState === 'ready' && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="computer" size={14} />
                桌面端
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewportMode === 'mobile'
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="smartphone" size={14} />
                移动端
              </button>
            </div>
          )}
          {mode === 'view' && onSwitchToEdit && (
            <button
              type="button"
              onClick={onSwitchToEdit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-primary hover:bg-gray-50 transition-colors"
            >
              <Icon name="edit" size={14} />
              编辑
            </button>
          )}
          {previewState === 'ready' && (
            <button
              type="button"
              onClick={handlePublish}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="rocket_launch" size={14} />
              部署
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat panel (only in create/edit mode) */}
        {showChat && (
          <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0 bg-white">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 dcf-scrollbar">
              {messages.length === 0 && (
                <EmptyChat onSelect={(text) => handleSend(text)} />
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === 'edit' ? '输入修改需求…' : messages.length === 0 ? '描述你想创建的应用…' : '输入修改需求…'}
                  rows={1}
                  className="flex-1 px-3 py-2.5 text-sm border border-border rounded-xl bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-text-muted/60 leading-relaxed overflow-hidden"
                  style={{ minHeight: '2.5rem', maxHeight: '8rem' }}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name={isProcessing ? 'hourglass_top' : 'arrow_upward'} size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Preview (full width in view mode) */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[#f8f8f7]">
          {/* Preview content */}
          <div className="flex-1 overflow-auto dcf-scrollbar p-6 flex justify-center">
            {previewState === 'idle' && <PreviewEmpty />}
            {previewState === 'loading' && <PreviewLoading />}
            {previewState === 'ready' && (
              viewportMode === 'mobile' ? (
                <MobileFrame>
                  <PreviewApp isMobile leaveType={leaveType} setLeaveType={setLeaveType} />
                </MobileFrame>
              ) : (
                <div className="w-full max-w-4xl">
                  <PreviewApp isMobile={false} leaveType={leaveType} setLeaveType={setLeaveType} />
                </div>
              )
            )}
          </div>

          {/* Bottom bar */}
          {previewState === 'ready' && (
            <div className="shrink-0 border-t border-border bg-white px-4 py-2 flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Icon name="link" size={12} className="text-primary" />
                {mode === 'view' ? '点击编辑按钮可修改应用' : '点击部署按钮，可发布为独立应用地址'}
              </span>
              <span>{viewportMode === 'desktop' ? '1440 × 900' : '375 × 812'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Deploy confirmation dialog */}
      {showDeployConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDeployConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-border p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="rocket_launch" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">确认发布应用？</p>
                <p className="text-xs text-text-muted mt-0.5">发布后其他成员可在应用中心使用</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={confirmPublish}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                确认发布
              </button>
              <button
                type="button"
                onClick={() => setShowDeployConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Chat sub-components ─── */

function EmptyChat({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon name="auto_awesome" size={28} className="text-primary" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text-primary">AI 应用创建助手</p>
        <p className="text-xs text-text-muted leading-relaxed max-w-[260px]">
          用自然语言描述你的需求，AI 将自动生成应用。<br />
          生成后你可以继续对话来迭代修改。
        </p>
      </div>
      <div className="space-y-2 w-full max-w-[280px]">
        <p className="text-[11px] text-text-muted font-medium">试试这些：</p>
        {[
          '创建一个剩余年假查询应用',
          '做一个团队日报提交工具',
          '生成设备报修工单系统',
        ].map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => onSelect(hint)}
            className="w-full text-xs text-text-secondary bg-gray-50 border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 hover:border-primary/30 transition-colors text-left"
          >
            &ldquo;{hint}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-thinking') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="psychology" size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Icon name="psychology" size={12} />
            思考过程
            {msg.streaming && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
          </div>
          <div className="text-xs text-text-secondary leading-relaxed bg-gray-50 border border-border rounded-xl px-3 py-2.5 whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-action') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="smart_toy" size={14} className="text-primary" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-border text-xs">
          <Icon name={msg.actionIcon || 'build'} size={14} className="text-primary" />
          <span className="font-medium text-text-primary">{msg.actionLabel}</span>
          <span className="text-text-muted">{msg.content}</span>
        </div>
      </div>
    );
  }

  if (msg.type === 'ai-code') {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="smart_toy" size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-text-muted mb-1 flex items-center gap-1.5">
            <Icon name="code" size={12} />
            创建文件
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-gray-800 px-3 py-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <pre className="bg-gray-900 text-green-400 text-[11px] leading-relaxed px-3 py-3 overflow-x-auto">
              <code>{msg.content}</code>
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ai-text
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon name="smart_toy" size={14} className="text-primary" />
      </div>
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-50 border border-border text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
}

/* ─── Preview sub-components ─── */

function PreviewEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
      <Icon name="web" size={48} className="text-gray-300" />
      <p className="text-sm text-text-muted">在左侧输入需求后，这里将实时展示应用预览</p>
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon name="hourglass_top" size={28} className="text-primary animate-spin" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-primary">应用加载中</p>
        <p className="text-xs text-text-muted">请稍候，界面即将呈现</p>
      </div>
    </div>
  );
}

/* ─── Mobile device frame ─── */

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Phone shell */}
      <div className="w-[375px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200 overflow-hidden" style={{ minHeight: '680px' }}>
        {/* Status bar */}
        <div className="h-11 bg-gray-50 flex items-center justify-between px-6">
          <span className="text-[11px] font-semibold text-text-primary">9:41</span>
          <div className="w-20 h-5 rounded-full bg-black mx-auto" />
          <div className="flex items-center gap-1">
            <Icon name="signal_cellular_alt" size={12} className="text-text-primary" />
            <Icon name="wifi" size={12} className="text-text-primary" />
            <Icon name="battery_full" size={12} className="text-text-primary" />
          </div>
        </div>
        {/* App content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(680px - 2.75rem - 1.5rem)' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div className="flex justify-center py-2">
          <div className="w-32 h-1 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
}

function PreviewApp({
  isMobile,
  leaveType,
  setLeaveType,
}: {
  isMobile: boolean;
  leaveType: string;
  setLeaveType: (v: string) => void;
}) {
  return (
    <div className={isMobile ? '' : 'bg-white rounded-2xl shadow-lg border border-border overflow-hidden'}>
      {/* App top bar */}
      <div className={`border-b border-border flex items-center justify-between ${isMobile ? 'px-4 py-2.5 bg-white' : 'bg-gray-50 px-6 py-3'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg bg-primary/10 flex items-center justify-center ${isMobile ? 'w-7 h-7' : 'w-8 h-8'}`}>
            <Icon name="event_available" size={isMobile ? 16 : 18} className="text-primary" />
          </div>
          <div>
            <p className={`font-semibold text-text-primary ${isMobile ? 'text-xs' : 'text-sm'}`}>剩余年假查询</p>
            <p className={`text-text-muted ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>HR 数字化办公插件</p>
          </div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] text-text-muted">
          <Icon name="auto_awesome" size={10} className="text-primary" />
          AI 生成
        </span>
      </div>

      {/* App body */}
      <div className={`space-y-5 ${isMobile ? 'p-4' : 'p-8 space-y-6'}`}>
        {/* Stats */}
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 gap-4'}`}>
          <div className={`rounded-xl bg-gray-50 border border-border ${isMobile ? 'p-3.5' : 'p-5'}`}>
            <p className={`text-text-muted mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>当前年份</p>
            <p className={`font-bold text-text-primary ${isMobile ? 'text-base' : 'text-xl'}`}>2024 年度</p>
          </div>
          <div className={`rounded-xl bg-emerald-50 border border-emerald-200 ${isMobile ? 'p-3.5' : 'p-5'}`}>
            <p className={`text-emerald-600 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>剩余天数</p>
            <div className="flex items-baseline gap-1">
              <span className={`font-bold text-emerald-600 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>12.5</span>
              <span className={`text-text-muted ${isMobile ? 'text-xs' : 'text-sm'}`}>天</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
          <div>
            <label className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}>查询员工姓名</label>
            <input
              type="text"
              value="张三 (现职)"
              readOnly
              className={`w-full border border-border rounded-xl bg-gray-50 text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}
            />
          </div>
          <div>
            <label className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}>休假类型</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className={`w-full border border-border rounded-xl bg-gray-50 appearance-none text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}
            >
              <option>带薪年假</option>
            </select>
          </div>
        </div>

        {/* Query button */}
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('查询功能开发中', 'info')}
          className={`w-full rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm'}`}
        >
          立即查询
          <Icon name="arrow_forward" size={isMobile ? 14 : 16} />
        </button>

        <p className={`text-text-muted text-center ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
          数据来源于公司 HR Core 系统，最后更新于：今天 09:30
        </p>
      </div>
    </div>
  );
}
