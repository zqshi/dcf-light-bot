import type { RoomType, UserId } from '../shared/types';
import { ChatRoom } from './ChatRoom';

type RoomFilter = RoomType | 'all';

export class ChatService {
  static filterRooms(
    rooms: ChatRoom[],
    filter: RoomFilter,
    searchQuery?: string,
  ): ChatRoom[] {
    let result = rooms;

    if (filter !== 'all') {
      result = result.filter((r) => r.type === filter);
    }

    if (searchQuery) {
      result = result.filter((r) => r.matchesSearch(searchQuery));
    }

    return result;
  }

  static sortByRecent(rooms: ChatRoom[]): ChatRoom[] {
    return [...rooms].sort((a, b) => {
      // Pinned rooms always come first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0);
    });
  }

  /**
   * Classify room type based on the DM partner's userId.
   */
  static classifyRoomType(dmUserId: UserId | undefined): RoomType {
    if (!dmUserId) return 'group';
    const id = dmUserId.toLowerCase();
    if (
      id.includes('dcf-bot') ||
      id.includes('factory') ||
      id.startsWith('@agent-')
    ) {
      return 'bot';
    }
    return 'dm';
  }
}
