import { useChatStore } from '../../../application/stores/chatStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';

export function ChatHeader() {
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const room = rooms.find((r) => r.id === currentRoomId);
  const openDrawer = useUIStore((s) => s.openDrawer);

  if (!room) return null;

  const statusText = room.isBot ? '数字员工 · 在线' : '在线';

  return (
    <div className="h-14 px-5 flex items-center justify-between border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text-primary">{room.name}</h1>
            {room.isBot && (
              <span className="text-[10px] font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full uppercase">
                Bot
              </span>
            )}
            {room.memberCount > 0 && (
              <span className="text-xs text-text-muted">{room.memberCount} 人</span>
            )}
          </div>
          <p className="text-[11px] text-text-muted leading-none mt-0.5">{statusText}</p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
          title="语音通话"
          onClick={() => useToastStore.getState().addToast('语音通话功能即将上线', 'info')}
        >
          <Icon name="call" size={18} />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
          title="视频通话"
          onClick={() => useToastStore.getState().addToast('视频通话功能即将上线', 'info')}
        >
          <Icon name="videocam" size={18} />
        </button>
        {room.type === 'subscription' && (
          <button
            className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
            title="订阅管理"
            onClick={() => openDrawer({ type: 'subscription', title: `${room.name} 订阅设置`, data: {} })}
          >
            <Icon name="tune" size={18} />
          </button>
        )}
        <button
          className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors"
          title="会话信息"
          onClick={() => useToastStore.getState().addToast('会话详情面板即将上线', 'info')}
        >
          <Icon name="info" size={18} />
        </button>
      </div>
    </div>
  );
}
