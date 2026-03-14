/**
 * TaskDetailView — 任务全屏详情 (openclaw_2)
 * Left: Agent CoT 对话区   Right: 进度环 + 子任务 + 日志
 */
import { useState } from 'react';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';
import { CircularProgress } from './CircularProgress';
import { SubTaskList, MOCK_SUBTASKS } from './SubTaskList';
import { ExecutionLogViewer, MOCK_LOGS } from './ExecutionLogViewer';

const COT_MESSAGES = [
  { id: 'c1', role: 'agent' as const, text: '正在建立安全审计连接至核心服务集群...' },
  { id: 'c2', role: 'agent' as const, text: '已完成 auth-service.js 的静态分析，检测到 2 个高危问题：\n1. JWT secret 硬编码（第 42 行）\n2. Cookie 缺少 HttpOnly 标志（第 78 行）' },
  { id: 'c3', role: 'user' as const, text: '给出修复建议并生成完整报告。' },
  { id: 'c4', role: 'agent' as const, text: '正在生成修复建议与安全报告，预计 30 秒内完成...' },
];

interface CotMsg {
  id: string;
  role: 'user' | 'agent';
  text: string;
}

export function TaskDetailView() {
  const setSubView = useUIStore((s) => s.setSubView);
  const [input, setInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState<CotMsg[]>(COT_MESSAGES);
  const toast = (msg: string) => useToastStore.getState().addToast(msg, 'info');

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setChatMsgs((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setInput('');
    // Simulate agent reply
    setTimeout(() => {
      setChatMsgs((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'agent',
        text: `收到指令："${text.slice(0, 30)}"，正在处理中...`,
      }]);
    }, 600 + Math.random() * 800);
  };

  return (
    <div className="flex h-full">
      {/* Left: CoT conversation */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-xs font-medium text-slate-300">思维链分析：当前扫描任务</span>
          <div className="flex-1" />
          <button type="button" onClick={() => toast('日志导出中...')} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Icon name="download" size={14} />
            导出日志
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto dcf-scrollbar px-6 py-4 space-y-3">
          {chatMsgs.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-bg-active text-slate-100 chat-bubble-sent'
                    : 'bg-white/5 text-slate-200 chat-bubble-received'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 px-6 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <input
              type="text"
              placeholder="输入指令或提问..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Task detail */}
      <div className="w-[400px] shrink-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setSubView(null)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <span className="text-sm font-medium text-slate-100">安全扫描任务详情 #882</span>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto dcf-scrollbar px-4 py-4 space-y-5">
          {/* Circular progress */}
          <div className="flex justify-center py-2">
            <CircularProgress percent={84} label="扫描中" />
          </div>

          {/* Sub-tasks */}
          <section>
            <h4 className="text-xs font-medium text-slate-300 mb-2">子任务状态</h4>
            <SubTaskList tasks={MOCK_SUBTASKS} />
          </section>

          {/* Logs */}
          <section>
            <h4 className="text-xs font-medium text-slate-300 mb-2">执行日志</h4>
            <ExecutionLogViewer logs={MOCK_LOGS} maxHeight={250} />
          </section>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-white/10 px-4 py-3 flex gap-2">
          <button type="button" onClick={() => toast('任务已停止')} className="flex-1 h-9 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1">
            <Icon name="stop" size={14} />
            停止任务
          </button>
          <button type="button" onClick={() => toast('正在生成报告...')} className="flex-1 h-9 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-1">
            <Icon name="summarize" size={14} />
            生成完整报告
          </button>
        </div>
      </div>
    </div>
  );
}
