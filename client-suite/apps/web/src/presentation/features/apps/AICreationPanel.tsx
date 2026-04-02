/**
 * AICreationPanel — 对话式创建（左侧对话 + 右侧实时预览）
 * 借鉴 Coze IDE 分栏模式，用户可通过自然语言持续迭代修改
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { inferDisplayMode, type DisplayMode } from '../../../data/mockApps';

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

/* ─── Template system ─── */

type TemplateKey = 'form-query' | 'daily-report' | 'ticket-system';

interface AppTemplate {
  key: TemplateKey;
  name: string;
  icon: string;
  color: string;
  tagline: string;
  description: string;
  prompt: string;
  keywords: string[];
  codeSnippet: string;
  thinkingDetail: string;
}

const APP_TEMPLATES: AppTemplate[] = [
  {
    key: 'form-query',
    name: '数据查询',
    icon: 'search',
    color: '#007AFF',
    tagline: '表单查询 · 数据展示',
    description: '自动生成表单输入 + 后端查询 + 结果展示的完整应用',
    prompt: '创建一个剩余年假查询应用',
    keywords: ['查询', '搜索', '年假', '余额', '工资', '考勤', '数据', '统计', '报表'],
    codeSnippet: `// screens/leave-query/index.tsx
export default function LeaveQueryApp() {
  const [name, setName] = useState("");
  return (
    <div className="app-container">
      <Header title="剩余年假查询" />
      <QueryForm onSubmit={handleQuery} />
      <ResultPanel data={result} />
    </div>
  );
}`,
    thinkingDetail: '这是一个需要表单和数据查询的应用。让我先分析一下：\n1. 这是一个单页应用，需要表单输入\n2. 需要对接后端查询接口\n3. 需要结果展示区域',
  },
  {
    key: 'daily-report',
    name: '信息录入',
    icon: 'edit_note',
    color: '#34C759',
    tagline: '富文本编辑 · 表单提交',
    description: '带模板的内容编辑器，支持富文本、附件和定时提交',
    prompt: '做一个团队日报提交工具',
    keywords: ['日报', '周报', '提交', '填写', '编辑', '记录', '笔记', '文档', '报告', '汇报'],
    codeSnippet: `// screens/daily-report/index.tsx
export default function DailyReportApp() {
  const [sections, setSections] = useState(TEMPLATE);
  return (
    <div className="report-container">
      <DatePicker value={today} />
      <SectionEditor sections={sections} />
      <SubmitBar onSubmit={handleSubmit} />
    </div>
  );
}`,
    thinkingDetail: '这是一个内容编辑类应用。需要：\n1. 日期选择和模板切换\n2. 多段落富文本编辑区\n3. 提交/暂存操作和历史记录',
  },
  {
    key: 'ticket-system',
    name: '工单流程',
    icon: 'assignment',
    color: '#FF9500',
    tagline: '工单创建 · 流程流转',
    description: '支持创建、流转、处理的完整工单生命周期管理',
    prompt: '生成设备报修工单系统',
    keywords: ['工单', '报修', '审批', '流程', '申请', '维修', '报障', '服务', '请假', '采购'],
    codeSnippet: `// screens/ticket/index.tsx
export default function TicketApp() {
  const [tickets, setTickets] = useState([]);
  return (
    <div className="ticket-container">
      <TicketHeader onNew={openForm} />
      <TicketList items={tickets} />
      <TicketDetail selected={current} />
    </div>
  );
}`,
    thinkingDetail: '这是一个工单流程类应用。需要：\n1. 工单列表和状态筛选\n2. 创建工单表单（含分类/优先级）\n3. 流转状态追踪和处理反馈',
  },
];

function matchTemplate(prompt: string): AppTemplate {
  const lower = prompt.toLowerCase();
  let best: AppTemplate = APP_TEMPLATES[0];
  let bestScore = 0;
  for (const tpl of APP_TEMPLATES) {
    const score = tpl.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = tpl;
    }
  }
  return best;
}

/* ─── Simulated AI workflow ─── */

interface WorkflowStep {
  delay: number;
  msg: Omit<ChatMessage, 'id'>;
}

function buildInitialWorkflow(prompt: string, template: AppTemplate): WorkflowStep[] {
  const shortPrompt = prompt.slice(0, 30) + (prompt.length > 30 ? '…' : '');
  return [
    { delay: 300, msg: { type: 'ai-thinking', content: '正在分析需求，规划实现方案…', streaming: true } },
    { delay: 1200, msg: { type: 'ai-thinking', content: `用户要求创建「${shortPrompt}」，${template.thinkingDetail}` } },
    { delay: 1800, msg: { type: 'ai-action', content: '更新计划', actionIcon: 'checklist', actionLabel: '更新计划' } },
    { delay: 2200, msg: { type: 'ai-action', content: '分析数据模型与接口依赖', actionIcon: 'schema', actionLabel: '思考过程' } },
    { delay: 2800, msg: { type: 'ai-action', content: '正在生成页面布局与交互逻辑…', actionIcon: 'code', actionLabel: '创建文件' } },
    { delay: 3600, msg: { type: 'ai-code', content: template.codeSnippet } },
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
  /** iOS-style card expand: origin rect from the trigger card */
  originRect?: DOMRect | null;
}

export function AICreationPanel({ mode, onClose, initialAppName, onSwitchToEdit }: AICreationPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>(mode === 'create' ? 'idle' : 'ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [activeTemplate, setActiveTemplate] = useState<AppTemplate | null>(
    mode === 'create' ? null : APP_TEMPLATES[0],
  );

  const [deployStep, setDeployStep] = useState<'mode' | 'confirm'>('mode');
  const [selectedMode, setSelectedMode] = useState<DisplayMode>('tool');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* In edit mode, seed the chat with editing context */
  useEffect(() => {
    if (mode !== 'edit' || !initialAppName) return;
    // Try to match template by app name
    const matched = APP_TEMPLATES.find((t) =>
      t.keywords.some((kw) => initialAppName.toLowerCase().includes(kw)),
    );
    if (matched) setActiveTemplate(matched);
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
      const tpl = matchTemplate(text);
      setActiveTemplate(tpl);
      setPreviewState('loading');
      const workflow = buildInitialWorkflow(text, tpl);
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
    const firstPrompt = messages.find(m => m.type === 'user')?.content ?? '';
    setSelectedMode(inferDisplayMode(firstPrompt));
    setDeployStep('mode');
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
      <div className="flex-1 flex flex-col min-h-0 bg-bg-white-var card-expand-in">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-text-secondary transition-colors"
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
            <div className="flex items-center gap-1 bg-fill-tertiary rounded-lg p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-bg-white-var text-text-primary shadow-sm'
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
                    ? 'bg-bg-white-var text-text-primary shadow-sm'
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-primary hover:bg-bg-hover transition-colors"
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
          <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0 bg-bg-white-var">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 dcf-scrollbar">
              {messages.length === 0 && (
                <EmptyChat onSelect={(text) => handleSend(text)} onHover={setActiveTemplate} />
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
                  className="flex-1 px-3 py-2.5 text-sm border border-border rounded-xl bg-fill-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-text-muted/60 leading-relaxed overflow-hidden text-text-primary"
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
        <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-bg-light">
          {/* Preview content */}
          <div className="flex-1 overflow-auto dcf-scrollbar p-6 flex justify-center">
            {previewState === 'idle' && <PreviewIdle hoveredTemplate={activeTemplate} onSelect={(tpl) => { setActiveTemplate(tpl); handleSend(tpl.prompt); }} />}
            {previewState === 'loading' && <PreviewLoading />}
            {previewState === 'ready' && activeTemplate && (
              viewportMode === 'mobile' ? (
                <MobileFrame>
                  <TemplatePreview template={activeTemplate} isMobile />
                </MobileFrame>
              ) : (
                <div className="w-full max-w-4xl">
                  <TemplatePreview template={activeTemplate} isMobile={false} />
                </div>
              )
            )}
          </div>

          {/* Bottom bar */}
          {previewState === 'ready' && (
            <div className="shrink-0 border-t border-border bg-bg-white-var px-4 py-2 flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Icon name="link" size={12} className="text-primary" />
                {mode === 'view' ? '点击编辑按钮可修改应用' : '点击部署按钮，可发布为独立应用地址'}
              </span>
              <span>{viewportMode === 'desktop' ? '1440 × 900' : '375 × 812'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Deploy dialog — two-step: mode selection → confirm */}
      {showDeployConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDeployConfirm(false)}>
          <div className="bg-bg-white-var rounded-2xl shadow-xl border border-border p-6 w-[340px] space-y-4" onClick={(e) => e.stopPropagation()}>
            {deployStep === 'mode' ? (
              <>
                <p className="text-sm font-semibold text-text-primary">选择展示方式</p>
                <div className="space-y-2">
                  {([
                    { mode: 'live' as DisplayMode, icon: 'cell_tower', label: '实时内容', desc: '常驻主面板，展示最新内容' },
                    { mode: 'report' as DisplayMode, icon: 'bar_chart', label: '周期报告', desc: '有新数据时突出提醒' },
                    { mode: 'tool' as DisplayMode, icon: 'build', label: '快捷工具', desc: '工具栏快捷入口，需要时打开' },
                  ]).map((opt) => {
                    const recommended = opt.mode === inferDisplayMode(messages.find(m => m.type === 'user')?.content ?? '');
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => setSelectedMode(opt.mode)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                          selectedMode === opt.mode
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-bg-hover'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                          selectedMode === opt.mode ? 'border-primary' : 'border-text-muted/30'
                        }`}>
                          {selectedMode === opt.mode && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Icon name={opt.icon} size={16} className="text-text-secondary" />
                            <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                            {recommended && (
                              <span className="text-[10px] text-primary font-medium">(推荐)</span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeployStep('confirm')}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    下一步
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeployConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon name="rocket_launch" size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">确认发布应用？</p>
                    <p className="text-xs text-text-muted mt-0.5">发布后其他成员可在应用中心使用</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fill-tertiary border border-border text-xs text-text-secondary">
                  <Icon name={selectedMode === 'live' ? 'cell_tower' : selectedMode === 'report' ? 'bar_chart' : 'build'} size={14} className="text-primary" />
                  展示方式：{selectedMode === 'live' ? '实时内容' : selectedMode === 'report' ? '周期报告' : '快捷工具'}
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
                    onClick={() => setDeployStep('mode')}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    上一步
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Chat sub-components ─── */

function EmptyChat({ onSelect, onHover }: { onSelect: (text: string) => void; onHover: (tpl: AppTemplate | null) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-5">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon name="auto_awesome" size={24} className="text-primary" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text-primary">AI 应用创建助手</p>
        <p className="text-xs text-text-muted leading-relaxed max-w-[260px]">
          选择模板快速开始，或直接描述需求
        </p>
      </div>
      <div className="w-full space-y-2">
        {APP_TEMPLATES.map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => onSelect(tpl.prompt)}
            onMouseEnter={() => onHover(tpl)}
            onMouseLeave={() => onHover(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-bg-white-var hover:border-primary/40 hover:shadow-sm transition-all text-left group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${tpl.color}14` }}
            >
              <Icon name={tpl.icon} size={18} style={{ color: tpl.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">{tpl.name}</p>
              <p className="text-[10px] text-text-muted truncate">{tpl.tagline}</p>
            </div>
            <Icon name="arrow_forward" size={14} className="text-text-muted group-hover:text-primary shrink-0 transition-colors" />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-text-muted">
        或直接输入自定义需求，如「做一个会议室预约系统」
      </p>
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
          <div className="text-xs text-text-secondary leading-relaxed bg-fill-tertiary border border-border rounded-xl px-3 py-2.5 whitespace-pre-wrap">
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fill-tertiary border border-border text-xs">
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
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-fill-tertiary border border-border text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
}

/* ─── Preview sub-components ─── */

function PreviewIdle({ hoveredTemplate, onSelect }: { hoveredTemplate: AppTemplate | null; onSelect: (tpl: AppTemplate) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto">
      {hoveredTemplate ? (
        /* Hovered template: show scaled-down preview card */
        <div className="w-full animate-in fade-in duration-200">
          <div className="mb-4 text-center">
            <p className="text-xs text-text-muted">模板预览</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">{hoveredTemplate.name}</p>
          </div>
          <div className="transform scale-90 origin-top">
            <TemplatePreview template={hoveredTemplate} isMobile={false} />
          </div>
        </div>
      ) : (
        /* Default: template gallery grid */
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-fill-tertiary flex items-center justify-center mx-auto">
              <Icon name="dashboard_customize" size={28} className="text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-primary">选择模板开始创建</p>
            <p className="text-xs text-text-muted">点击模板卡片快速生成，或在左侧输入自定义需求</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {APP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => onSelect(tpl)}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-bg-white-var hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${tpl.color}12` }}
                >
                  <Icon name={tpl.icon} size={28} style={{ color: tpl.color }} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">{tpl.name}</p>
                  <p className="text-[11px] text-text-muted leading-relaxed">{tpl.description}</p>
                </div>
                <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  点击生成 <Icon name="arrow_forward" size={10} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
      <div className="w-[375px] bg-bg-white-var rounded-[2.5rem] shadow-2xl border border-border overflow-hidden" style={{ minHeight: '680px' }}>
        <div className="h-11 bg-fill-tertiary flex items-center justify-between px-6">
          <span className="text-[11px] font-semibold text-text-primary">9:41</span>
          <div className="w-20 h-5 rounded-full bg-black mx-auto" />
          <div className="flex items-center gap-1">
            <Icon name="signal_cellular_alt" size={12} className="text-text-primary" />
            <Icon name="wifi" size={12} className="text-text-primary" />
            <Icon name="battery_full" size={12} className="text-text-primary" />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(680px - 2.75rem - 1.5rem)' }}>
          {children}
        </div>
        <div className="flex justify-center py-2">
          <div className="w-32 h-1 rounded-full bg-text-muted/30" />
        </div>
      </div>
    </div>
  );
}

/* ─── Template-aware preview ─── */

function TemplatePreview({ template, isMobile }: { template: AppTemplate; isMobile: boolean }) {
  const tpl = template.key;
  return (
    <div className={isMobile ? '' : 'bg-bg-white-var rounded-2xl shadow-lg border border-border overflow-hidden'}>
      {/* App top bar */}
      <div className={`border-b border-border flex items-center justify-between ${isMobile ? 'px-4 py-2.5 bg-bg-white-var' : 'bg-fill-tertiary px-6 py-3'}`}>
        <div className="flex items-center gap-2.5">
          <div
            className={`rounded-lg flex items-center justify-center ${isMobile ? 'w-7 h-7' : 'w-8 h-8'}`}
            style={{ background: `${template.color}14` }}
          >
            <Icon name={template.icon} size={isMobile ? 16 : 18} style={{ color: template.color }} />
          </div>
          <div>
            <p className={`font-semibold text-text-primary ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {tpl === 'form-query' ? '剩余年假查询' : tpl === 'daily-report' ? '团队日报' : '设备报修'}
            </p>
            <p className={`text-text-muted ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
              {template.tagline}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] text-text-muted">
          <Icon name="auto_awesome" size={10} className="text-primary" />
          AI 生成
        </span>
      </div>

      {/* Template-specific body */}
      <div className={isMobile ? 'p-4 space-y-4' : 'p-8 space-y-6'}>
        {tpl === 'form-query' && <FormQueryBody isMobile={isMobile} />}
        {tpl === 'daily-report' && <DailyReportBody isMobile={isMobile} />}
        {tpl === 'ticket-system' && <TicketSystemBody isMobile={isMobile} />}
      </div>
    </div>
  );
}

/* ─── Template bodies ─── */

function FormQueryBody({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 gap-4'}`}>
        <div className={`rounded-xl bg-fill-tertiary border border-border ${isMobile ? 'p-3.5' : 'p-5'}`}>
          <p className={`text-text-muted mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>当前年份</p>
          <p className={`font-bold text-text-primary ${isMobile ? 'text-base' : 'text-xl'}`}>2024 年度</p>
        </div>
        <div className={`rounded-xl bg-success/10 border border-success/20 ${isMobile ? 'p-3.5' : 'p-5'}`}>
          <p className={`text-success mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>剩余天数</p>
          <div className="flex items-baseline gap-1">
            <span className={`font-bold text-success ${isMobile ? 'text-2xl' : 'text-3xl'}`}>12.5</span>
            <span className={`text-text-muted ${isMobile ? 'text-xs' : 'text-sm'}`}>天</span>
          </div>
        </div>
      </div>
      <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
        <div>
          <label className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}>查询员工姓名</label>
          <input type="text" value="张三 (现职)" readOnly className={`w-full border border-border rounded-xl bg-fill-tertiary text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`} />
        </div>
        <div>
          <label className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}>休假类型</label>
          <div className={`w-full border border-border rounded-xl bg-fill-tertiary text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}>带薪年假</div>
        </div>
      </div>
      <button type="button" className={`w-full rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm'}`}>
        立即查询 <Icon name="arrow_forward" size={isMobile ? 14 : 16} />
      </button>
      <p className={`text-text-muted text-center ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>数据来源于公司 HR Core 系统</p>
    </>
  );
}

function DailyReportBody({ isMobile }: { isMobile: boolean }) {
  const sz = isMobile ? 'text-xs' : 'text-sm';
  const szSm = isMobile ? 'text-[10px]' : 'text-xs';
  return (
    <>
      {/* Date + template picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="calendar_today" size={isMobile ? 14 : 16} className="text-primary" />
          <span className={`font-semibold text-text-primary ${sz}`}>2024-03-14（周四）</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full border border-border ${szSm} text-text-muted`}>日报模板</span>
      </div>
      {/* Sections */}
      {[
        { title: '今日完成', icon: 'check_circle', color: '#34C759', items: ['完成用户认证模块开发', '修复工单列表分页 bug'] },
        { title: '进行中', icon: 'pending', color: '#FF9500', items: ['数据报表页面联调'] },
        { title: '明日计划', icon: 'event_upcoming', color: '#007AFF', items: ['集成测试 + 代码 review', '准备周五 demo 演示'] },
      ].map((sec) => (
        <div key={sec.title} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Icon name={sec.icon} size={isMobile ? 14 : 16} style={{ color: sec.color }} />
            <span className={`font-semibold text-text-primary ${szSm}`}>{sec.title}</span>
          </div>
          <div className={`rounded-xl border border-border bg-fill-tertiary ${isMobile ? 'p-3' : 'p-4'} space-y-1.5`}>
            {sec.items.map((item) => (
              <div key={item} className={`flex items-start gap-2 ${szSm} text-text-secondary`}>
                <span className="text-text-muted mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Submit bar */}
      <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
        <button type="button" className={`flex-1 rounded-xl bg-[#34C759] text-white font-semibold flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm'}`}>
          <Icon name="send" size={isMobile ? 14 : 16} />
          提交日报
        </button>
        <button type="button" className={`rounded-xl border border-border text-text-secondary font-medium flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm px-6'}`}>
          暂存草稿
        </button>
      </div>
    </>
  );
}

function TicketSystemBody({ isMobile }: { isMobile: boolean }) {
  const sz = isMobile ? 'text-xs' : 'text-sm';
  const szSm = isMobile ? 'text-[10px]' : 'text-xs';
  const TICKETS = [
    { id: 'TK-0042', title: '打印机卡纸', status: '处理中', statusColor: '#FF9500', priority: '中', time: '2 小时前' },
    { id: 'TK-0041', title: '网络连接不稳定', status: '待分配', statusColor: '#FF3B30', priority: '高', time: '3 小时前' },
    { id: 'TK-0040', title: '笔记本电池鼓包', status: '已完成', statusColor: '#34C759', priority: '中', time: '昨天' },
  ];
  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['全部', '待分配', '处理中', '已完成'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={`px-3 py-1 rounded-full ${szSm} font-medium transition-colors ${
                i === 0 ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'text-text-muted hover:bg-bg-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button type="button" className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF9500] text-white ${szSm} font-medium`}>
          <Icon name="add" size={14} />
          新建工单
        </button>
      </div>
      {/* Ticket list */}
      <div className="space-y-2">
        {TICKETS.map((tk) => (
          <div key={tk.id} className={`flex items-center gap-3 ${isMobile ? 'p-3' : 'p-4'} rounded-xl border border-border bg-bg-white-var hover:shadow-sm transition-shadow`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-mono ${szSm} text-text-muted`}>{tk.id}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white`} style={{ background: tk.statusColor }}>{tk.status}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border border-border text-text-muted`}>P: {tk.priority}</span>
              </div>
              <p className={`font-medium text-text-primary ${sz}`}>{tk.title}</p>
            </div>
            <span className={`${szSm} text-text-muted shrink-0`}>{tk.time}</span>
            <Icon name="chevron_right" size={16} className="text-text-muted shrink-0" />
          </div>
        ))}
      </div>
      {/* Stats bar */}
      <div className={`flex items-center justify-between rounded-xl bg-fill-tertiary border border-border ${isMobile ? 'p-3' : 'p-4'}`}>
        {[
          { label: '待分配', value: '3', color: '#FF3B30' },
          { label: '处理中', value: '5', color: '#FF9500' },
          { label: '本周完成', value: '12', color: '#34C759' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`} style={{ color: s.color }}>{s.value}</p>
            <p className={`${szSm} text-text-muted`}>{s.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}
