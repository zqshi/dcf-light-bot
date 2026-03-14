import { useMemo } from 'react';
import { useChatStore } from '../stores/chatStore';
import { ChatService } from '../../domain/chat/ChatService';

export function useRooms() {
  const rooms = useChatStore((s) => s.rooms);
  const filter = useChatStore((s) => s.roomFilter);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setFilter = useChatStore((s) => s.setRoomFilter);
  const setSearch = useChatStore((s) => s.setSearchQuery);

  const filteredRooms = useMemo(
    () => ChatService.sortByRecent(ChatService.filterRooms(rooms, filter, searchQuery)),
    [rooms, filter, searchQuery],
  );

  return { rooms: filteredRooms, filter, searchQuery, setFilter, setSearch };
}
