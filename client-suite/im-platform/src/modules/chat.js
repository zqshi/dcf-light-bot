/**
 * Chat Module — 聊天核心：消息渲染、发送、多模态、@提及
 */
import { bus, Events } from '../lib/events.js';
import { getState, setState } from '../lib/store.js';
import { sendMessage, sendFile, sendTyping, selectRoom, getClient } from '../lib/matrix.js';
import { isDemoMode, demoSelectRoom, demoSendMessage, demoSendFile, demoSearchUsers } from '../lib/mock-matrix.js';
import { toggleDrawer } from '../ui/layout.js';
import { $, escHtml, simpleMarkdownToHtml } from '../lib/utils.js';
let currentFilter = 'all';
let typingTimer = null;

export function initChat() {
  // Room selection
  bus.on(Events.ROOM_LIST_UPDATED, renderRoomList);
  bus.on(Events.ROOM_SELECTED, onRoomSelected);
  bus.on(Events.ROOM_TIMELINE, () => renderMessages());
  bus.on(Events.TYPING, onTyping);

  // Conversation list click
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.conv-item');
    if (item) {
      const roomId = item.dataset.roomId;
      if (roomId) {
        if (isDemoMode()) demoSelectRoom(roomId);
        else selectRoom(roomId);
      }
    }
  });

  // Filter tabs
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.sidebar-tab[data-filter]');
    if (tab) {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.sidebar-tab[data-filter]').forEach(t =>
        t.classList.toggle('tab-active', t === tab));
      renderRoomList(getState().rooms);
    }
  });

  // Search
  const searchInput = $('#conv-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderRoomList(getState().rooms));
  }

  // Send message
  const sendBtn = $('#chat-send');
  const chatInput = $('#chat-input');

  if (sendBtn) sendBtn.addEventListener('click', doSend);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    chatInput.addEventListener('input', () => {
      autoResizeTextarea(chatInput);
      handleTyping();
      handleMentionPopup(chatInput);
    });
  }

  // File upload
  $('#btn-file')?.addEventListener('click', () => $('#file-input')?.click());
  $('#btn-image')?.addEventListener('click', () => $('#image-input')?.click());
  $('#file-input')?.addEventListener('change', (e) => handleFileUpload(e.target.files));
  $('#image-input')?.addEventListener('change', (e) => handleFileUpload(e.target.files));

  // Drawer buttons
  $('#btn-drawer-doc')?.addEventListener('click', () => toggleDrawer('doc', { html: '<h2>文档协作区</h2><p>此处将展示数字员工发送的文档内容</p>' }));
  $('#btn-drawer-code')?.addEventListener('click', () => toggleDrawer('code', { code: '# 代码查看区\nprint("Hello, DCF!")', language: 'Python', fileName: 'example.py' }));
  $('#btn-drawer-preview')?.addEventListener('click', () => toggleDrawer('preview', { html: '<div style="padding:40px;font-family:sans-serif"><h1>原型预览</h1><p>数字员工生成的原型将在此渲染</p></div>' }));

  // Welcome actions
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.welcome-card');
    if (!card) return;
    const action = card.dataset.action;
    if (action === 'create-agent' || action === 'find-bot') {
      bus.emit(Events.DOCK_SWITCH, 'factory');
      const dockBtn = document.querySelector('[data-dock-tab="factory"]');
      if (dockBtn) dockBtn.click();
    } else if (action === 'shared-agents') {
      const dockBtn = document.querySelector('[data-dock-tab="agents"]');
      if (dockBtn) dockBtn.click();
    }
  });

  // Agent card click
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.agent-card');
    if (card) {
      const agentData = card.dataset.agent;
      if (agentData) {
        try {
          bus.emit(Events.AGENT_CARD_CLICK, JSON.parse(agentData));
        } catch {}
      }
    }
  });

  // Attachment click — open in drawer
  document.addEventListener('click', (e) => {
    const att = e.target.closest('.msg-attachment');
    if (!att) return;
    const type = att.dataset.type;
    const data = att.dataset.content;
    if (type && data) {
      try {
        const parsed = JSON.parse(data);
        toggleDrawer(type, parsed);
      } catch {}
    }
  });

  // Mention popup click
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.mention-item');
    if (item) {
      const name = item.dataset.name;
      insertMention(name);
    }
  });
}

function doSend() {
  const input = $('#chat-input');
  const roomId = getState().currentRoomId;
  if (!input || !roomId) return;
  const text = input.value.trim();
  if (!text) return;
  if (isDemoMode()) demoSendMessage(roomId, text);
  else sendMessage(roomId, text);
  input.value = '';
  autoResizeTextarea(input);
  if (!isDemoMode()) sendTyping(roomId, false);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleTyping() {
  if (isDemoMode()) return;
  const roomId = getState().currentRoomId;
  if (!roomId) return;
  sendTyping(roomId, true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => sendTyping(roomId, false), 3000);
}

async function handleFileUpload(files) {
  const roomId = getState().currentRoomId;
  if (!roomId || !files?.length) return;
  for (const file of files) {
    try {
      if (isDemoMode()) demoSendFile(roomId, file);
      else await sendFile(roomId, file);
      renderMessages();
    } catch (err) {
      bus.emit(Events.TOAST, { message: `文件上传失败: ${err.message}`, type: 'error' });
    }
  }
}

/* ── Room List Rendering ── */
export function renderRoomList(rooms) {
  const list = $('#conv-list');
  if (!list || !rooms) return;

  const search = ($('#conv-search')?.value || '').toLowerCase();
  const filtered = rooms.filter(r => {
    if (currentFilter !== 'all' && r.type !== currentFilter) return false;
    if (search && !r.name.toLowerCase().includes(search)) return false;
    return true;
  });

  const currentId = getState().currentRoomId;
  list.innerHTML = filtered.length === 0
    ? '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">暂无会话</div>'
    : filtered.map(r => {
      const initials = r.name.slice(0, 1);
      const avatarClass = r.type === 'bot' ? 'bot' : r.type === 'dm' ? 'human' : 'group';
      const icon = r.type === 'bot' ? '<span class="material-symbols-outlined">smart_toy</span>' : initials;
      const time = r.lastTs ? formatTime(r.lastTs) : '';
      return `
        <div class="conv-item ${r.roomId === currentId ? 'active' : ''}" data-room-id="${r.roomId}">
          <div class="conv-avatar-wrap">
            <div class="conv-avatar ${avatarClass}">
              ${r.avatar ? `<img src="${r.avatar}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">` : icon}
            </div>
            <span class="status-dot online"></span>
          </div>
          <div class="conv-info">
            <div class="conv-name-row">
              <span class="conv-name">${escHtml(r.name)}${r.type === 'bot' ? ' <span class="conv-badge-bot">Bot</span>' : ''}</span>
              <span class="conv-time">${time}</span>
            </div>
            <div class="conv-preview">${escHtml(r.lastMessage)}</div>
          </div>
          ${r.unread > 0 ? `<span class="conv-unread">${r.unread > 99 ? '99+' : r.unread}</span>` : ''}
        </div>`;
    }).join('');

  // Update dock badge
  const total = rooms.reduce((sum, r) => sum + (r.unread || 0), 0);
  const badge = $('#dock-unread-messages');
  if (badge) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.toggle('hidden', total === 0);
  }
}

/* ── Chat View ── */
function onRoomSelected(roomId) {
  const welcome = $('#chat-welcome');
  const chatView = $('#chat-view');
  if (welcome) welcome.style.display = 'none';
  if (chatView) { chatView.classList.remove('hidden'); chatView.style.display = 'flex'; }

  // Update header
  const room = getState().rooms.find(r => r.roomId === roomId);
  if (room) {
    const nameEl = $('#chat-room-name');
    const statusEl = $('#chat-room-status');
    const avatarEl = $('#chat-room-avatar');
    if (nameEl) nameEl.textContent = room.name;
    if (statusEl) statusEl.textContent = room.type === 'bot' ? '数字员工 · 在线' : '在线';
    if (avatarEl) {
      avatarEl.className = `chat-header-avatar ${room.type === 'bot' ? 'bot' : 'human'}`;
      if (room.avatar) avatarEl.innerHTML = `<img src="${room.avatar}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">`;
      else avatarEl.innerHTML = room.type === 'bot' ? '<span class="material-symbols-outlined">smart_toy</span>' : room.name.slice(0, 1);
    }
  }

  // Mark active in list
  document.querySelectorAll('.conv-item').forEach(item => {
    item.classList.toggle('active', item.dataset.roomId === roomId);
  });

  renderMessages();
}

export function renderMessages() {
  const container = $('#chat-messages');
  if (!container) return;
  const { messages, user } = getState();
  const client = getClient();
  const myId = isDemoMode() ? user?.userId : client?.getUserId();

  container.innerHTML = messages.map(msg => {
    const isOwn = msg.sender === myId;
    const avatarClass = msg.sender.includes('bot') || msg.sender.includes('agent') ? 'bot' : 'human';
    const avatar = msg.avatarUrl
      ? `<img src="${msg.avatarUrl}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">`
      : msg.senderName.slice(0, 1);

    // Agent card
    if (msg.agentCard) {
      return renderAgentCardMessage(msg, isOwn);
    }

    // File / Image
    let attachmentHtml = '';
    if (msg.type === 'm.image' && msg.url) {
      attachmentHtml = `<div class="msg-attachment" data-type="preview" data-content='${JSON.stringify({ html: `<img src="${msg.url}" style="max-width:100%">` })}'>
        <img src="${msg.url}" alt="${escHtml(msg.body)}" loading="lazy" />
      </div>`;
    } else if (msg.type === 'm.file' && msg.url) {
      attachmentHtml = `<div class="msg-attachment" data-type="doc" data-content='${JSON.stringify({ text: msg.body })}'>
        <div class="msg-attachment-file">
          <span class="material-symbols-outlined">description</span>
          <div><div class="file-name">${escHtml(msg.body)}</div><div class="file-size">${formatSize(msg.info?.size)}</div></div>
        </div>
      </div>`;
    }

    // Drawer content from agent
    if (msg.drawerContent) {
      const dc = msg.drawerContent;
      attachmentHtml += `<div class="msg-attachment" data-type="${dc.type}" data-content='${JSON.stringify(dc.data)}' style="cursor:pointer">
        <div class="msg-attachment-file">
          <span class="material-symbols-outlined">${dc.type === 'code' ? 'code' : dc.type === 'preview' ? 'visibility' : 'description'}</span>
          <div><div class="file-name">${escHtml(dc.title || '点击查看')}</div><div class="file-size">点击在侧边面板中打开</div></div>
        </div>
      </div>`;
    }

    const bodyHtml = renderMessageBody(msg.body, msg.formattedBody);

    return `
      <div class="message-row ${isOwn ? 'outgoing' : ''} fade-in">
        <div class="msg-avatar ${avatarClass}">${avatar}</div>
        <div class="msg-body">
          <div class="msg-sender">${escHtml(msg.senderName)}</div>
          <div class="msg-bubble">${bodyHtml}</div>
          ${attachmentHtml}
          <div class="msg-time">${formatMessageTime(msg.ts)}</div>
        </div>
      </div>`;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function renderAgentCardMessage(msg, isOwn) {
  const card = msg.agentCard;
  const data = JSON.stringify(card).replace(/'/g, '&#39;');
  return `
    <div class="message-row ${isOwn ? 'outgoing' : ''} fade-in">
      <div class="msg-avatar bot"><span class="material-symbols-outlined">smart_toy</span></div>
      <div class="msg-body">
        <div class="msg-sender">${escHtml(msg.senderName)}</div>
        <div class="agent-card" data-agent='${data}'>
          <div class="agent-card-header">
            <div class="agent-card-avatar"><span class="material-symbols-outlined">smart_toy</span></div>
            <div>
              <div class="agent-card-name">${escHtml(card.name || '数字员工')}</div>
              <div class="agent-card-role">${escHtml(card.role || '通用助手')}</div>
            </div>
          </div>
          <div class="agent-card-attrs">
            ${(card.tags || []).map(t => `<span class="agent-card-attr">${escHtml(t)}</span>`).join('')}
          </div>
          <button class="agent-card-action">开始对话 <span class="material-symbols-outlined" style="font-size:16px;margin-left:4px;vertical-align:-3px">arrow_forward</span></button>
        </div>
        <div class="msg-time">${formatMessageTime(msg.ts)}</div>
      </div>
    </div>`;
}

function renderMessageBody(body, formattedBody) {
  if (formattedBody) return formattedBody;
  return simpleMarkdownToHtml(body);
}

/* ── @Mention Popup ── */
function handleMentionPopup(input) {
  const val = input.value;
  const cursor = input.selectionStart;
  const before = val.slice(0, cursor);
  const match = before.match(/@(\w*)$/);
  const popup = $('#mention-popup');
  if (!popup) return;

  if (match) {
    const term = match[1].toLowerCase();
    let agents;
    if (isDemoMode()) {
      agents = demoSearchUsers(term)
        .map(u => ({ name: u.displayName, type: 'bot' }))
        .slice(0, 5);
    } else {
      const { rooms } = getState();
      agents = rooms
        .filter(r => r.type === 'bot')
        .filter(r => !term || r.name.toLowerCase().includes(term))
        .slice(0, 5);
    }

    if (agents.length > 0) {
      popup.innerHTML = agents.map(a => `
        <div class="mention-item" data-name="${escHtml(a.name)}">
          <div class="mention-item-avatar bot"><span class="material-symbols-outlined">smart_toy</span></div>
          <div>
            <div class="mention-item-name">${escHtml(a.name)}</div>
            <div class="mention-item-role">数字员工</div>
          </div>
        </div>
      `).join('');
      popup.classList.add('visible');
      return;
    }
  }
  popup.classList.remove('visible');
}

function insertMention(name) {
  const input = $('#chat-input');
  if (!input) return;
  const val = input.value;
  const cursor = input.selectionStart;
  const before = val.slice(0, cursor).replace(/@\w*$/, '');
  input.value = before + `@${name} ` + val.slice(cursor);
  input.focus();
  input.selectionStart = input.selectionEnd = before.length + name.length + 2;
  $('#mention-popup')?.classList.remove('visible');
}

/* ── Typing Indicator ── */
function onTyping({ roomId, userId, typing }) {
  if (roomId !== getState().currentRoomId) return;
  const client = getClient();
  if (userId === client?.getUserId()) return;
  const el = $('#typing-indicator');
  const textEl = $('#typing-text');
  if (!el) return;
  if (typing) {
    const name = userId.split(':')[0].slice(1);
    if (textEl) textEl.textContent = `${name} 正在输入...`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/* ── Utilities ── */
function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 86400000 * 7) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMessageTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(1) + 'MB';
}

// escHtml 已从 lib/utils.js 统一导入
