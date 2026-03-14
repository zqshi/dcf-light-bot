import { create } from 'zustand';
import type { ChatRoom } from '../../domain/chat/ChatRoom';
import type { ChatMessage } from '../../domain/chat/ChatMessage';
import type { RoomId, RoomType } from '../../domain/shared/types';

type RoomFilter = RoomType | 'all';

interface TypingInfo {
  userId: string;
  typing: boolean;
}

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

interface ChatState {
  rooms: ChatRoom[];
  currentRoomId: RoomId | null;
  messages: ChatMessage[];
  roomFilter: RoomFilter;
  searchQuery: string;
  typingUsers: Record<RoomId, TypingInfo[]>;

  setRooms(rooms: ChatRoom[]): void;
  setCurrentRoom(roomId: RoomId | null): void;
  setMessages(messages: ChatMessage[]): void;
  setRoomFilter(filter: RoomFilter): void;
  setSearchQuery(query: string): void;
  setTyping(roomId: RoomId, userId: string, typing: boolean): void;
  clearUnread(roomId: RoomId): void;
  reset(): void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  currentRoomId: null,
  messages: [],
  roomFilter: 'all',
  searchQuery: '',
  typingUsers: {},

  setRooms(rooms) {
    set({ rooms });
  },

  setCurrentRoom(roomId) {
    set({ currentRoomId: roomId });
  },

  setMessages(messages) {
    set({ messages });
  },

  setRoomFilter(filter) {
    set({ roomFilter: filter });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setTyping(roomId, userId, typing) {
    set((state) => {
      const roomTyping = (state.typingUsers[roomId] ?? []).filter((t) => t.userId !== userId);
      if (typing) roomTyping.push({ userId, typing: true });
      return { typingUsers: { ...state.typingUsers, [roomId]: roomTyping } };
    });

    // Auto-expire typing after 10 seconds
    const timerKey = `${roomId}:${userId}`;
    if (typingTimers[timerKey]) clearTimeout(typingTimers[timerKey]);
    if (typing) {
      typingTimers[timerKey] = setTimeout(() => {
        set((state) => {
          const updated = (state.typingUsers[roomId] ?? []).filter((t) => t.userId !== userId);
          return { typingUsers: { ...state.typingUsers, [roomId]: updated } };
        });
        delete typingTimers[timerKey];
      }, 10_000);
    } else {
      delete typingTimers[timerKey];
    }
  },

  clearUnread(roomId) {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? r.withUnread(0) : r,
      ),
    }));
  },

  reset() {
    // Clear all typing timers
    for (const key of Object.keys(typingTimers)) {
      clearTimeout(typingTimers[key]);
      delete typingTimers[key];
    }
    set({
      rooms: [],
      currentRoomId: null,
      messages: [],
      roomFilter: 'all',
      searchQuery: '',
      typingUsers: {},
    });
  },
}));
