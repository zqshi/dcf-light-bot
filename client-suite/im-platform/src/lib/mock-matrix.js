/**
 * Mock Matrix — Demo 模式，模拟完整 Matrix SDK 行为
 * 无需部署 Synapse 即可体验完整 IM 平台功能
 */
import { bus, Events } from './events.js';
import { getState, setState, persistAuth } from './store.js';

const DEMO_USER = {
  userId: '@zhangsan:dcf.local',
  displayName: '张三',
  avatarUrl: null,
  org: 'DCF 数字工厂',
  department: '产品技术部',
  role: '高级工程师',
};

const DEMO_ROOMS = [
  {
    roomId: '!factory:dcf.local',
    name: '数字工厂',
    type: 'bot',
    dmUserId: '@dcf-factory-bot:dcf.local',
    unread: 1,
    avatar: null,
  },
  {
    roomId: '!agent-coder:dcf.local',
    name: '小码 · 代码助手',
    type: 'bot',
    dmUserId: '@agent-coder:dcf.local',
    unread: 0,
    avatar: null,
  },
  {
    roomId: '!agent-writer:dcf.local',
    name: '小文 · 文档写手',
    type: 'bot',
    dmUserId: '@agent-writer:dcf.local',
    unread: 3,
    avatar: null,
  },
  {
    roomId: '!lisi:dcf.local',
    name: '李四',
    type: 'dm',
    dmUserId: '@lisi:dcf.local',
    unread: 0,
    avatar: null,
  },
  {
    roomId: '!wangwu:dcf.local',
    name: '王五',
    type: 'dm',
    dmUserId: '@wangwu:dcf.local',
    unread: 2,
    avatar: null,
  },
  {
    roomId: '!team-frontend:dcf.local',
    name: '前端技术组',
    type: 'group',
    dmUserId: null,
    unread: 5,
    avatar: null,
  },
  {
    roomId: '!team-product:dcf.local',
    name: '产品讨论组',
    type: 'group',
    dmUserId: null,
    unread: 0,
    avatar: null,
  },
];

const now = Date.now();
const min = 60000;
const hour = 3600000;

const DEMO_MESSAGES = {
  '!factory:dcf.local': [
    { id: 'f1', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '欢迎来到数字工厂！我可以帮你创建和管理数字员工。\n\n你可以说：\n- "创建一个前端开发助手"\n- "帮我创建一个文档写手"\n- "查看我的数字员工列表"', ts: now - 2 * hour, isOwn: false },
    { id: 'f2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我创建一个前端开发助手', ts: now - 2 * hour + 5 * min, isOwn: true },
    { id: 'f3', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '好的，正在为您创建前端开发助手...\n\n✅ OpenClaw Pod 实例已启动\n✅ 数字员工 ID: DE-A3F8K2\n✅ 工号: DCF-20260306-001\n✅ 邮箱: agent-coder@dcf.local\n✅ 岗位: 前端开发工程师（继承自创建者）\n\n数字员工已就绪，点击下方卡片开始对话：', ts: now - 2 * hour + 6 * min, isOwn: false },
    {
      id: 'f4', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂',
      type: 'm.text', body: '[数字员工卡片]', ts: now - 2 * hour + 7 * min, isOwn: false,
      agentCard: { name: '小码', role: '前端开发工程师', id: 'agent-coder', tags: ['前端', 'React', 'TypeScript', 'Node.js'], model: 'Claude Sonnet 4.6' },
    },
    { id: 'f5', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '再帮我创建一个文档写手', ts: now - hour, isOwn: true },
    { id: 'f6', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂', type: 'm.text', body: '✅ 文档写手已创建！\n\n- 数字员工 ID: DE-B7C9M4\n- 工号: DCF-20260306-002\n- 模型: Claude Opus 4.6\n\n这位数字员工擅长技术文档、PRD、API文档的撰写与优化。', ts: now - hour + min, isOwn: false },
    {
      id: 'f7', sender: '@dcf-factory-bot:dcf.local', senderName: '数字工厂',
      type: 'm.text', body: '[数字员工卡片]', ts: now - hour + 2 * min, isOwn: false,
      agentCard: { name: '小文', role: '技术文档工程师', id: 'agent-writer', tags: ['文档', 'PRD', 'API文档', '技术写作'], model: 'Claude Opus 4.6' },
    },
  ],
  '!agent-coder:dcf.local': [
    { id: 'c1', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '你好！我是小码，你的前端开发助手。我可以帮你：\n\n🔧 编写和审查代码\n🐛 调试问题\n📦 架构设计\n🧪 编写测试\n\n有什么我可以帮你的吗？', ts: now - 2 * hour + 10 * min, isOwn: false },
    { id: 'c2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我写一个 React 的 useDebounce hook', ts: now - hour + 30 * min, isOwn: true },
    {
      id: 'c3', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手',
      type: 'm.text', body: '好的，这是一个生产级的 `useDebounce` Hook 实现：', ts: now - hour + 31 * min, isOwn: false,
      drawerContent: {
        type: 'code',
        title: 'useDebounce.ts',
        data: {
          code: `import { useState, useEffect, useRef, useCallback } from 'react';\n\n/**\n * useDebounce - 防抖 Hook\n * @param value 需要防抖的值\n * @param delay 延迟毫秒数\n */\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debouncedValue, setDebouncedValue] = useState<T>(value);\n\n  useEffect(() => {\n    const timer = setTimeout(() => {\n      setDebouncedValue(value);\n    }, delay);\n\n    return () => clearTimeout(timer);\n  }, [value, delay]);\n\n  return debouncedValue;\n}\n\n/**\n * useDebouncedCallback - 防抖回调 Hook\n * @param callback 需要防抖的回调函数\n * @param delay 延迟毫秒数\n */\nexport function useDebouncedCallback<T extends (...args: any[]) => any>(\n  callback: T,\n  delay: number\n): T {\n  const timerRef = useRef<ReturnType<typeof setTimeout>>();\n  const callbackRef = useRef(callback);\n  callbackRef.current = callback;\n\n  useEffect(() => {\n    return () => {\n      if (timerRef.current) clearTimeout(timerRef.current);\n    };\n  }, []);\n\n  return useCallback((...args: Parameters<T>) => {\n    if (timerRef.current) clearTimeout(timerRef.current);\n    timerRef.current = setTimeout(() => {\n      callbackRef.current(...args);\n    }, delay);\n  }, [delay]) as T;\n}`,
          language: 'TypeScript',
          fileName: 'useDebounce.ts',
        },
      },
    },
    { id: 'c4', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '包含两个导出：\n\n1. **`useDebounce`** — 对值进行防抖，适合搜索输入等场景\n2. **`useDebouncedCallback`** — 对回调函数防抖，适合按钮点击、API 调用等\n\n点击上方代码卡片可以在侧边面板中查看完整代码，支持自然语言修改。', ts: now - hour + 32 * min, isOwn: false },
    { id: 'c5', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '很好，帮我加上取消功能', ts: now - 30 * min, isOwn: true },
    { id: 'c6', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '已更新，增加了 `cancel()` 和 `flush()` 方法。你可以在代码面板中查看修改后的版本。\n\n需要我帮你写单元测试吗？', ts: now - 28 * min, isOwn: false },
  ],
  '!agent-writer:dcf.local': [
    { id: 'w1', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手', type: 'm.text', body: '你好！我是小文，专注于技术文档和产品文档的撰写。\n\n我的能力包括：\n📝 PRD 撰写与评审\n📖 API 文档生成\n📋 技术方案文档\n🔍 文档质量审查\n\n随时可以开始！', ts: now - hour + 15 * min, isOwn: false },
    { id: 'w2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '帮我写一份数字员工平台的产品概述文档', ts: now - 40 * min, isOwn: true },
    {
      id: 'w3', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手',
      type: 'm.text', body: '文档已生成，点击查看：', ts: now - 38 * min, isOwn: false,
      drawerContent: {
        type: 'doc',
        title: '产品概述文档',
        data: {
          html: `<h1>DCF 数字员工协作平台 — 产品概述</h1>
<h2>1. 产品定位</h2>
<p>DCF 数字员工协作平台是一个融合了即时通讯（IM）和 AI Agent 管理的企业级协作平台。通过 Matrix 协议提供稳定的通信基础，结合 OpenClaw Agent 框架，实现人类员工与数字员工的无缝协作。</p>
<h2>2. 核心能力</h2>
<ul>
<li><strong>即时通讯</strong>：基于 Matrix 协议的端到端加密消息系统</li>
<li><strong>数字员工创建</strong>：通过自然语言对话式交互创建 AI Agent</li>
<li><strong>多模态交互</strong>：支持文本、图片、文件、代码、原型等多种内容类型</li>
<li><strong>协作面板</strong>：右侧挤压式抽屉面板，支持文档编辑、代码查看、原型预览</li>
<li><strong>共享 Agent 大厅</strong>：团队级 Agent 共享和复用机制</li>
</ul>
<h2>3. 目标用户</h2>
<p>企业内部技术团队、产品团队、运营团队，以及需要 AI 辅助工作的各类知识工作者。</p>
<h2>4. 技术架构</h2>
<p>前端采用轻量级 Vanilla JS + Tailwind CSS 架构，后端基于 Matrix Synapse + OpenClaw Agent 框架，支持 Kubernetes 容器化部署。</p>`,
        },
      },
    },
    { id: 'w4', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手', type: 'm.text', body: '初版产品概述已生成。你可以在右侧文档面板中直接编辑，也可以告诉我需要补充或修改哪些部分。\n\n建议补充：\n- 竞品分析部分\n- 里程碑规划\n- 技术选型依据', ts: now - 36 * min, isOwn: false },
    { id: 'w5', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '补充竞品分析', ts: now - 10 * min, isOwn: true },
    { id: 'w6', sender: '@agent-writer:dcf.local', senderName: '小文 · 文档写手', type: 'm.text', body: '好的，正在分析市场上的同类产品...竞品分析部分已添加到文档中，主要对比了飞书、钉钉、Slack 和 Microsoft Teams 在 AI Agent 集成方面的差异。点击文档面板查看更新内容。', ts: now - 8 * min, isOwn: false },
  ],
  '!lisi:dcf.local': [
    { id: 'l1', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '张三，下午的评审会议准备好了吗？', ts: now - 3 * hour, isOwn: false },
    { id: 'l2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '准备好了，我把技术方案文档发你看看', ts: now - 3 * hour + 5 * min, isOwn: true },
    { id: 'l3', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '好的，收到后我看下', ts: now - 3 * hour + 6 * min, isOwn: false },
  ],
  '!wangwu:dcf.local': [
    { id: 'v1', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '你那个数字员工平台做得怎么样了？', ts: now - 20 * min, isOwn: false },
    { id: 'v2', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '老板说下周要看 demo', ts: now - 18 * min, isOwn: false },
  ],
  '!team-frontend:dcf.local': [
    { id: 't1', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '大家注意，下周一前端框架升级到 Vite 6', ts: now - 5 * hour, isOwn: false },
    { id: 't2', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '收到，需要做兼容性测试吗？', ts: now - 5 * hour + 3 * min, isOwn: false },
    { id: 't3', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '我已经在本地测试过了，没什么大问题', ts: now - 5 * hour + 5 * min, isOwn: true },
    { id: 't4', sender: '@lisi:dcf.local', senderName: '李四', type: 'm.text', body: '好的，那我们周三统一合并', ts: now - 5 * hour + 6 * min, isOwn: false },
    { id: 't5', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '我可以帮大家自动检测升级后的兼容性问题。需要我跑一次全量检测吗？', ts: now - 4 * hour, isOwn: false },
    { id: 't6', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '@小码 是的，帮我们跑一次', ts: now - 3 * hour + 50 * min, isOwn: true },
    { id: 't7', sender: '@agent-coder:dcf.local', senderName: '小码 · 代码助手', type: 'm.text', body: '✅ 检测完成，发现 3 个需要关注的问题：\n\n1. `vite-plugin-legacy` 需要更新到 v6 兼容版\n2. `import.meta.glob` 的 eager 参数行为有变更\n3. CSS modules 的 compose 语法需要调整\n\n详细报告已生成，点击查看。', ts: now - 3 * hour + 40 * min, isOwn: false },
  ],
  '!team-product:dcf.local': [
    { id: 'p1', sender: '@wangwu:dcf.local', senderName: '王五', type: 'm.text', body: '数字员工平台的 PRD 初稿我放到文档中心了', ts: now - 8 * hour, isOwn: false },
    { id: 'p2', sender: DEMO_USER.userId, senderName: DEMO_USER.displayName, type: 'm.text', body: '好的，我让小文帮我审查一下', ts: now - 8 * hour + 10 * min, isOwn: true },
  ],
};

// Generate lastMessage for rooms
DEMO_ROOMS.forEach(r => {
  const msgs = DEMO_MESSAGES[r.roomId];
  if (msgs?.length) {
    const last = msgs[msgs.length - 1];
    r.lastMessage = last.body?.slice(0, 60) || '';
    r.lastTs = last.ts;
  } else {
    r.lastMessage = '';
    r.lastTs = now - 10 * hour;
  }
});

let demoMode = false;

export function isDemoMode() { return demoMode; }

/**
 * Demo 登录
 */
export async function demoLogin() {
  demoMode = true;
  setState({
    user: { ...DEMO_USER },
    accessToken: 'demo-token',
    homeserverUrl: 'https://demo.dcf.local',
    matrixReady: true,
    rooms: [...DEMO_ROOMS],
  });
  persistAuth();

  // Simulate sync
  setTimeout(() => {
    bus.emit(Events.MATRIX_READY);
    bus.emit(Events.ROOM_LIST_UPDATED, DEMO_ROOMS);
    bus.emit(Events.MATRIX_SYNC, 'SYNCING');
  }, 300);
}

/**
 * Demo 选择房间
 */
export function demoSelectRoom(roomId) {
  // IMPORTANT: load messages BEFORE emitting ROOM_SELECTED
  // so renderMessages() has data when triggered by the event
  demoLoadMessages(roomId);
  setState({ currentRoomId: roomId });
  bus.emit(Events.ROOM_SELECTED, roomId);

  // Mark read
  const rooms = getState().rooms.map(r =>
    r.roomId === roomId ? { ...r, unread: 0 } : r
  );
  setState({ rooms });
  bus.emit(Events.ROOM_LIST_UPDATED, rooms);
}

/**
 * Demo 加载消息
 */
export function demoLoadMessages(roomId) {
  const msgs = DEMO_MESSAGES[roomId] || [];
  setState({ messages: msgs });
}

/**
 * Demo 发送消息
 */
export function demoSendMessage(roomId, body) {
  const msgs = DEMO_MESSAGES[roomId] || [];
  const newMsg = {
    id: `msg-${Date.now()}`,
    sender: DEMO_USER.userId,
    senderName: DEMO_USER.displayName,
    type: 'm.text',
    body,
    ts: Date.now(),
    isOwn: true,
  };
  msgs.push(newMsg);
  DEMO_MESSAGES[roomId] = msgs;

  // Update room last message
  const rooms = getState().rooms.map(r =>
    r.roomId === roomId ? { ...r, lastMessage: body.slice(0, 60), lastTs: newMsg.ts } : r
  );
  setState({ rooms, messages: [...msgs] });
  bus.emit(Events.ROOM_LIST_UPDATED, rooms);

  // Simulate bot response
  const room = DEMO_ROOMS.find(r => r.roomId === roomId);
  if (room?.type === 'bot') {
    simulateBotResponse(roomId, body);
  }
}

/**
 * Demo 发送文件
 */
export function demoSendFile(roomId, file) {
  const msgs = DEMO_MESSAGES[roomId] || [];
  const isImage = file.type?.startsWith('image/');
  const newMsg = {
    id: `msg-${Date.now()}`,
    sender: DEMO_USER.userId,
    senderName: DEMO_USER.displayName,
    type: isImage ? 'm.image' : 'm.file',
    body: file.name,
    url: isImage ? URL.createObjectURL(file) : null,
    info: { mimetype: file.type, size: file.size },
    ts: Date.now(),
    isOwn: true,
  };
  msgs.push(newMsg);
  DEMO_MESSAGES[roomId] = msgs;
  setState({ messages: [...msgs] });
}

function simulateBotResponse(roomId, userMessage) {
  // Show typing
  const botUserId = DEMO_ROOMS.find(r => r.roomId === roomId)?.dmUserId || '@bot:dcf.local';
  const botName = DEMO_ROOMS.find(r => r.roomId === roomId)?.name || 'Bot';

  bus.emit(Events.TYPING, { roomId, userId: botUserId, typing: true });

  const delay = 800 + Math.random() * 1500;
  setTimeout(() => {
    bus.emit(Events.TYPING, { roomId, userId: botUserId, typing: false });

    const response = generateBotResponse(roomId, userMessage, botName);
    const msgs = DEMO_MESSAGES[roomId] || [];
    msgs.push(response);
    DEMO_MESSAGES[roomId] = msgs;

    const rooms = getState().rooms.map(r =>
      r.roomId === roomId ? { ...r, lastMessage: response.body.slice(0, 60), lastTs: response.ts } : r
    );
    setState({ rooms });

    if (getState().currentRoomId === roomId) {
      setState({ messages: [...msgs] });
    }
    bus.emit(Events.ROOM_TIMELINE, { event: null, room: { roomId } });
    bus.emit(Events.ROOM_LIST_UPDATED, rooms);
  }, delay);
}

function generateBotResponse(roomId, userMessage, botName) {
  const msg = userMessage.toLowerCase();
  let body = '';
  let extra = {};

  if (roomId === '!factory:dcf.local') {
    if (msg.includes('创建') || msg.includes('新建')) {
      const name = msg.includes('测试') ? '小测' : msg.includes('设计') ? '小设' : msg.includes('运维') ? '小运' : '小助';
      const role = msg.includes('测试') ? '测试工程师' : msg.includes('设计') ? 'UI设计师' : msg.includes('运维') ? '运维工程师' : 'AI助手';
      body = `正在创建数字员工...\n\n✅ OpenClaw Pod 实例已启动\n✅ 数字员工 "${name}" 创建成功\n✅ 岗位: ${role}\n✅ 模型: Claude Sonnet 4.6\n\n可以开始对话了！`;
      extra.agentCard = { name, role, id: `agent-${Date.now().toString(36)}`, tags: [role, 'Claude Sonnet 4.6'], model: 'Claude Sonnet 4.6' };
    } else if (msg.includes('列表') || msg.includes('查看')) {
      body = '当前已创建的数字员工：\n\n1. 🤖 小码 — 前端开发工程师\n2. 📝 小文 — 技术文档工程师\n\n可以点击左侧列表进入对话，或继续创建新的数字员工。';
    } else {
      body = `收到！作为数字工厂，我主要负责创建和管理数字员工。\n\n你可以试试：\n- "创建一个测试工程师"\n- "查看我的数字员工"\n- "帮我创建一个UI设计师"`;
    }
  } else if (roomId === '!agent-coder:dcf.local') {
    if (msg.includes('代码') || msg.includes('写') || msg.includes('实现')) {
      body = '好的，我来帮你实现。代码已生成，点击查看：';
      extra.drawerContent = {
        type: 'code',
        title: 'generated-code.ts',
        data: {
          code: `// 根据你的需求生成的代码\n\nexport function processData(input: unknown[]): Result {\n  const validated = input.filter(isValid);\n  const transformed = validated.map(transform);\n  return {\n    data: transformed,\n    count: transformed.length,\n    timestamp: Date.now(),\n  };\n}\n\nfunction isValid(item: unknown): item is ValidItem {\n  return item !== null && typeof item === 'object';\n}\n\nfunction transform(item: ValidItem): TransformedItem {\n  return {\n    ...item,\n    processed: true,\n    processedAt: new Date().toISOString(),\n  };\n}`,
          language: 'TypeScript',
          fileName: 'generated-code.ts',
        },
      };
    } else if (msg.includes('测试')) {
      body = '我来生成单元测试：\n\n```typescript\ndescribe("processData", () => {\n  it("should filter invalid items", () => {\n    const result = processData([null, { id: 1 }, undefined]);\n    expect(result.count).toBe(1);\n  });\n});\n```\n\n需要我补充更多测试用例吗？';
    } else if (msg.includes('调试') || msg.includes('bug') || msg.includes('错误')) {
      body = '我来分析这个问题...\n\n🔍 **可能的原因：**\n1. 异步操作未正确等待\n2. 状态更新时序问题\n3. 边界条件未处理\n\n建议先在关键位置加上日志输出，我可以帮你定位具体问题。能把相关代码发给我看看吗？';
    } else {
      body = `明白了。作为你的代码助手，我可以帮你：\n\n- 编写新功能代码\n- 审查和优化现有代码\n- 调试和定位问题\n- 编写测试用例\n\n请告诉我具体需要做什么？`;
    }
  } else if (roomId === '!agent-writer:dcf.local') {
    if (msg.includes('文档') || msg.includes('写') || msg.includes('PRD')) {
      body = '好的，文档已生成。点击查看：';
      extra.drawerContent = {
        type: 'doc',
        title: '生成的文档',
        data: {
          html: `<h1>需求文档</h1><h2>1. 背景</h2><p>根据你的描述，整理了以下需求文档。</p><h2>2. 功能需求</h2><ul><li>核心功能 A：${userMessage.slice(0, 30)}</li><li>辅助功能 B：相关配套能力</li></ul><h2>3. 非功能需求</h2><p>性能、安全、可用性等要求...</p><h2>4. 验收标准</h2><p>待补充具体验收条件。</p>`,
        },
      };
    } else {
      body = '收到！我可以帮你撰写各类技术文档。请告诉我文档类型和主要内容，我会为你生成初稿。';
    }
  } else {
    body = `收到你的消息："${userMessage.slice(0, 40)}"\n\n我正在处理中...`;
  }

  return {
    id: `resp-${Date.now()}`,
    sender: DEMO_ROOMS.find(r => r.roomId === roomId)?.dmUserId || '@bot:dcf.local',
    senderName: botName,
    type: 'm.text',
    body,
    ts: Date.now(),
    isOwn: false,
    ...extra,
  };
}

/**
 * Demo 搜索用户
 */
export function demoSearchUsers(term) {
  const all = [
    { userId: '@lisi:dcf.local', displayName: '李四' },
    { userId: '@wangwu:dcf.local', displayName: '王五' },
    { userId: '@dcf-factory-bot:dcf.local', displayName: '数字工厂' },
    { userId: '@agent-coder:dcf.local', displayName: '小码 · 代码助手' },
    { userId: '@agent-writer:dcf.local', displayName: '小文 · 文档写手' },
  ];
  const t = (term || '').toLowerCase();
  return all.filter(u => !t || u.displayName.toLowerCase().includes(t) || u.userId.includes(t));
}
