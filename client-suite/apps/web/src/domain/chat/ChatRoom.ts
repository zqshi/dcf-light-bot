import type { RoomId, RoomType } from '../shared/types';

export interface ChatRoomProps {
  id: RoomId;
  name: string;
  type: RoomType;
  avatarLetter?: string;
  memberCount?: number;
  lastMessage?: string;
  lastMessageTs?: number;
  unreadCount?: number;
}

export class ChatRoom {
  readonly id: RoomId;
  readonly name: string;
  readonly type: RoomType;
  readonly avatarLetter: string;
  readonly memberCount: number;
  readonly lastMessage?: string;
  readonly lastMessageTs?: number;
  readonly unreadCount: number;

  private constructor(props: ChatRoomProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.avatarLetter = props.avatarLetter ?? props.name.charAt(0).toUpperCase();
    this.memberCount = props.memberCount ?? 0;
    this.lastMessage = props.lastMessage;
    this.lastMessageTs = props.lastMessageTs;
    this.unreadCount = props.unreadCount ?? 0;
  }

  static create(props: ChatRoomProps): ChatRoom {
    return new ChatRoom(props);
  }

  get isDm(): boolean {
    return this.type === 'dm';
  }

  get isBot(): boolean {
    return this.type === 'bot';
  }

  withLastMessage(message: string, ts: number): ChatRoom {
    return new ChatRoom({
      id: this.id,
      name: this.name,
      type: this.type,
      avatarLetter: this.avatarLetter,
      memberCount: this.memberCount,
      lastMessage: message,
      lastMessageTs: ts,
      unreadCount: this.unreadCount,
    });
  }

  withUnread(count: number): ChatRoom {
    return new ChatRoom({
      id: this.id,
      name: this.name,
      type: this.type,
      avatarLetter: this.avatarLetter,
      memberCount: this.memberCount,
      lastMessage: this.lastMessage,
      lastMessageTs: this.lastMessageTs,
      unreadCount: count,
    });
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    return this.name.toLowerCase().includes(query.toLowerCase());
  }
}
