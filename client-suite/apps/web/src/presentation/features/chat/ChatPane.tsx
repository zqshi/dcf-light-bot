/**
 * ChatPane — 聊天主区域
 * 组合 ChatHeader + 消息时间线 + ChatComposer
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTimeline } from '../../../application/hooks/useTimeline';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useChatStore } from '../../../application/stores/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { Icon } from '../../components/ui/Icon';
import { Drawer } from '../../layouts/Drawer';
import { useUIStore } from '../../../application/stores/uiStore';

export function ChatPane() {
  const { messages, currentRoomId, typingUsers } = useTimeline();
  const { sendMessage, sendFile, sendTyping } = useMatrixClient();
  const appMode = useUIStore((s) => s.appMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Smart scroll: only auto-scroll if user is near the bottom
  const isNearBottomRef = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  // Reset scroll state when switching rooms
  useEffect(() => {
    isNearBottomRef.current = true;
    setHasNewBelow(false);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentRoomId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      isNearBottomRef.current = near;
      if (near) setHasNewBelow(false);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (el && messages.length > 0) {
      setHasNewBelow(true);
    }
  }, [messages]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!currentRoomId) return;
      try {
        await sendMessage(currentRoomId, body);
      } catch {
        const { useToastStore } = await import('../../../application/stores/toastStore');
        useToastStore.getState().addToast('消息发送失败，请重试', 'error');
      }
    },
    [currentRoomId, sendMessage],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!currentRoomId) return;
      try {
        await sendFile(currentRoomId, file);
      } catch {
        const { useToastStore } = await import('../../../application/stores/toastStore');
        useToastStore.getState().addToast('文件发送失败，请重试', 'error');
      }
    },
    [currentRoomId, sendFile],
  );

  const handleTyping = useCallback(
    (typing: boolean) => { if (currentRoomId) sendTyping(currentRoomId, typing); },
    [currentRoomId, sendTyping],
  );

  const setDock = useUIStore((s) => s.setDock);

  if (!currentRoomId) {
    const entries = [
      { icon: 'smart_toy', label: '浏览共享 Agent', desc: '发现团队已发布的智能体', dock: 'agents' as const },
      { icon: 'psychology', label: '进入技能中心', desc: '管理与编排 Agent 技能', dock: 'skills' as const },
    ];
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Icon name="hub" size={28} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-1">欢迎使用 DCF</h2>
          <p className="text-sm text-text-secondary mb-6">选择一个会话开始聊天，或从下方快速进入</p>
          <div className="grid gap-3">
            {entries.map((e) => (
              <button
                key={e.dock}
                type="button"
                onClick={() => setDock(e.dock)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-bg-white-var hover:bg-bg-hover transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Icon name={e.icon} size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{e.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{e.desc}</p>
                </div>
                <Icon name="chevron_right" size={16} className="text-text-muted ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <ChatHeader />
        <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4 dcf-scrollbar">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-text-muted">暂无消息，发送一条开始对话吧</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>

        {typingUsers.length > 0 && (
          <div className="px-5 pb-1 flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
            <span className="text-xs text-text-muted italic">
              {typingUsers.map((u) => u.userId.replace(/@([^:]+):.*/, '$1')).join(', ')} 正在输入...
            </span>
          </div>
        )}

        {hasNewBelow && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setHasNewBelow(false);
            }}
            className="mx-auto mb-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-medium shadow-md hover:bg-primary/90 transition-colors flex items-center gap-1"
          >
            <Icon name="arrow_downward" size={14} />
            有新消息
          </button>
        )}
        <ChatComposer onSend={handleSend} onFileUpload={handleFile} onTyping={handleTyping} />
      </div>
      {appMode !== 'openclaw' && <Drawer />}
    </div>
  );
}
