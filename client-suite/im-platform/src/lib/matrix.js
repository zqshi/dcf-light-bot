/**
 * Matrix Client — 封装 matrix-js-sdk，提供 IM 核心能力
 */
import * as sdk from 'matrix-js-sdk';
import { bus, Events } from './events.js';
import { getState, setState, persistAuth } from './store.js';

let client = null;

export function getClient() { return client; }

/**
 * 登录 Matrix homeserver
 */
export async function login(homeserverUrl, username, password) {
  const tempClient = sdk.createClient({ baseUrl: homeserverUrl });
  const resp = await tempClient.login('m.login.password', {
    user: username,
    password: password,
  });

  setState({
    user: {
      userId: resp.user_id,
      displayName: resp.user_id.split(':')[0].slice(1),
      avatarUrl: null,
      org: 'DCF 数字工厂',
      department: '',
      role: '',
    },
    accessToken: resp.access_token,
    homeserverUrl,
  });
  persistAuth();

  await initClient(homeserverUrl, resp.access_token, resp.user_id);
  return resp;
}

/**
 * SSO 登录（模拟：通过 CAS/OIDC redirect）
 */
export function getSsoLoginUrl(homeserverUrl, redirectUrl) {
  return `${homeserverUrl}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectUrl)}`;
}

/**
 * 初始化已登录的 Matrix client
 */
export async function initClient(homeserverUrl, accessToken, userId) {
  client = sdk.createClient({
    baseUrl: homeserverUrl,
    accessToken,
    userId,
    timelineSupport: true,
  });

  // Profile
  try {
    const profile = await client.getProfileInfo(userId);
    setState({
      user: {
        ...getState().user,
        displayName: profile.displayname || getState().user.displayName,
        avatarUrl: profile.avatar_url ? client.mxcUrlToHttp(profile.avatar_url, 96, 96, 'crop') : null,
      }
    });
  } catch (e) { /* ignore */ }

  // Event listeners
  client.on(sdk.ClientEvent.Sync, (syncState) => {
    if (syncState === 'PREPARED' || syncState === 'SYNCING') {
      if (!getState().matrixReady) {
        setState({ matrixReady: true });
        bus.emit(Events.MATRIX_READY);
      }
      refreshRoomList();
      bus.emit(Events.MATRIX_SYNC, syncState);
    }
  });

  client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (!room) return;
    refreshRoomList();
    bus.emit(Events.ROOM_TIMELINE, { event, room });
    if (room.roomId === getState().currentRoomId) {
      loadRoomMessages(room.roomId);
    }
  });

  client.on(sdk.RoomMemberEvent.Typing, (event, member) => {
    bus.emit(Events.TYPING, { roomId: member.roomId, userId: member.userId, typing: member.typing });
  });

  await client.startClient({ initialSyncLimit: 20 });
}

/**
 * 刷新房间列表
 */
export function refreshRoomList() {
  if (!client) return;
  const rooms = client.getRooms()
    .filter(r => {
      const me = r.getMember(client.getUserId());
      return me && me.membership === 'join';
    })
    .map(r => {
      const lastEvent = r.timeline?.[r.timeline.length - 1];
      const dmUserId = guessDmUserId(r);
      let type = 'group';
      if (dmUserId) {
        const botPatterns = [/^@dcf-bot/, /^@factory/, /^@agent-/];
        type = botPatterns.some(p => p.test(dmUserId)) ? 'bot' : 'dm';
      }
      return {
        roomId: r.roomId,
        name: r.name || '未命名',
        avatar: r.getAvatarUrl(client.baseUrl, 96, 96, 'crop'),
        lastMessage: lastEvent ? getEventText(lastEvent) : '',
        lastTs: lastEvent?.getTs() || 0,
        unread: r.getUnreadNotificationCount('total') || 0,
        type,
        dmUserId,
      };
    })
    .sort((a, b) => b.lastTs - a.lastTs);

  setState({ rooms });
  bus.emit(Events.ROOM_LIST_UPDATED, rooms);
}

function guessDmUserId(room) {
  const members = room.getJoinedMembers();
  if (members.length === 2) {
    return members.find(m => m.userId !== client.getUserId())?.userId || null;
  }
  return null;
}

function getEventText(event) {
  if (event.getType() === 'm.room.message') {
    const content = event.getContent();
    switch (content.msgtype) {
      case 'm.text': return content.body?.slice(0, 80) || '';
      case 'm.image': return '[图片]';
      case 'm.file': return `[文件] ${content.body || ''}`;
      case 'm.audio': return '[语音]';
      case 'm.video': return '[视频]';
      default: return content.body?.slice(0, 80) || '';
    }
  }
  if (event.getType() === 'm.room.member') return '成员变动';
  return '';
}

/**
 * 选择房间并加载消息
 */
export async function selectRoom(roomId) {
  setState({ currentRoomId: roomId });
  bus.emit(Events.ROOM_SELECTED, roomId);
  await loadRoomMessages(roomId);
  // 标记已读
  const room = client?.getRoom(roomId);
  if (room) {
    const lastEvent = room.timeline?.[room.timeline.length - 1];
    if (lastEvent) {
      try { await client.sendReadReceipt(lastEvent); } catch {}
    }
  }
}

/**
 * 加载房间消息
 */
export async function loadRoomMessages(roomId) {
  if (!client) return;
  const room = client.getRoom(roomId);
  if (!room) return;

  const messages = room.timeline
    .filter(ev => ev.getType() === 'm.room.message')
    .map(ev => {
      const content = ev.getContent();
      const senderId = ev.getSender();
      const member = room.getMember(senderId);
      return {
        id: ev.getId(),
        sender: senderId,
        senderName: member?.name || senderId.split(':')[0].slice(1),
        avatarUrl: member?.getAvatarUrl(client.baseUrl, 64, 64, 'crop'),
        type: content.msgtype || 'm.text',
        body: content.body || '',
        formattedBody: content.formatted_body,
        url: content.url ? client.mxcUrlToHttp(content.url) : null,
        info: content.info,
        ts: ev.getTs(),
        isOwn: senderId === client.getUserId(),
        // Custom: agent card data
        agentCard: content['dcf.agent_card'] || null,
        // Custom: drawer content
        drawerContent: content['dcf.drawer_content'] || null,
      };
    });

  setState({ messages });
}

/**
 * 发送文本消息
 */
export async function sendMessage(roomId, body) {
  if (!client || !roomId) return;
  await client.sendMessage(roomId, {
    msgtype: 'm.text',
    body,
  });
}

/**
 * 发送文件
 */
export async function sendFile(roomId, file) {
  if (!client || !roomId) return;
  const upload = await client.uploadContent(file, { name: file.name, type: file.type });
  const msgtype = file.type.startsWith('image/') ? 'm.image' : 'm.file';
  await client.sendMessage(roomId, {
    msgtype,
    body: file.name,
    url: upload.content_uri,
    info: { mimetype: file.type, size: file.size },
  });
}

/**
 * 发送 typing 状态
 */
export function sendTyping(roomId, typing) {
  if (!client || !roomId) return;
  client.sendTyping(roomId, typing, 5000).catch(() => {});
}

/**
 * 创建 DM 房间
 */
export async function createDmRoom(userId) {
  if (!client) return null;
  const result = await client.createRoom({
    preset: 'trusted_private_chat',
    invite: [userId],
    is_direct: true,
  });
  return result.room_id;
}

/**
 * 搜索用户
 */
export async function searchUsers(term) {
  if (!client || !term) return [];
  try {
    const resp = await client.searchUserDirectory({ term, limit: 20 });
    return resp.results.map(u => ({
      userId: u.user_id,
      displayName: u.display_name || u.user_id,
      avatarUrl: u.avatar_url ? client.mxcUrlToHttp(u.avatar_url, 64, 64, 'crop') : null,
    }));
  } catch { return []; }
}

/**
 * 登出
 */
export async function logout() {
  if (client) {
    try { await client.logout(); } catch {}
    client.stopClient();
    client = null;
  }
}
