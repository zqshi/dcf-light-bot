import { useRooms } from '../../../application/hooks/useRooms';
import { useMatrixClient } from '../../../application/hooks/useMatrixClient';
import { useChatStore } from '../../../application/stores/chatStore';
import { SearchInput } from '../../components/ui/SearchInput';
import { TabBar } from '../../components/ui/TabBar';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { RoomListItem } from './RoomListItem';

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'dm', label: '私聊' },
  { key: 'bot', label: '数字员工' },
  { key: 'group', label: '群组' },
  { key: 'subscription', label: '订阅号' },
];

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
}

/** Standalone sidebar wrapper — uses hooks directly */
export function MessagesSidebar() {
  const { selectRoom } = useMatrixClient();
  return <RoomList onSelectRoom={selectRoom} />;
}

export function RoomList({ onSelectRoom }: RoomListProps) {
  const { rooms, filter, searchQuery, setFilter, setSearch } = useRooms();
  const currentRoomId = useChatStore((s) => s.currentRoomId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-lg font-semibold text-text-primary mb-3">消息</h3>
        <SearchInput
          value={searchQuery}
          onChange={setSearch}
          placeholder="搜索会话..."
          className="mb-2"
        />
        <TabBar
          tabs={FILTER_TABS}
          activeKey={filter}
          onChange={(k) => setFilter(k as typeof filter)}
        />
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-auto px-2 py-2 dcf-scrollbar">
        <SectionLabel>会话列表</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              isActive={room.id === currentRoomId}
              onClick={() => onSelectRoom(room.id)}
            />
          ))}
          {rooms.length === 0 && (
            <p className="text-xs text-text-muted px-2 py-4">暂无会话</p>
          )}
        </div>
      </div>
    </div>
  );
}
