import type { MatrixSession, RoomSummary, TimelineMessage } from '@dcf/domain';

type SyncResponse = {
  next_batch?: string;
  rooms?: {
    join?: Record<string, {
      state?: { events?: Array<any> };
      timeline?: { events?: Array<any> };
    }>;
  };
};

export type MatrixState = {
  rooms: RoomSummary[];
  messagesByRoom: Record<string, TimelineMessage[]>;
  syncToken: string;
};

export type MatrixSnapshot = MatrixState & {
  connected: boolean;
  session: MatrixSession | null;
};

function normalizeUserId(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('@')) return value;
  if (value.includes(':')) return `@${value}`;
  return `@${value}:localhost`;
}

function toLocalpart(raw: string) {
  return normalizeUserId(raw).replace(/^@/, '').split(':')[0] || '';
}

function isEncrypted(events: any[] | undefined) {
  const rows = Array.isArray(events) ? events : [];
  return rows.some((e) => String(e?.type || '') === 'm.room.encryption');
}

function getRoomName(roomId: string, events: any[] | undefined) {
  const rows = Array.isArray(events) ? events : [];
  const nameEvent = rows.find((e) => e?.type === 'm.room.name' && e?.state_key === '');
  const aliasEvent = rows.find((e) => e?.type === 'm.room.canonical_alias' && e?.state_key === '');
  const topicEvent = rows.find((e) => e?.type === 'm.room.topic' && e?.state_key === '');
  const name = String(nameEvent?.content?.name || aliasEvent?.content?.alias || roomId);
  const topic = String(topicEvent?.content?.topic || '');
  return { name, topic };
}

function mapMessage(roomId: string, event: any): TimelineMessage | null {
  if (!event || String(event.type || '') !== 'm.room.message') return null;
  const body = String(event.content?.body || '').trim();
  if (!body) return null;
  const sender = String(event.sender || '');
  const ts = Number(event.origin_server_ts || Date.now());
  return {
    id: String(event.event_id || `${roomId}-${ts}-${Math.random()}`),
    roomId,
    sender,
    body,
    ts,
    ai: /bot|ai/i.test(sender)
  };
}

export class MatrixRestClient {
  private session: MatrixSession | null = null;
  private state: MatrixState = { rooms: [], messagesByRoom: {}, syncToken: '' };
  private connected = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(snapshot: MatrixSnapshot) => void>();

  static async login(baseUrl: string, username: string, password: string): Promise<MatrixSession> {
    const hs = String(baseUrl || '').replace(/\/+$/, '');
    const localpart = toLocalpart(username);
    const res = await fetch(`${hs}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: localpart },
        password
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.user_id) {
      throw new Error(String(data?.error || 'Matrix login failed'));
    }
    return {
      baseUrl: hs,
      accessToken: String(data.access_token),
      userId: String(data.user_id),
      deviceId: String(data.device_id || '')
    };
  }

  start(session: MatrixSession) {
    this.stop();
    this.session = session;
    this.connected = true;
    this.emit();
    void this.tick();
  }

  stop() {
    this.connected = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  onSnapshot(listener: (snapshot: MatrixSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): MatrixSnapshot {
    return {
      ...this.state,
      connected: this.connected,
      session: this.session
    };
  }

  async joinAlias(alias: string, viaServers: string[] = ['localhost']) {
    if (!this.session) throw new Error('Not logged in');
    const payload = viaServers.length ? { server_name: viaServers } : {};
    const res = await fetch(
      `${this.session.baseUrl}/_matrix/client/v3/join/${encodeURIComponent(alias)}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.session.accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error || 'Join room failed'));
    return String(data.room_id || '');
  }

  async sendText(roomId: string, text: string) {
    if (!this.session) throw new Error('Not logged in');
    const txnId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(
      `${this.session.baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${this.session.accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ msgtype: 'm.text', body: text })
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error || 'Send message failed'));
  }

  private async tick() {
    if (!this.connected || !this.session) return;
    try {
      const token = this.state.syncToken;
      const qs = new URLSearchParams();
      qs.set('timeout', '25000');
      if (token) qs.set('since', token);
      const res = await fetch(`${this.session.baseUrl}/_matrix/client/v3/sync?${qs.toString()}`, {
        headers: { authorization: `Bearer ${this.session.accessToken}` }
      });
      const data: SyncResponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Sync failed');
      this.applySync(data);
      this.emit();
    } catch {
      this.connected = false;
      this.emit();
    } finally {
      if (!this.connected) {
        this.timer = setTimeout(() => {
          if (this.session) {
            this.connected = true;
            void this.tick();
          }
        }, 2500);
      } else {
        this.timer = setTimeout(() => void this.tick(), 300);
      }
    }
  }

  private applySync(data: SyncResponse) {
    this.state.syncToken = String(data?.next_batch || this.state.syncToken || '');
    const joined = data?.rooms?.join || {};
    const roomsMap = new Map(this.state.rooms.map((r) => [r.roomId, r]));

    Object.entries(joined).forEach(([roomId, payload]) => {
      const stateEvents = payload?.state?.events || [];
      const timelineEvents = payload?.timeline?.events || [];
      const current = roomsMap.get(roomId);
      const encrypted = current?.encrypted || isEncrypted(stateEvents);
      const roomInfo = getRoomName(roomId, stateEvents);

      const nextRoom: RoomSummary = {
        roomId,
        name: roomInfo.name || current?.name || roomId,
        topic: roomInfo.topic || current?.topic || '',
        encrypted,
        lastTs: current?.lastTs || 0
      };

      const prevMsgs = this.state.messagesByRoom[roomId] || [];
      const incoming = timelineEvents
        .map((e) => mapMessage(roomId, e))
        .filter((x): x is TimelineMessage => Boolean(x));

      if (incoming.length) {
        const merged = [...prevMsgs, ...incoming].slice(-200);
        this.state.messagesByRoom[roomId] = merged;
        nextRoom.lastTs = merged[merged.length - 1]?.ts || nextRoom.lastTs;
      }

      roomsMap.set(roomId, nextRoom);
    });

    this.state.rooms = [...roomsMap.values()]
      .filter((r) => !r.encrypted)
      .sort((a, b) => b.lastTs - a.lastTs);
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}
