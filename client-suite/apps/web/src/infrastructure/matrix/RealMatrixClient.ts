/**
 * RealMatrixClient — 真实 matrix-js-sdk 适配器
 * 实现 IMatrixClient 接口，封装官方 SDK 调用
 */
import * as sdk from 'matrix-js-sdk';
import { MsgType } from 'matrix-js-sdk/lib/@types/event';
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room';
import type {
  IMatrixClient,
  UserProfile,
  LoginResult,
  SearchUserResult,
  SyncCallback,
  TimelineCallback,
  TypingCallback,
} from './MatrixClientAdapter';
import { ChatMessage } from '../../domain/chat/ChatMessage';
import { ChatRoom } from '../../domain/chat/ChatRoom';
import type { RoomId, UserId } from '../../domain/shared/types';

const BOT_PATTERNS = [/^@dcf-bot/, /^@factory/, /^@agent-/];

function guessDmUserId(room: sdk.Room, myUserId: string): string | null {
  const members = room.getJoinedMembers();
  if (members.length === 2) {
    return members.find((m) => m.userId !== myUserId)?.userId ?? null;
  }
  return null;
}

function guessRoomType(dmUserId: string | null): 'dm' | 'bot' | 'group' {
  if (!dmUserId) return 'group';
  return BOT_PATTERNS.some((p) => p.test(dmUserId)) ? 'bot' : 'dm';
}

function getEventText(event: sdk.MatrixEvent): string {
  if (event.getType() === 'm.room.message') {
    const content = event.getContent();
    switch (content.msgtype) {
      case 'm.text':
        return content.body?.slice(0, 80) ?? '';
      case 'm.image':
        return '[图片]';
      case 'm.file':
        return `[文件] ${content.body ?? ''}`;
      case 'm.audio':
        return '[语音]';
      case 'm.video':
        return '[视频]';
      default:
        return content.body?.slice(0, 80) ?? '';
    }
  }
  if (event.getType() === 'm.room.member') return '成员变动';
  return '';
}

export class RealMatrixClient implements IMatrixClient {
  private client: sdk.MatrixClient | null = null;
  private user: UserProfile | null = null;
  private ready = false;

  private syncCbs: SyncCallback[] = [];
  private timelineCbs: TimelineCallback[] = [];
  private typingCbs: TypingCallback[] = [];

  async loginWithToken(homeserverUrl: string, loginToken: string): Promise<LoginResult> {
    const tempClient = sdk.createClient({ baseUrl: homeserverUrl });
    const resp = await tempClient.login('m.login.token', {
      token: loginToken,
    });
    const userId = resp.user_id;
    const accessToken = resp.access_token;
    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: 'DCF 数字工厂',
    };
    await this.initClient(homeserverUrl, accessToken, userId);
    return { userId, accessToken };
  }

  async login(homeserverUrl: string, username: string, password: string): Promise<LoginResult> {
    console.log('[RealMatrixClient] login attempt', { homeserverUrl, username });
    const tempClient = sdk.createClient({ baseUrl: homeserverUrl });
    const resp = await tempClient.login('m.login.password', {
      user: username,
      password,
    });
    console.log('[RealMatrixClient] login success', { userId: resp.user_id });

    const userId = resp.user_id;
    const accessToken = resp.access_token;

    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: 'DCF 数字工厂',
    };

    await this.initClient(homeserverUrl, accessToken, userId);

    return { userId, accessToken };
  }

  async initFromSession(homeserverUrl: string, accessToken: string, userId: UserId): Promise<void> {
    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: 'DCF 数字工厂',
    };
    await this.initClient(homeserverUrl, accessToken, userId);
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout(true);
      } catch {
        /* ignore */
      }
      this.client.stopClient();
      this.client = null;
    }
    this.user = null;
    this.ready = false;
  }

  getUserProfile(): UserProfile | null {
    return this.user;
  }

  getRooms(): ChatRoom[] {
    if (!this.client) return [];
    const myUserId = this.client.getUserId() ?? '';

    return this.client
      .getRooms()
      .filter((r) => {
        const me = r.getMember(myUserId);
        return me && me.membership === 'join';
      })
      .map((r) => {
        const lastEvent = r.timeline?.[r.timeline.length - 1];
        const dmUserId = guessDmUserId(r, myUserId);
        return ChatRoom.create({
          id: r.roomId,
          name: r.name || '未命名',
          type: guessRoomType(dmUserId),
          lastMessage: lastEvent ? getEventText(lastEvent) : '',
          lastMessageTs: lastEvent?.getTs() ?? 0,
          unreadCount: r.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
        });
      })
      .sort((a, b) => (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0));
  }

  getMessages(roomId: RoomId): ChatMessage[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const myUserId = this.client.getUserId() ?? '';

    return room.timeline
      .filter((ev) => ev.getType() === 'm.room.message')
      .map((ev) => {
        const content = ev.getContent();
        const senderId = ev.getSender() ?? '';
        const member = room.getMember(senderId);
        const agentCard = content['dcf.agent_card'] ?? null;
        const drawerContent = content['dcf.drawer_content'] ?? null;

        let contentType: ChatMessage['contentType'] = 'text';
        if (agentCard) contentType = 'agent-card';
        else if (drawerContent) contentType = 'drawer-content';
        else if (content.msgtype === 'm.image') contentType = 'image';
        else if (content.msgtype === 'm.file') contentType = 'file';
        else if (content.msgtype === 'm.audio') contentType = 'audio';
        else if (content.msgtype === 'm.video') contentType = 'video';

        const url = content.url
          ? this.client!.mxcUrlToHttp(content.url) ?? undefined
          : undefined;

        return ChatMessage.create({
          id: ev.getId() ?? `evt-${ev.getTs()}`,
          roomId,
          senderId,
          senderName: member?.name ?? senderId.split(':')[0].slice(1),
          body: content.body ?? '',
          timestamp: ev.getTs(),
          contentType,
          agentCard,
          drawerContent,
          mediaUrl: url,
        });
      });
  }

  async selectRoom(roomId: RoomId): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    const lastEvent = room.timeline?.[room.timeline.length - 1];
    if (lastEvent) {
      try {
        await this.client.sendReadReceipt(lastEvent);
      } catch {
        /* ignore */
      }
    }
  }

  async sendMessage(roomId: RoomId, body: string): Promise<void> {
    if (!this.client) return;
    await this.client.sendMessage(roomId, {
      msgtype: MsgType.Text,
      body,
    });
  }

  async sendFile(roomId: RoomId, file: File): Promise<void> {
    if (!this.client) return;
    const upload = await this.client.uploadContent(file, {
      name: file.name,
      type: file.type,
    });
    const msgtype = file.type.startsWith('image/') ? MsgType.Image : MsgType.File;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client as any).sendMessage(roomId, {
      msgtype,
      body: file.name,
      url: upload.content_uri,
      info: { mimetype: file.type, size: file.size },
    });
  }

  sendTyping(roomId: RoomId, typing: boolean): void {
    if (!this.client) return;
    this.client.sendTyping(roomId, typing, 5000).catch(() => {});
  }

  async createDmRoom(userId: UserId): Promise<RoomId | null> {
    if (!this.client) return null;
    const result = await this.client.createRoom({
      preset: sdk.Preset.TrustedPrivateChat,
      invite: [userId],
      is_direct: true,
    });
    return result.room_id;
  }

  async searchUsers(term: string): Promise<SearchUserResult[]> {
    if (!this.client || !term) return [];
    try {
      const resp = await this.client.searchUserDirectory({ term, limit: 20 });
      return resp.results.map((u) => ({
        userId: u.user_id,
        displayName: u.display_name ?? u.user_id,
        avatarUrl: u.avatar_url
          ? this.client!.mxcUrlToHttp(u.avatar_url, 64, 64, 'crop') ?? null
          : null,
      }));
    } catch {
      return [];
    }
  }

  onSync(cb: SyncCallback): void {
    this.syncCbs.push(cb);
  }
  onTimeline(cb: TimelineCallback): void {
    this.timelineCbs.push(cb);
  }
  onTyping(cb: TypingCallback): void {
    this.typingCbs.push(cb);
  }

  offSync(cb: SyncCallback): void {
    this.syncCbs = this.syncCbs.filter((c) => c !== cb);
  }
  offTimeline(cb: TimelineCallback): void {
    this.timelineCbs = this.timelineCbs.filter((c) => c !== cb);
  }
  offTyping(cb: TypingCallback): void {
    this.typingCbs = this.typingCbs.filter((c) => c !== cb);
  }

  isReady(): boolean {
    return this.ready;
  }

  // --- private ---

  private async initClient(homeserverUrl: string, accessToken: string, userId: string): Promise<void> {
    this.client = sdk.createClient({
      baseUrl: homeserverUrl,
      accessToken,
      userId,
      timelineSupport: true,
    });

    // Fetch profile
    try {
      const profile = await this.client.getProfileInfo(userId);
      if (this.user) {
        this.user = {
          ...this.user,
          displayName: profile.displayname ?? this.user.displayName,
          avatarUrl: profile.avatar_url
            ? this.client.mxcUrlToHttp(profile.avatar_url, 96, 96, 'crop') ?? null
            : null,
        };
      }
    } catch {
      /* profile fetch optional */
    }

    // Wire up SDK events → our callbacks
    this.client.on(sdk.ClientEvent.Sync, (syncState: string) => {
      if (syncState === 'PREPARED' || syncState === 'SYNCING') {
        if (!this.ready) {
          this.ready = true;
        }
        this.syncCbs.forEach((cb) => cb());
      }
    });

    this.client.on(sdk.RoomEvent.Timeline, (_event: sdk.MatrixEvent, room: sdk.Room | undefined) => {
      if (!room) return;
      this.syncCbs.forEach((cb) => cb());
      this.timelineCbs.forEach((cb) => cb(room.roomId));
    });

    this.client.on(sdk.RoomMemberEvent.Typing, (_event: sdk.MatrixEvent, member: sdk.RoomMember) => {
      this.typingCbs.forEach((cb) => cb(member.roomId, member.userId, member.typing));
    });

    await this.client.startClient({ initialSyncLimit: 20 });
  }
}
