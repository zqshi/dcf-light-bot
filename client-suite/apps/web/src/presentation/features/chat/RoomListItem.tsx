import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import type { ChatRoom } from '../../../domain/chat/ChatRoom';
import { getRoomActions, type RoomAction } from '../../../domain/chat/ChatRoom';
import { useChatStore } from '../../../application/stores/chatStore';
import { formatRelativeTime } from '../../../domain/shared/formatTime';

interface RoomListItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
}

const ACTION_META: Record<RoomAction, { icon: string; label: string }> = {
  pin:         { icon: 'push_pin', label: '置顶' },
  unpin:       { icon: 'push_pin', label: '取消置顶' },
  markRead:    { icon: 'done_all', label: '标为已读' },
  markUnread:  { icon: 'mark_email_unread', label: '标为未读' },
};

export function RoomListItem({ room, isActive, onClick }: RoomListItemProps) {
  const isSystem = room.type === 'system';
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const togglePin = useChatStore((s) => s.togglePin);
  const toggleUnread = useChatStore((s) => s.toggleUnread);

  const actions = getRoomActions(room);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (actions.length === 0) return;
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleAction = (action: RoomAction) => {
    if (action === 'pin' || action === 'unpin') togglePin(room.id);
    if (action === 'markRead' || action === 'markUnread') toggleUnread(room.id);
    setMenuPos(null);
  };

  // Close menu on outside click / scroll / Escape
  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuPos]);

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContext}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
          isActive
            ? 'bg-primary/8 border border-primary/15'
            : room.pinned
              ? 'bg-primary/[0.03] hover:bg-primary/[0.06] border border-transparent'
              : 'hover:bg-bg-hover border border-transparent'
        }`}
      >
        <Avatar letter={room.avatarLetter} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-text-primary truncate flex-1">
              {room.name}
            </span>
            {room.pinned && (
              <Icon name="push_pin" size={12} className="text-text-muted shrink-0 rotate-45" />
            )}
            {isSystem ? (
              <span className="text-[10px] text-white bg-primary px-1.5 rounded-full shrink-0">
                系统
              </span>
            ) : room.isBot ? (
              <span className="text-[10px] text-primary bg-primary/8 px-1.5 rounded-full shrink-0">
                Bot
              </span>
            ) : null}
            {room.lastMessageTs && (
              <span className="text-[10px] text-text-muted shrink-0 ml-1">
                {formatRelativeTime(room.lastMessageTs)}
              </span>
            )}
          </div>
          {room.lastMessage && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              {room.lastMessage}
            </p>
          )}
        </div>
        <Badge count={room.unreadCount} />
      </button>

      {/* Context menu — portal to body to escape backdrop-filter containing block */}
      {menuPos && actions.length > 0 && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[140px] py-1 bg-bg-white-var/95 backdrop-blur-xl border border-border rounded-xl shadow-card animate-in fade-in zoom-in-95 duration-100"
          style={{ left: menuPos.x, top: menuPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {actions.map((action) => {
            const meta = ACTION_META[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => handleAction(action)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Icon name={meta.icon} size={14} className="text-text-secondary" />
                {meta.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
