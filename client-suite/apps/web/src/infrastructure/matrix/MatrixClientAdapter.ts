/**
 * MatrixClientAdapter — 定义 Matrix 客户端的端口接口
 * 真实模式和 Demo 模式各自实现此接口
 */
import type { ChatMessage } from '../../domain/chat/ChatMessage';
import type { ChatRoom } from '../../domain/chat/ChatRoom';
import type { UserId, RoomId } from '../../domain/shared/types';

export interface UserProfile {
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
  org?: string;
  department?: string;
  role?: string;
}

export interface SearchUserResult {
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
}

export interface LoginResult {
  userId: UserId;
  accessToken: string;
}

export type SyncCallback = () => void;
export type TimelineCallback = (roomId: RoomId) => void;
export type TypingCallback = (roomId: RoomId, userId: UserId, typing: boolean) => void;

/** Port interface — all Matrix operations go through this */
export interface IMatrixClient {
  /** Login with credentials */
  login(homeserverUrl: string, username: string, password: string): Promise<LoginResult>;

  /** Login with SSO token (m.login.token) */
  loginWithToken(homeserverUrl: string, loginToken: string): Promise<LoginResult>;

  /** Initialize client from persisted session */
  initFromSession(homeserverUrl: string, accessToken: string, userId: UserId): Promise<void>;

  /** Logout and cleanup */
  logout(): Promise<void>;

  /** Get current user profile */
  getUserProfile(): UserProfile | null;

  /** Get all joined rooms */
  getRooms(): ChatRoom[];

  /** Load messages for a room */
  getMessages(roomId: RoomId): ChatMessage[];

  /** Select room (mark as read) */
  selectRoom(roomId: RoomId): Promise<void>;

  /** Send text message */
  sendMessage(roomId: RoomId, body: string): Promise<void>;

  /** Send file */
  sendFile(roomId: RoomId, file: File): Promise<void>;

  /** Send typing indicator */
  sendTyping(roomId: RoomId, typing: boolean): void;

  /** Create DM room with user */
  createDmRoom(userId: UserId): Promise<RoomId | null>;

  /** Search users */
  searchUsers(term: string): Promise<SearchUserResult[]>;

  /** Register event callbacks */
  onSync(cb: SyncCallback): void;
  onTimeline(cb: TimelineCallback): void;
  onTyping(cb: TypingCallback): void;

  /** Remove event callbacks */
  offSync(cb: SyncCallback): void;
  offTimeline(cb: TimelineCallback): void;
  offTyping(cb: TypingCallback): void;

  /** Whether client is ready */
  isReady(): boolean;
}
