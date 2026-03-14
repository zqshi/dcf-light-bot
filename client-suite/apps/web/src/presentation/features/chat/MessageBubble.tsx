import type { ChatMessage } from '../../../domain/chat/ChatMessage';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { FileCard } from '../../components/ui/FileCard';
import { Icon } from '../../components/ui/Icon';
import { SystemNotificationCard } from './SystemNotificationCard';
import { ApprovalRequestCard } from './ApprovalRequestCard';
import { BriefingCard } from './BriefingCard';
import { useAuthStore } from '../../../application/stores/authStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { getMatrixClient, globalSelectRoom } from '../../../application/hooks/useMatrixClient';
import { useToastStore } from '../../../application/stores/toastStore';

function simpleMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-black/5 rounded text-xs font-mono">$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const userId = useAuthStore((s) => s.user?.userId);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const isOwn = message.isFromUser(userId ?? '');

  const handleDrawerClick = () => {
    if (message.drawerContent) {
      const dc = message.drawerContent;
      const data = dc.data ?? (dc.content ? { [dc.type === 'code' ? 'code' : 'html']: dc.content, language: dc.language } : {});
      openDrawer({
        type: dc.type,
        title: dc.title ?? '内容',
        data,
      });
    }
  };

  return (
    <div className={`flex gap-2.5 dcf-fade-in ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar
        letter={message.avatarLetter}
        size={36}
        gradient={message.isBot ? 'bg-gradient-to-br from-primary to-[#5856D6]' : undefined}
      />
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender + time */}
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-medium text-text-primary">{message.senderName}</span>
          {message.isBot && (
            <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 rounded-full uppercase">
              Bot
            </span>
          )}
          <time className="text-[11px] text-text-muted">{message.formattedTime}</time>
        </div>

        {/* Image message */}
        {message.contentType === 'image' && message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt={message.body || '图片'}
            className="max-w-full rounded-xl border border-border object-cover max-h-[300px]"
          />
        )}

        {/* File message */}
        {message.contentType === 'file' && message.mediaUrl && (
          <FileCard
            fileName={message.body || '文件'}
            fileSize={message.fileSize ?? '未知大小'}
            editStatus="edited"
            editMeta="刚才由你编辑"
            onDownload={() => window.open(message.mediaUrl, '_blank')}
            onOpenEditor={() => {
              if (message.drawerContent) {
                handleDrawerClick();
              } else {
                openDrawer({ type: 'doc', title: message.body || '文件', data: {} });
              }
            }}
          />
        )}

        {/* System notification card (approval passed / rejected) */}
        {message.contentType === 'system-notification' && message.systemNotification && (
          <SystemNotificationCard
            data={
              message.systemNotification.notificationType === 'approved'
                ? {
                    type: 'approved',
                    documentName: message.systemNotification.documentName,
                    documentId: message.systemNotification.documentId,
                    approver: message.systemNotification.approver,
                    time: message.formattedTime,
                  }
                : {
                    type: 'rejected',
                    documentName: message.systemNotification.documentName,
                    documentId: message.systemNotification.documentId,
                    approver: message.systemNotification.approver,
                    reason: message.systemNotification.reason ?? '',
                    time: message.formattedTime,
                  }
            }
          />
        )}

        {/* Approval request card (stitch_16) */}
        {message.contentType === 'approval-request' && message.approvalRequest && (
          <ApprovalRequestCard
            data={{
              ...message.approvalRequest,
              time: message.formattedTime,
            }}
          />
        )}

        {/* AI Briefing card (stitch_21) */}
        {message.contentType === 'briefing' && message.briefing && (
          <BriefingCard data={message.briefing} />
        )}

        {/* Text bubble (show for text, agent-card, drawer-content types) */}
        {!['image', 'file', 'system-notification', 'approval-request', 'briefing'].includes(message.contentType) && (
          <div
            className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              isOwn
                ? 'bg-primary text-white chat-bubble-sent'
                : 'bg-bg-white-var border border-border chat-bubble-received'
            }`}
            onDoubleClick={() => {
              navigator.clipboard.writeText(message.body).catch(() => {});
            }}
            title="双击复制文本"
          >
            <span dangerouslySetInnerHTML={{ __html: simpleMarkdown(message.body) }} />
          </div>
        )}

        {/* Agent card attachment */}
        {message.agentCard && (
          <Card hoverable className="mt-2 p-3 max-w-[280px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold">
                {message.agentCard.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{message.agentCard.name}</p>
                <p className="text-xs text-text-secondary">{message.agentCard.role}</p>
              </div>
            </div>
            {Array.isArray(message.agentCard.tags) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(message.agentCard.tags as string[]).map((tag: string) => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                const card = message.agentCard;
                const agentUserId = card?.userId as string | undefined;
                const agentId = card?.id as string | undefined;
                const client = getMatrixClient();

                // Case 1: Have userId — create or find DM
                if (agentUserId && client) {
                  try {
                    const roomId = await client.createDmRoom(agentUserId);
                    if (roomId) {
                      useUIStore.getState().setDock('messages');
                      await globalSelectRoom(roomId);
                      return;
                    }
                  } catch {
                    useToastStore.getState().addToast('创建对话失败', 'error');
                    return;
                  }
                }

                // Case 2: No userId but have id — find existing room by id pattern
                if (agentId && client) {
                  const rooms = client.getRooms();
                  const match = rooms.find((r) => r.id.includes(agentId));
                  if (match) {
                    useUIStore.getState().setDock('messages');
                    await globalSelectRoom(match.id);
                    return;
                  }
                }

                // Fallback: just switch to messages dock
                useUIStore.getState().setDock('messages');
                useToastStore.getState().addToast('未找到该数字员工的对话房间', 'info');
              }}
              className="mt-2 w-full text-xs text-primary font-medium hover:bg-primary/5 rounded py-1 transition-colors"
            >
              开始对话 →
            </button>
          </Card>
        )}

        {/* Drawer content attachment — primary entry point for side panel */}
        {message.drawerContent && (
          <button
            type="button"
            onClick={handleDrawerClick}
            className="mt-2 max-w-[300px] w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-gradient-to-r from-white/80 to-white/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all group text-left"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              message.drawerContent.type === 'code'
                ? 'bg-[#34C759]/10 text-[#34C759]'
                : 'bg-primary/10 text-primary'
            }`}>
              <Icon name={message.drawerContent.type === 'code' ? 'code' : 'description'} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{message.drawerContent.title ?? '查看内容'}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {message.drawerContent.type === 'code' ? '代码片段' : '协同文档'}
                <span className="text-primary group-hover:translate-x-0.5 inline-block transition-transform ml-1">→</span>
              </p>
            </div>
            <Icon name="open_in_new" size={14} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
