/**
 * OpenClawPage — 按类型分栏布局
 *
 * notification（消息）→ A+B+C+D：B 栏 EventDetailPanel 四分栏原始样式
 * decision/task/goal → A+C+D：C 栏上下文卡片 + 对话，D 栏按需展开
 */
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore } from '../../../application/stores/uiStore';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useNotificationStore } from '../../../application/stores/notificationStore';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useAgentChat } from '../../../application/hooks/useAgentChat';
import type { Attachment, CoTMessage } from '../../../domain/agent/CoTMessage';
import { Icon } from '../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../domain/agent/DrawerContent';
import { OpenClawDrawer } from './OpenClawDrawer';
import { TaskDetailView } from './TaskDetailView';
import { MessageBlockRenderer } from './blocks/MessageBlockRenderer';
import { OpenClawComposer } from './OpenClawComposer';
import { AttentionColumn } from './AttentionColumn';
import { EventDetailPanel } from './EventDetailPanel';
import { TaskInitPage } from './TaskInitPage';
import { GoalInitPage } from './GoalInitPage';
import { DecisionInitPage } from './DecisionInitPage';
import { OpenClawWelcomePage } from './OpenClawWelcomePage';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => (
        att.type === 'image' ? (
          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={att.url} alt={att.name} className="max-w-[300px] max-h-[200px] rounded-lg border border-white/10 object-cover" />
          </a>
        ) : (
          <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04]">
            <Icon name={att.type === 'audio' ? 'audio_file' : 'attach_file'} size={16} className="text-slate-400" />
            <div className="min-w-0">
              <p className="text-[11px] text-slate-200 truncate max-w-[180px]">{att.name}</p>
              <p className="text-[10px] text-slate-500">{formatSize(att.size)}</p>
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function MessageBubble({ msg, openDrawer }: { msg: CoTMessage; openDrawer: (c: OpenClawDrawerContent) => void }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-1' : ''}`}>
        {msg.cotSteps && msg.cotSteps.length > 0 && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="psychology" size={16} className="text-primary" />
                <span className="text-xs font-medium text-primary">思维链路</span>
                <span className="text-[10px] text-slate-500">
                  {msg.cotSteps.length} 步骤 · {msg.cotSteps.filter((s) => s.status === 'done').length} 完成
                </span>
              </div>
              <button
                type="button"
                onClick={() => openDrawer({ type: 'cot-detail', title: '推理过程', data: { messageId: msg.id } })}
                className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"
              >
                展开推理过程
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
            {msg.cotSteps.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5 truncate">
                {msg.cotSteps[msg.cotSteps.length - 1].label} — {msg.cotSteps[msg.cotSteps.length - 1].detail}
              </p>
            )}
          </div>
        )}

        {msg.blocks && msg.blocks.length > 0 && (
          <div className="mb-2">
            <MessageBlockRenderer blocks={msg.blocks} onOpenDrawer={openDrawer} />
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed [&_code]:text-primary [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono ${
            msg.role === 'user'
              ? 'bg-bg-active text-slate-100 chat-bubble-sent'
              : 'bg-white/5 text-slate-200 chat-bubble-received'
          } ${msg.role !== 'user' ? 'openclaw-markdown [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-1.5 [&_li]:mb-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_blockquote]:my-1.5 [&_hr]:border-white/10 [&_hr]:my-2' : ''}`}
        >
          {msg.html ? (
            <div dangerouslySetInnerHTML={{ __html: msg.html }} />
          ) : msg.role !== 'user' && msg.text ? (
            <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
          ) : (
            msg.text
          )}
        </div>

        {msg.attachments && msg.attachments.length > 0 && (
          <AttachmentList attachments={msg.attachments} />
        )}

        <p className={`text-[10px] text-slate-500 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
          {formatTime(msg.timestamp)}{msg.role === 'user' ? ' · 已送达' : ''}
        </p>
      </div>
    </div>
  );
}

export function OpenClawPage() {
  const subView = useUIStore((s) => s.subView);
  const bottomRef = useRef<HTMLDivElement>(null);

  const drawerContent = useOpenClawStore((s) => s.drawerContent);
  const openDrawer = useOpenClawStore((s) => s.openDrawer);
  const activeSharedAgentId = useOpenClawStore((s) => s.activeSharedAgentId);
  const returnToPrimary = useOpenClawStore((s) => s.returnToPrimaryAgent);
  const discussingNotificationId = useOpenClawStore((s) => s.discussingNotificationId);
  const discussingDecisionId = useOpenClawStore((s) => s.discussingDecisionId);
  const discussingTaskId = useOpenClawStore((s) => s.discussingTaskId);
  const discussingGoalId = useOpenClawStore((s) => s.discussingGoalId);
  const sharedAgents = useAgentStore((s) => s.sharedAgents);

  const [radarCollapsed, setRadarCollapsed] = useState(false);

  const activeSharedAgent = activeSharedAgentId
    ? sharedAgents.find((a) => a.id === activeSharedAgentId)
    : null;

  const { messages, sendMessage, isSending } = useAgentChat();

  useEffect(() => {
    useOpenClawStore.getState().initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, discussingNotificationId, discussingDecisionId, discussingTaskId, discussingGoalId]);

  /** When discussion card appears, scroll to top to show it in viewport */
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (discussingNotificationId || discussingDecisionId || discussingTaskId || discussingGoalId) {
      requestAnimationFrame(() => {
        scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, [discussingNotificationId, discussingDecisionId, discussingTaskId, discussingGoalId]);

  const handleSend = useCallback((text: string, attachments?: Attachment[]) => {
    if ((!text.trim() && !attachments?.length) || isSending) return;
    sendMessage(text, attachments);
  }, [isSending, sendMessage]);

  if (subView === 'openclaw:task-detail') {
    return <TaskDetailView />;
  }

  return (
    <div className="flex h-full">
      {/* A: Event radar */}
      <AttentionColumn
        collapsed={radarCollapsed}
        onToggleCollapse={() => setRadarCollapsed(!radarCollapsed)}
      />

      {/* B: Notification detail — message types use original 4-column with EventDetailPanel */}
      {discussingNotificationId && <EventDetailPanel />}

      {/* C: Command console — decision/task/goal use C column cards */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Shared agent header (data-driven) */}
        {activeSharedAgent && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/[0.02] shrink-0">
            <button
              type="button"
              onClick={returnToPrimary}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              <Icon name="arrow_back" size={16} />
            </button>
            <Icon name={activeSharedAgent.icon || 'smart_toy'} size={18} className="text-primary" />
            <span className="text-sm font-medium text-slate-200">{activeSharedAgent.name}</span>
            <span className="text-xs text-slate-500">{activeSharedAgent.role}</span>
          </div>
        )}

        {/* Scrollable area — data-driven content */}
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto dcf-scrollbar px-6 py-4 space-y-4">
          {/* Discussion mode: context anchors (decision/task/goal in C column) */}
          {discussingDecisionId && <DecisionInitPage />}
          {discussingTaskId && <TaskInitPage onOpenDrawer={openDrawer} />}
          {discussingGoalId && <GoalInitPage onOpenDrawer={openDrawer} />}

          {/* Welcome page — only when no active discussion and no messages */}
          {!discussingNotificationId && !discussingDecisionId && !discussingTaskId && !discussingGoalId && messages.length === 0 && (
            <OpenClawWelcomePage onStartChat={(text) => sendMessage(text)} />
          )}

          {/* Full message stream */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} openDrawer={openDrawer} />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Composer — always present */}
        <div className="relative shrink-0">
          <OpenClawComposer
            onSend={handleSend}
            disabled={isSending}
            placeholder={
              discussingNotificationId
                ? (useNotificationStore.getState().notifications.find(n => n.id === discussingNotificationId)?.channel === 'email'
                  ? '输入邮件回复要求，如"修改草稿"、"用正式语气重写"…'
                  : '向 Agent 提问或下达指令…')
                : '发送消息或输入 \'/\' 唤起指令圈…'
            }
            autoFocus
          />
        </div>
      </div>

      {/* D: Intelligence panel */}
      {drawerContent && <OpenClawDrawer />}
    </div>
  );
}
