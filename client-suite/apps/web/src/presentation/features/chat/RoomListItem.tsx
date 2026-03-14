import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import type { ChatRoom } from '../../../domain/chat/ChatRoom';
import { formatRelativeTime } from '../../../domain/shared/formatTime';

interface RoomListItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
}

const typeIcons: Record<string, string> = {
  bot: '🤖',
  dm: '👤',
  group: '👥',
};

export function RoomListItem({ room, isActive, onClick }: RoomListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
        isActive
          ? 'bg-primary/8 border border-primary/15'
          : 'hover:bg-bg-hover border border-transparent'
      }`}
    >
      <Avatar letter={room.avatarLetter} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-text-primary truncate flex-1">
            {room.name}
          </span>
          {room.isBot && (
            <span className="text-[10px] text-primary bg-primary/8 px-1.5 rounded-full shrink-0">
              Bot
            </span>
          )}
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
  );
}
