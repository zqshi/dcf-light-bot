/**
 * MockMatrixClient — Demo 模式实现，适配 IMatrixClient 接口
 */
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
import { ChatService } from '../../domain/chat/ChatService';
import type { RoomId, UserId } from '../../domain/shared/types';

const DEMO_USER: UserProfile = {
  userId: '@zhangsan:dcf.local',
  displayName: '张三',
  avatarUrl: null,
  org: 'DCF 数字工厂',
  department: '产品技术部',
  role: '高级工程师',
};

interface RawRoom {
  roomId: string;
  name: string;
  type: 'dm' | 'bot' | 'group' | 'subscription' | 'system';
  dmUserId: string | null;
  unread: number;
  lastMessage: string;
  lastTs: number;
  pinned?: boolean;
  category?: 'system' | 'integration' | 'normal';
}

interface RawMessage {
  id: string;
  sender: string;
  senderName: string;
  type: string;
  body: string;
  ts: number;
  isOwn: boolean;
  agentCard?: Record<string, unknown>;
  drawerContent?: Record<string, unknown>;
  systemNotification?: { notificationType: 'approved' | 'rejected'; documentName: string; documentId?: string; approver: string; reason?: string };
  approvalRequest?: { applicant: string; documentName: string; documentContent?: string; reason: string };
  briefing?: { title: string; date: string; summary: string; news: { title: string; category: string; categoryColor: string; source: string; time: string }[] };
  url?: string | null;
  info?: Record<string, unknown>;
}

function createDemoData() {
  const now = Date.now();
  const min = 60_000;
  const hour = 3_600_000;

  const rooms: RawRoom[] = [
    // System rooms (pinned)
    { roomId: '!approval-center:dcf.local', name: '审批中心', type: 'system', dmUserId: '@approval-bot:dcf.local', unread: 2, lastMessage: '', lastTs: 0, category: 'system' },
    { roomId: '!sys-notify:dcf.local', name: '系统通知', type: 'system', dmUserId: '@sys-notify-bot:dcf.local', unread: 3, lastMessage: '', lastTs: 0, category: 'system' },
    // Bot rooms
    { roomId: '!factory:dcf.local', name: '数字工厂', type: 'bot', dmUserId: '@dcf-factory-bot:dcf.local', unread: 1, lastMessage: '', lastTs: 0 },
    { roomId: '!agent-coder:dcf.local', name: '小码 · 代码助手', type: 'bot', dmUserId: '@agent-coder:dcf.local', unread: 0, lastMessage: '', lastTs: 0 },
    { roomId: '!agent-writer:dcf.local', name: '小文 · 文档写手', type: 'bot', dmUserId: '@agent-writer:dcf.local', unread: 3, lastMessage: '', lastTs: 0 },
    // DM rooms
    { roomId: '!lisi:dcf.local', name: '李四', type: 'dm', dmUserId: '@lisi:dcf.local', unread: 0, lastMessage: '', lastTs: 0 },
    { roomId: '!wangwu:dcf.local', name: '王五', type: 'dm', dmUserId: '@wangwu:dcf.local', unread: 2, lastMessage: '', lastTs: 0 },
    // Group rooms
    { roomId: '!team-frontend:dcf.local', name: '前端技术组', type: 'group', dmUserId: null, unread: 5, lastMessage: '', lastTs: 0 },
    { roomId: '!team-product:dcf.local', name: '产品讨论组', type: 'group', dmUserId: null, unread: 0, lastMessage: '', lastTs: 0 },
    // Integration / subscription rooms (from dissolved "动态")
    { roomId: '!jira-bot:dcf.local', name: 'Jira 项目动态', type: 'subscription', dmUserId: '@jira-bot:dcf.local', unread: 1, lastMessage: '', lastTs: 0, category: 'integration' },
    { roomId: '!ai-intel:dcf.local', name: 'AI 行业助手', type: 'subscription', dmUserId: null, unread: 1, lastMessage: '', lastTs: 0 },
    { roomId: '!security-news:dcf.local', name: '安全与公告', type: 'subscription', dmUserId: '@security-bot:dcf.local', unread: 2, lastMessage: '', lastTs: 0, category: 'integration' },
  ];

  const messages: Record<string, RawMessage[]> = {
    // ── System: 审批中心 ──
    '!approval-center:dcf.local': [
      { id: 'ac1', sender: '@approval-bot:dcf.local', senderName: '审批中心', type: 'm.text', body: '审批中心为您聚合所有审批事项，可在此直接处理。', ts: now - 6 * hour, isOwn: false },
      { id: 'ac2', sender: '@approval-bot:dcf.local', senderName: '审批中心', type: 'm.text', body: '权限申请', ts: now - 2 * hour, isOwn: false, approvalRequest: { applicant: '李四', documentName: '2024Q1_财务报表汇总', documentContent: '<h1>2024Q1 财务报表汇总</h1><p>主营业务收入 3,280.5 万元</p>', reason: '需要更新Q1报表数据，截止日期临近。' } },
      { id: 'ac3', sender: '@approval-bot:dcf.local', senderName: '审批中心', type: 'm.text', body: '差旅报销申请', ts: now - hour, isOwn: false, approvalRequest: { applicant: '王五', documentName: '差旅报销单 ¥3,200', reason: '上海出差 3 天差旅费报销，含机票+酒店+交通。' } },
      { id: 'ac4', sender: '@approval-bot:dcf.local', senderName: '审批中心', type: 'm.text', body: '采购申请已通过', ts: now - 30 * min, isOwn: false, systemNotification: { notificationType: 'approved', documentName: '采购申请 — MacBook Pro', approver: '赵六' } },
    ],
    // ── System: 系统通知 ──
    '!sys-notify:dcf.local': [
      { id: 'sn1', sender: '@sys-notify-bot:dcf.local', senderName: '系统通知', type: 'm.text', body: '🔧 平台将于今晚22:00进行例行维护，预计持续30分钟，届时服务可能短暂中断。', ts: now - 5 * hour, isOwn: false },
      { id: 'sn2', sender: '@sys-notify-bot:dcf.local', senderName: '系统通知', type: 'm.text', body: '⚠️ 检测到新设备登录（IP: 203.*.*.* 上海），请确认是否为本人操作。如非本人，请立即修改密码。', ts: now - 3 * hour, isOwn: false },
      { id: 'sn3', sender: '@sys-notify-bot:dcf.local', senderName: '系统通知', type: 'm.text', body: '权限变更通知', ts: now - 2 * hour, isOwn: false, systemNotification: { notificationType: 'approved', documentName: '前端重构设计规范 v2.0', documentId: 'doc-design-spec-v2', approver: '王五', reason: '需要更新组件库迁移章节' } },
      { id: 'sn4', sender: '@sys-notify-bot:dcf.local', senderName: '系统通知', type: 'm.text', body: '✅ 您的报销申请（¥2,800）已由赵六审批通过，预计 3 个工作日内到账。', ts: now - hour, isOwn: false },
    ],
    // ── Bot: 数字工厂 ──
    '!factory:dcf.local': [
      { id: 'f1', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '欢迎来到数字工厂！我可以帮你创建和管理数字员工。\n\n你可以说：\n- "创建一个前端开发助手"\n- "查看我的数字员工列表"', ts: now - 2 * hour, isOwn: false },
      { id: 'f2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我创建一个前端开发助手', ts: now - 2 * hour + 5 * min, isOwn: true },
      { id: 'f3', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '✅ 数字员工已创建！\n\n- ID: DE-A3F8K2\n- 工号: DCF-20260306-001\n- 岗位: 前端开发工程师', ts: now - 2 * hour + 6 * min, isOwn: false },
      { id: 'f4', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '[数字员工卡片]', ts: now - 2 * hour + 7 * min, isOwn: false, agentCard: { name: '小码', role: '前端开发工程师', id: 'agent-coder', userId: '@agent-coder:dcf.local', tags: ['React', 'TypeScript'] } },
    ],
    '!agent-coder:dcf.local': [
      { id: 'c1', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '你好！我是小码，你的前端开发助手。有什么我可以帮你的吗？', ts: now - 2 * hour + 10 * min, isOwn: false },
      { id: 'c2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我写一个 useDebounce hook', ts: now - hour + 30 * min, isOwn: true },
      { id: 'c3', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '好的，代码已生成：', ts: now - hour + 31 * min, isOwn: false, drawerContent: { type: 'code', title: 'useDebounce.ts', data: { code: 'export function useDebounce<T>(value: T, delay: number): T { ... }', language: 'TypeScript' } } },
    ],
    '!agent-writer:dcf.local': [
      { id: 'w1', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手', type: 'm.text', body: '你好！我是小文，专注于技术文档撰写。', ts: now - hour + 15 * min, isOwn: false },
      { id: 'w2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我写一份产品概述文档', ts: now - 40 * min, isOwn: true },
      { id: 'w3', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手', type: 'm.text', body: '文档已生成，点击查看：', ts: now - 38 * min, isOwn: false, drawerContent: { type: 'doc', title: '产品概述文档', data: { html: '<h1>DCF 数字员工协作平台</h1><p>产品概述内容...</p>' } } },
    ],
    '!lisi:dcf.local': [
      { id: 'l1', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '下午的评审会议准备好了吗？', ts: now - 3 * hour, isOwn: false },
      { id: 'l2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '准备好了', ts: now - 3 * hour + 5 * min, isOwn: true },
    ],
    '!wangwu:dcf.local': [
      { id: 'v1', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '数字员工平台做得怎么样了？', ts: now - 20 * min, isOwn: false },
      { id: 'v2', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '老板说下周要看 demo', ts: now - 18 * min, isOwn: false },
    ],
    '!team-frontend:dcf.local': [
      { id: 't1', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '下周一前端框架升级到 Vite 6', ts: now - 5 * hour, isOwn: false },
      { id: 't2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '本地测试过了，没问题', ts: now - 5 * hour + 5 * min, isOwn: true },
      { id: 't3', sender: '@system:dcf.local', senderName: '系统通知', type: 'm.text', body: '权限申请已通过', ts: now - 4 * hour, isOwn: false, systemNotification: { notificationType: 'approved', documentName: '前端重构设计规范 v2.0', documentId: 'doc-design-spec-v2', approver: '王五', reason: '需要更新组件库迁移章节' } },
      { id: 't4', sender: '@system:dcf.local', senderName: '系统通知', type: 'm.text', body: '权限申请已被驳回', ts: now - 3 * hour, isOwn: false, systemNotification: { notificationType: 'rejected', documentName: '生产环境部署配置', documentId: 'doc-deploy-config', approver: '赵六', reason: '该文档涉及生产环境敏感配置，需部门负责人额外审批后方可授权编辑权限。' } },
    ],
    '!team-product:dcf.local': [
      { id: 'p1', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: 'PRD 初稿我放到文档中心了', ts: now - 8 * hour, isOwn: false },
    ],
    // ── Integration: Jira 项目动态 ──
    '!jira-bot:dcf.local': [
      { id: 'jb1', sender: '@jira-bot:dcf.local', senderName: 'Jira 项目动态', type: 'm.text', body: '✅ PROD-2048: 移动端订阅功能优化 — Sarah Chen 变更为「已完成」', ts: now - 3 * hour, isOwn: false },
      { id: 'jb2', sender: '@jira-bot:dcf.local', senderName: 'Jira 项目动态', type: 'm.text', body: '🔀 feat/dark-mode 分支已合并到 main — GitHub Actions CI 全部通过，覆盖率 94%', ts: now - hour, isOwn: false },
    ],
    // ── Subscription: AI 行业助手 ──
    '!ai-intel:dcf.local': [
      { id: 'ai1', sender: '@ai-intel:dcf.local', senderName: 'AI 行业助手', type: 'm.text', body: '您好！这是为您定制的今日行业深度动态简报。', ts: now - 30 * min, isOwn: false },
      { id: 'ai2', sender: '@ai-intel:dcf.local', senderName: 'AI 行业助手', type: 'm.text', body: '低空经济与 AI 手机市场每日简报', ts: now - 28 * min, isOwn: false, briefing: { title: '低空经济与 AI 手机市场每日简报', date: '2024年5月24日', summary: '今日行业动态聚焦于政策红利释放与硬件生态革新。低空经济领域迎来实质性进展，AI原生OS完成重要升级。', news: [{ title: '亿航智能 EH216-S 完成跨海首航，低空物流进入新阶段', category: '政策与基建', categoryColor: '#34C759', source: '新华社', time: '2小时前' }, { title: '手机大厂发布端侧 7B 模型优化方案，推理速度提升 40%', category: '核心技术', categoryColor: '#007AFF', source: '智东西', time: '5小时前' }, { title: '深圳出台低空经济三年行动方案，计划投资超 200 亿', category: '地方政策', categoryColor: '#AF52DE', source: '财联社', time: '8小时前' }] } },
    ],
    // ── Integration: 安全与公告 ──
    '!security-news:dcf.local': [
      { id: 'sec1', sender: '@security-bot:dcf.local', senderName: '安全与公告', type: 'm.text', body: '🚨 Log4j 3.x 新高危漏洞公告 (CVE-2026-XXXX)，影响所有 3.0-3.2 版本，建议立即升级。', ts: now - 4 * hour, isOwn: false },
      { id: 'sec2', sender: '@security-bot:dcf.local', senderName: '安全与公告', type: 'm.text', body: '📢 关于2024年Q2全员大会的通知：时间 3月15日 14:00，地点：三楼报告厅。请各部门提前安排。', ts: now - 2 * hour, isOwn: false },
    ],
  };

  rooms.forEach((r) => {
    const msgs = messages[r.roomId];
    if (msgs?.length) {
      const last = msgs[msgs.length - 1];
      r.lastMessage = last.body.slice(0, 60);
      r.lastTs = last.ts;
    }
  });

  return { rooms, messages };
}

function rawToMessage(raw: RawMessage, roomId: RoomId): ChatMessage {
  const contentType = raw.approvalRequest
    ? 'approval-request' as const
    : raw.briefing ? 'briefing' as const
    : raw.systemNotification ? 'system-notification' as const
    : raw.agentCard ? 'agent-card' as const
    : raw.drawerContent ? 'drawer-content' as const
    : 'text' as const;

  return ChatMessage.create({
    id: raw.id,
    roomId,
    senderId: raw.sender,
    senderName: raw.senderName,
    body: raw.body,
    timestamp: raw.ts,
    contentType,
    agentCard: raw.agentCard as ChatMessage['agentCard'],
    drawerContent: raw.drawerContent as ChatMessage['drawerContent'],
    systemNotification: raw.systemNotification,
    approvalRequest: raw.approvalRequest,
    briefing: raw.briefing,
    mediaUrl: raw.url ?? undefined,
  });
}

function rawToRoom(raw: RawRoom): ChatRoom {
  return ChatRoom.create({
    id: raw.roomId,
    name: raw.name,
    type: raw.type,
    lastMessage: raw.lastMessage,
    lastMessageTs: raw.lastTs,
    unreadCount: raw.unread,
    pinned: raw.pinned,
    category: raw.category,
  });
}

export class MockMatrixClient implements IMatrixClient {
  private user: UserProfile | null = null;
  private ready = false;
  private data: ReturnType<typeof createDemoData> | null = null;

  private syncCbs: SyncCallback[] = [];
  private timelineCbs: TimelineCallback[] = [];
  private typingCbs: TypingCallback[] = [];

  async loginWithToken(_homeserverUrl: string, _loginToken: string): Promise<LoginResult> {
    return this.login(_homeserverUrl, '', '');
  }

  async login(_homeserverUrl: string, _username: string, _password: string): Promise<LoginResult> {
    this.data = createDemoData();
    this.user = { ...DEMO_USER };
    this.ready = true;

    setTimeout(() => this.syncCbs.forEach((cb) => cb()), 300);

    return { userId: DEMO_USER.userId, accessToken: 'demo-token' };
  }

  async initFromSession(_homeserverUrl: string, _accessToken: string, _userId: UserId): Promise<void> {
    this.data = createDemoData();
    this.user = { ...DEMO_USER };
    this.ready = true;
    setTimeout(() => this.syncCbs.forEach((cb) => cb()), 300);
  }

  async logout(): Promise<void> {
    this.user = null;
    this.ready = false;
    this.data = null;
  }

  getUserProfile(): UserProfile | null {
    return this.user;
  }

  getRooms(): ChatRoom[] {
    if (!this.data) return [];
    return ChatService.sortByRecent(this.data.rooms.map(rawToRoom));
  }

  getMessages(roomId: RoomId): ChatMessage[] {
    if (!this.data) return [];
    const raw = this.data.messages[roomId] ?? [];
    return raw.map((m) => rawToMessage(m, roomId));
  }

  async selectRoom(roomId: RoomId): Promise<void> {
    if (!this.data) return;
    const room = this.data.rooms.find((r) => r.roomId === roomId);
    if (room) room.unread = 0;
  }

  async sendMessage(roomId: RoomId, body: string): Promise<void> {
    if (!this.data) return;
    const msgs = this.data.messages[roomId] ?? [];
    msgs.push({
      id: `msg-${Date.now()}`,
      sender: DEMO_USER.userId,
      senderName: DEMO_USER.displayName,
      type: 'm.text',
      body,
      ts: Date.now(),
      isOwn: true,
    });
    this.data.messages[roomId] = msgs;

    const room = this.data.rooms.find((r) => r.roomId === roomId);
    if (room) {
      room.lastMessage = body.slice(0, 60);
      room.lastTs = Date.now();
    }

    this.timelineCbs.forEach((cb) => cb(roomId));

    if (room?.type === 'bot') {
      this.simulateBotReply(roomId, body);
    }
  }

  async sendFile(roomId: RoomId, file: File): Promise<void> {
    if (!this.data) return;
    const isImage = file.type.startsWith('image/');
    const msgs = this.data.messages[roomId] ?? [];
    msgs.push({
      id: `file-${Date.now()}`,
      sender: DEMO_USER.userId,
      senderName: DEMO_USER.displayName,
      type: isImage ? 'm.image' : 'm.file',
      body: file.name,
      ts: Date.now(),
      isOwn: true,
      url: URL.createObjectURL(file),
      info: { mimetype: file.type, size: file.size },
    });
    this.data.messages[roomId] = msgs;

    const room = this.data.rooms.find((r) => r.roomId === roomId);
    if (room) {
      room.lastMessage = isImage ? '[图片]' : `[文件] ${file.name}`;
      room.lastTs = Date.now();
    }
    this.timelineCbs.forEach((cb) => cb(roomId));
  }

  sendTyping(): void {
    // No-op in demo
  }

  async createDmRoom(userId: UserId): Promise<RoomId | null> {
    if (!this.data) return null;
    // Check if a DM room already exists for this user
    const existing = this.data.rooms.find((r) => r.dmUserId === userId);
    if (existing) return existing.roomId;
    // Create a new DM room
    const roomId = `!dm-${userId.replace(/[@:]/g, '')}:dcf.local`;
    const displayName = userId.split(':')[0].slice(1);
    this.data.rooms.push({
      roomId,
      name: displayName,
      type: 'dm',
      dmUserId: userId,
      unread: 0,
      lastMessage: '',
      lastTs: Date.now(),
    });
    this.data.messages[roomId] = [];
    // Notify sync listeners so room list updates
    this.syncCbs.forEach((cb) => cb());
    return roomId;
  }

  async searchUsers(term: string): Promise<SearchUserResult[]> {
    const all: SearchUserResult[] = [
      { userId: '@lisi:dcf.local', displayName: '李四', avatarUrl: null },
      { userId: '@wangwu:dcf.local', displayName: '王五', avatarUrl: null },
      { userId: '@agent-coder:dcf.local', displayName: '小码 · 代码助手', avatarUrl: null },
    ];
    const t = term.toLowerCase();
    return all.filter((u) => u.displayName.toLowerCase().includes(t) || u.userId.includes(t));
  }

  onSync(cb: SyncCallback): void { this.syncCbs.push(cb); }
  onTimeline(cb: TimelineCallback): void { this.timelineCbs.push(cb); }
  onTyping(cb: TypingCallback): void { this.typingCbs.push(cb); }

  offSync(cb: SyncCallback): void { this.syncCbs = this.syncCbs.filter((c) => c !== cb); }
  offTimeline(cb: TimelineCallback): void { this.timelineCbs = this.timelineCbs.filter((c) => c !== cb); }
  offTyping(cb: TypingCallback): void { this.typingCbs = this.typingCbs.filter((c) => c !== cb); }

  isReady(): boolean { return this.ready; }

  private simulateBotReply(roomId: RoomId, userMessage: string): void {
    const room = this.data?.rooms.find((r) => r.roomId === roomId);
    if (!room?.dmUserId) return;

    this.typingCbs.forEach((cb) => cb(roomId, room.dmUserId!, true));

    setTimeout(() => {
      this.typingCbs.forEach((cb) => cb(roomId, room.dmUserId!, false));

      const reply: RawMessage = {
        id: `resp-${Date.now()}`,
        sender: room.dmUserId!,
        senderName: room.name,
        type: 'm.text',
        body: this.generateReply(roomId, userMessage),
        ts: Date.now(),
        isOwn: false,
      };

      // Attach rich content based on bot type and user message
      this.attachRichContent(reply, roomId, userMessage);

      const msgs = this.data!.messages[roomId] ?? [];
      msgs.push(reply);
      this.data!.messages[roomId] = msgs;
      room.lastMessage = reply.body.slice(0, 60);
      room.lastTs = reply.ts;

      this.timelineCbs.forEach((cb) => cb(roomId));
    }, 800 + Math.random() * 1200);
  }

  private generateReply(roomId: string, msg: string): string {
    const lower = msg.toLowerCase();
    if (roomId.includes('factory')) {
      if (lower.includes('创建')) return '✅ 数字员工已创建成功！\n\n- 工号: DCF-20260306-002\n- 岗位: 前端开发工程师\n- 状态: 已就绪';
      if (lower.includes('列表') || lower.includes('查看')) return '当前已创建 3 个数字员工：\n1. 小码 · 前端开发工程师\n2. 小文 · 技术文档写手\n3. 小析 · 数据分析师';
      return '我是数字工厂，可以帮你创建和管理数字员工。\n\n试试说：\n- "创建一个前端开发助手"\n- "查看数字员工列表"';
    }
    if (roomId.includes('coder')) {
      if (lower.includes('代码') || lower.includes('写') || lower.includes('hook') || lower.includes('组件')) return '好的，代码已生成，请点击右侧查看完整实现：';
      if (lower.includes('审查') || lower.includes('review')) return '代码审查完成，发现 2 个建议：\n1. 建议使用 useCallback 包裹回调\n2. 缺少错误边界处理';
      return '我是代码助手小码，擅长 React / TypeScript 开发。有什么可以帮你的？';
    }
    if (roomId.includes('writer')) {
      if (lower.includes('文档') || lower.includes('写') || lower.includes('prd')) return '文档已生成，请点击右侧查看：';
      if (lower.includes('翻译')) return '翻译完成，共处理 24 个词条。';
      return '我是文档写手小文，可以帮你撰写各类技术文档、PRD、会议纪要等。';
    }
    return `收到："${msg.slice(0, 40)}"，我会尽快处理。`;
  }

  private attachRichContent(reply: RawMessage, roomId: string, userMessage: string): void {
    const lower = userMessage.toLowerCase();

    if (roomId.includes('factory') && lower.includes('创建')) {
      reply.agentCard = { name: '小码', role: '前端开发工程师', id: 'agent-coder', tags: ['React', 'TypeScript'] };
    }

    if (roomId.includes('coder') && (lower.includes('代码') || lower.includes('写') || lower.includes('hook') || lower.includes('组件'))) {
      reply.drawerContent = {
        type: 'code',
        title: 'useDebounce.ts',
        data: {
          code: 'import { useState, useEffect } from "react";\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    const timer = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(timer);\n  }, [value, delay]);\n  return debounced;\n}',
          fileName: 'useDebounce.ts',
          language: 'TypeScript',
        },
      };
    }

    if (roomId.includes('writer') && (lower.includes('文档') || lower.includes('写') || lower.includes('prd'))) {
      reply.drawerContent = {
        type: 'doc',
        title: '产品概述文档',
        data: {
          html: '<h1>DCF 数字员工协作平台</h1><h2>1. 产品愿景</h2><p>打造企业级 AI 数字员工协作平台，让每个团队都能拥有自己的 AI 助手。</p><h2>2. 核心功能</h2><ul><li>数字员工创建与管理</li><li>技能装配与编排</li><li>多人协作对话</li><li>文档与代码生成</li></ul><h2>3. 目标用户</h2><p>中大型企业的产品、技术、运营团队。</p>',
        },
      };
    }
  }
}
