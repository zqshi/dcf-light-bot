(function () {
  var DRAWER_ID = "dcfMatrixMessageDrawer";
  var MASK_ID = "dcfMatrixMessageDrawerMask";
  var BODY_OPEN_CLASS = "dcf-matrix-drawer-open";
  var STYLE_ID = "dcfMatrixDrawerStyle";
  var ADMIN_ENTRY_ITEM_CLASS = "dcf-admin-entry-item";
  var adminEntryState = {
    checked: false,
    visible: false,
    adminUrl: "/admin/index.html"
  };
  var PREFERRED_LANGUAGE = "zh-hans";
  var DCF_E2EE_ENABLED = false;
  var FACTORY_ROOM_ALIAS = "#dcf-factory:localhost";
  var LANGUAGE_RELOAD_FLAG = "dcf_lang_reloaded_once";
  var ROOM_PREVIEW_REDIRECT_GUARD = "dcf_room_preview_redirect_guard";
  var ROOM_AFTER_LEAVE_REDIRECT_FLAG = "dcf_room_after_leave_redirect_flag";
  var ENCRYPTED_BOT_REDIRECT_GUARD = "dcf_encrypted_bot_redirect_guard";
  var FACTORY_PREVIEW_REDIRECT_GUARD = "dcf_factory_preview_redirect_guard";

  // ── Eagerly set language in localStorage BEFORE Element Web's bundle parses it ──
  // This runs synchronously at <head> parse time, ensuring i18next picks up zh-hans
  // on first init rather than falling back to English.
  (function earlyLanguageSet() {
    try {
      localStorage.setItem("i18nextLng", PREFERRED_LANGUAGE);
      var raw = localStorage.getItem("mx_local_settings");
      var settings = raw ? JSON.parse(raw) : {};
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
      settings.language = PREFERRED_LANGUAGE;
      localStorage.setItem("mx_local_settings", JSON.stringify(settings));
    } catch {}
    try {
      if (document && document.documentElement) {
        document.documentElement.setAttribute("lang", PREFERRED_LANGUAGE);
      }
    } catch {}
  })();

  var UI_TEXT_MAP = {
    "Notifications": "通知",
    "Notification": "通知",
    "Unreads": "未读",
    "Unread": "未读",
    "Favourites": "收藏",
    "Favorites": "收藏",
    "Favourite": "收藏",
    "Favorite": "收藏",
    "Mentions": "提及",
    "Mention": "提及",
    "Invites": "邀请",
    "Invite": "邀请",
    "Low priority": "低优先级",
    "Low Priority": "低优先级",
    "Settings": "设置",
    "Security & Privacy": "安全与隐私",
    "Help & About": "帮助与关于",
    "Sign out": "退出登录",
    "Sign Out": "退出登录",
    "Start chat": "发起会话",
    "Explore rooms": "探索房间",
    "Create room": "创建房间",
    "People": "联系人",
    "Rooms": "房间",
    "Threads": "线程",
    "Search": "搜索",
    "Send": "发送",
    "Reply": "回复",
    "Cancel": "取消",
    "Save": "保存",
    "Close": "关闭",
    "Back": "返回",
    "Edit": "编辑",
    "Delete": "删除",
    "Copy": "复制",
    "Retry": "重试",
    "View source": "查看来源",
    "No chats yet": "暂无会话",
    "Get started by messaging someone or creating a room": "通过发起聊天或创建房间开始使用",
    "Get started by messaging someone or by creating a room": "通过发起聊天或创建房间开始使用",
    "Get started by messaging someone": "通过发起聊天开始使用",
    "You don't have favourite chats yet": "你还没有收藏会话",
    "You can add a chat to your favourites in the chat settings": "你可以在会话设置中将聊天添加到收藏",
    "You don't have any low priority rooms": "你没有低优先级房间",
    "You don’t have direct chats with anyone yet": "你还没有与任何人进行私聊",
    "You can deselect filters in order to see your other chats": "你可以取消筛选以查看其他会话",
    "You’re not in any room yet": "你还未加入任何房间",
    "You don't have any unread invites": "你没有未读邀请",
    "You don't have any unread messages": "你没有未读消息",
    "You don't have any unread mentions": "你没有未读提及",
    "You don't have any unread notifications": "你没有未读通知",
    "Congrats! You don't have any unread messages": "太好了，你没有未读消息",
    "Congrats! You don’t have any unread messages": "太好了，你没有未读消息",
    "See all activity": "查看全部动态",
    "Show all chats": "显示全部会话",
    "Jump to date": "跳转日期",
    "Mark as read": "标记已读",
    "Mark as unread": "标记未读",
    "Invite": "邀请"
    ,
    "Confirm your identity": "确认你的身份",
    "Verify this device to set up secure messaging": "验证此设备以启用安全加密消息",
    "Use another device": "使用另一台设备",
    "Can't confirm?": "无法确认？",
    "Set up recovery": "设置恢复密钥",
    "Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your devices.": "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。",
    "Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your device.": "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。",
    "Continue": "继续",
    "Skip": "跳过",
    "Later": "稍后再说",
    "Verify": "验证",
    "Verification request": "验证请求",
    "Session verification": "会话验证",
    "Cross-signing": "跨设备签名",
    "Secure backup": "安全备份",
    "Recovery key": "恢复密钥",
    "Set up Secure Backup": "设置安全备份",
    "Set up secure backup": "设置安全备份",
    "Set up key backup": "设置密钥备份",
    "Encrypted by default": "默认启用加密",
    "Messages here are end-to-end encrypted.": "此处消息已启用端到端加密。",
    "Messages here are end-to-end encrypted. Verify": "此处消息已启用端到端加密。请验证",
    "other messages in this room cannot be trusted": "此房间中的其他消息暂无法信任",
    "Verify now": "立即验证",
    "Verify later": "稍后验证"
    ,
    "Settings: Encryption": "设置：加密",
    "Key storage": "密钥存储",
    "Allow key storage": "允许密钥存储",
    "Recovery": "恢复",
    "Advanced": "高级",
    "Encryption details": "加密详情",
    "Session ID:": "会话 ID：",
    "Session key:": "会话密钥：",
    "Export keys": "导出密钥",
    "Import keys": "导入密钥",
    "Reset cryptographic identity": "重置加密身份",
    "Other people's devices": "其他人的设备",
    "In encrypted rooms, only send messages to verified users": "在加密房间中，仅向已验证用户发送消息",
    "Learn more": "了解更多",
    "Account": "账号",
    "Encryption": "加密",
    "Voice call": "语音通话",
    "Video call": "视频通话",
    "Hangup": "挂断",
    "Mute microphone": "静音",
    "Unmute microphone": "取消静音",
    "Turn on camera": "打开摄像头",
    "Turn off camera": "关闭摄像头",
    "Start voice call": "发起语音通话",
    "Start video call": "发起视频通话",
    "Active call": "通话中",
    "Call": "通话",
    "Answer": "接听",
    "Decline": "拒绝",
    "Hold": "保持",
    "Resume": "恢复",
    "Dialpad": "拨号盘",
    "Ongoing call": "通话进行中",
    "Call ended": "通话已结束",
    "Call failed": "通话失败",
    "No answer": "无人接听",
    "Busy": "忙碌",
    "You missed a call": "你有一个未接来电",
    "Missed call": "未接来电",
    "Screen sharing": "屏幕共享",
    "Share screen": "共享屏幕",
    "Stop sharing": "停止共享"
  };
  var UI_PHRASE_MAP = {
    "Messages here are end-to-end encrypted.": "此处消息已启用端到端加密。",
    "Verify ": "请验证 ",
    " in their profile - tap on their profile picture.": " 的资料：点击其头像完成验证。",
    "in their profile - tap on their profile picture.": "在其资料页中点击头像完成验证。",
    "Verify this device": "验证此设备",
    "secure messaging": "安全加密消息",
    "Set up recovery": "设置恢复密钥",
    "recovery key": "恢复密钥",
    "encrypted message history": "加密消息历史",
    "Use another device": "使用另一台设备",
    "Can't confirm?": "无法确认？",
    "Store your cryptographic identity and message keys securely on the server. This will allow you to view your message history on any new devices.": "将你的加密身份和消息密钥安全存储在服务器上，以便你在新设备上查看消息历史。",
    "Store your cryptographic identity and message keys securely on the server.": "将你的加密身份和消息密钥安全存储在服务器上。",
    "This will allow you to view your message history on any new devices.": "这样你可以在新设备上查看消息历史。",
    "Recover your cryptographic identity and message history with a recovery key if you've lost all your existing devices.": "若你丢失了现有全部设备，可通过恢复密钥恢复加密身份和消息历史。",
    "Recover your cryptographic identity and message history with a recovery key": "通过恢复密钥恢复加密身份和消息历史",
    "if you've lost all your existing devices.": "（当你丢失现有全部设备时）。",
    "Warning: users who have not explicitly verified with you": "警告：未与你明确完成验证的用户",
    "will not receive your encrypted messages.": "将无法接收你的加密消息。",
    "Also, unverified devices of verified users will not receive your encrypted messages.": "此外，已验证用户的未验证设备也无法接收你的加密消息。",
    "Changes require an application restart to take effect.": "更改需重启应用后生效。",
    "Key storage": "密钥存储",
    "Recovery": "恢复",
    "Advanced": "高级",
    "Encryption details": "加密详情",
    "Export keys": "导出密钥",
    "Import keys": "导入密钥",
    "Reset cryptographic identity": "重置加密身份",
    "Other people's devices": "其他人的设备",
    "In encrypted rooms, only send messages to verified users": "在加密房间中，仅向已验证用户发送消息"
    ,
    "Send an encrypted message": "发送消息",
    "Send an encrypted message…": "发送消息……",
    "Send an encrypted message...": "发送消息......",
    "Voice call": "语音通话",
    "Video call": "视频通话",
    "Start voice call": "发起语音通话",
    "Start video call": "发起视频通话",
    "Hangup": "挂断",
    "Mute microphone": "静音",
    "Unmute microphone": "取消静音",
    "Turn on camera": "打开摄像头",
    "Turn off camera": "关闭摄像头",
    "Active call": "通话中",
    "Answer": "接听",
    "Decline": "拒绝",
    "Ongoing call": "通话进行中",
    "Call ended": "通话已结束",
    "Call failed": "通话失败",
    "No answer": "无人接听",
    "You missed a call": "你有一个未接来电",
    "Missed call": "未接来电",
    "Share screen": "共享屏幕",
    "Stop sharing": "停止共享",
    "Screen sharing": "屏幕共享"
  };
  var UI_REGEX_REPLACEMENTS = [
    { from: /Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your devices\./gi, to: "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。" },
    { from: /Generate a recovery key that can be used to restore your encrypted message history\./gi, to: "生成恢复密钥，用于恢复加密消息历史。" },
    { from: /in case you lose access to your devices\./gi, to: "（当你无法访问设备时）。" },
    { from: /\bSettings:\s*Account\b/gi, to: "设置：账号" },
    { from: /\bSettings:\s*Encryption\b/gi, to: "设置：加密" },
    { from: /\bSet up recovery\b/gi, to: "设置恢复密钥" },
    { from: /\bPersonal info\b/gi, to: "个人信息" },
    { from: /\bDisplay Name\b/gi, to: "显示名称" },
    { from: /\bUsername\b/gi, to: "用户名" },
    { from: /\bAccount\b/gi, to: "账号" },
    { from: /\bLearn more\b/gi, to: "了解更多" }
  ];
  var RECOVERY_PROMPT_PATTERNS = [
    "设置恢复密钥",
    "set up recovery",
    "恢复密钥",
    "recovery key",
    "secure backup"
  ];
  var SESSION_VERIFICATION_PROMPT_PATTERNS = [
    "验证会话",
    "验证此会话",
    "会话验证",
    "其他用户可能不信任它",
    "session verification",
    "verify this session",
    "verify session",
    "can't be trusted"
  ];
  var LOGOUT_ENCRYPTION_WARNING_PATTERNS = [
    "你将失去你的加密消息的访问权",
    "这些密钥会从此设备删除",
    "在登出之前请备份密钥以免丢失",
    "lose access to your encrypted messages",
    "keys will be removed from this device",
    "before signing out make sure you've got keys"
  ];

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function isRoomView() {
    return String(window.location.hash || "").indexOf("#/room") === 0;
  }

  function isAuthHash(hash) {
    var val = String(hash || "").toLowerCase();
    return val.indexOf("#/login") === 0 || val.indexOf("#/welcome") === 0 || val.indexOf("#/soft_logout") === 0;
  }

  function redirectToUnifiedLoginIfNeeded() {
    if (isAuthHash(window.location.hash || "")) {
      window.location.replace("/welcome.html");
    }
  }

  function ensurePreferredLanguage() {
    var changed = false;
    var prevLang = String(localStorage.getItem("i18nextLng") || "").trim().toLowerCase();
    if (prevLang !== PREFERRED_LANGUAGE) changed = true;
    localStorage.setItem("i18nextLng", PREFERRED_LANGUAGE);
    try {
      var raw = localStorage.getItem("mx_local_settings");
      var settings = raw ? JSON.parse(raw) : {};
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
      if (settings.language !== PREFERRED_LANGUAGE) {
        settings.language = PREFERRED_LANGUAGE;
        changed = true;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));
      }
      if (DCF_E2EE_ENABLED !== true) {
        settings.useE2eForGroupChats = false;
        settings.useE2eForDirectChats = false;
        settings.sendEncryptedMessagesInDms = false;
        settings.onlySendToVerifiedDevices = false;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));
      }
    } catch {
      changed = true;
      localStorage.setItem("mx_local_settings", JSON.stringify({ language: PREFERRED_LANGUAGE }));
    }
    try {
      if (document && document.documentElement) {
        document.documentElement.setAttribute("lang", PREFERRED_LANGUAGE);
      }
    } catch {}
    return changed;
  }

  function tryReloadForLanguageApply(changed) {
    if (!changed) return;
    if (isAuthHash(window.location.hash || "")) return;
    // Use localStorage with a short TTL instead of sessionStorage so that
    // hard-refresh (which preserves sessionStorage) can still trigger a
    // necessary reload when the language was wrong.
    try {
      var raw = localStorage.getItem(LANGUAGE_RELOAD_FLAG);
      if (raw) {
        var ts = parseInt(raw, 10);
        // Guard expires after 10 seconds — prevents infinite reload loops
        // while still allowing a fresh reload on hard-refresh.
        if (!isNaN(ts) && Date.now() - ts < 10000) return;
      }
      localStorage.setItem(LANGUAGE_RELOAD_FLAG, String(Date.now()));
    } catch {
      // If localStorage fails, skip reload to avoid loop
      return;
    }
    window.location.reload();
  }

  function clearCryptoClientStorageIfDisabled() {
    if (DCF_E2EE_ENABLED === true) return;
    try {
      var removeKeys = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = String(localStorage.key(i) || "");
        if (!key) continue;
        if (key.indexOf("mx_crypto_") === 0 || key.indexOf("mx_secure_backup") === 0) {
          removeKeys.push(key);
        }
      }
      for (var j = 0; j < removeKeys.length; j += 1) {
        localStorage.removeItem(removeKeys[j]);
      }
    } catch {}
    try {
      if (window.indexedDB && typeof window.indexedDB.deleteDatabase === "function") {
        window.indexedDB.deleteDatabase("matrix-js-sdk:crypto");
        window.indexedDB.deleteDatabase("matrix-js-sdk::crypto");
      }
    } catch {}
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "body." + BODY_OPEN_CLASS + " .mx_RoomView { transition: margin-right .18s ease; margin-right: 420px; }",
      "#" + MASK_ID + " { position: fixed; inset: 0; background: rgba(8, 15, 28, 0.25); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity .18s ease; }",
      "#" + MASK_ID + ".open { opacity: 1; pointer-events: auto; }",
      "#" + DRAWER_ID + " { position: fixed; top: 0; right: 0; height: 100vh; width: 420px; max-width: 92vw; background: #fff; border-left: 1px solid #e1e8f5; box-shadow: -16px 0 40px rgba(18, 38, 72, 0.2); z-index: 9999; transform: translateX(100%); transition: transform .2s ease; display: flex; flex-direction: column; }",
      "#" + DRAWER_ID + ".open { transform: translateX(0); }",
      "#" + DRAWER_ID + " .dcf-hd { min-height: 56px; padding: 10px 14px; border-bottom: 1px solid #e6edf8; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: linear-gradient(180deg,#f8fbff,#f4f8ff); }",
      "#" + DRAWER_ID + " .dcf-hd strong { font-size: 15px; color: #14233b; }",
      "#" + DRAWER_ID + " .dcf-close { border: 0; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; background: #edf3ff; color: #2f4b79; font-size: 16px; }",
      "#" + DRAWER_ID + " .dcf-bd { padding: 14px; overflow: auto; display: grid; gap: 12px; }",
      "#" + DRAWER_ID + " .dcf-meta { border: 1px solid #dfebff; border-radius: 12px; background: #f9fcff; padding: 10px 12px; display: grid; gap: 8px; }",
      "#" + DRAWER_ID + " .dcf-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; }",
      "#" + DRAWER_ID + " .dcf-meta-row span { color: #6280aa; }",
      "#" + DRAWER_ID + " .dcf-meta-row strong { color: #1e385f; font-weight: 600; text-align: right; word-break: break-all; }",
      "#" + DRAWER_ID + " .dcf-msg { border: 1px solid #d8e6ff; border-radius: 12px; background: #fff; padding: 10px 12px; color: #1c314f; font-size: 14px; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }",
      "#" + DRAWER_ID + " .dcf-actions { display: flex; gap: 8px; flex-wrap: wrap; }",
      "#" + DRAWER_ID + " .dcf-actions button { border: 1px solid #bed2f7; background: #f2f7ff; color: #24508e; border-radius: 10px; min-height: 34px; padding: 0 10px; cursor: pointer; font-size: 12px; }",
      "#" + DRAWER_ID + " .dcf-actions button:hover { filter: brightness(1.03); }",
      "." + ADMIN_ENTRY_ITEM_CLASS + " { color: #1a4f98 !important; font-weight: 600 !important; }",
      ".mx_AuthFooter { display: none !important; }",
      ".mx_SetupEncryptionToast, .mx_ToastContainer .mx_SetupEncryptionToast, .mx_ToastContainer .mx_GenericToast.mx_SetupEncryptionToast { display: none !important; }",
      ".mx_ToastContainer .mx_Toast:has(.mx_SetupEncryptionToast), .mx_ToastContainer .mx_SetupEncryptionToast:has(button) { display: none !important; }",
      "@media (max-width: 980px) { body." + BODY_OPEN_CLASS + " .mx_RoomView { margin-right: 0; } #" + DRAWER_ID + " { width: 100vw; max-width: 100vw; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureNodes() {
    var mask = document.getElementById(MASK_ID);
    if (!mask) {
      mask = document.createElement("div");
      mask.id = MASK_ID;
      document.body.appendChild(mask);
    }

    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.id = DRAWER_ID;
      drawer.setAttribute("aria-hidden", "true");
      drawer.innerHTML = [
        '<div class="dcf-hd"><strong>会话详情</strong><button class="dcf-close" type="button" aria-label="关闭">×</button></div>',
        '<div class="dcf-bd">',
        '<div class="dcf-meta">',
        '<div class="dcf-meta-row"><span>发送方</span><strong data-k="sender">-</strong></div>',
        '<div class="dcf-meta-row"><span>时间</span><strong data-k="time">-</strong></div>',
        '<div class="dcf-meta-row"><span>事件ID</span><strong data-k="eventId">-</strong></div>',
        "</div>",
        '<div class="dcf-msg" data-k="body">-</div>',
        '<div class="dcf-actions">',
        '<button type="button" data-a="copy">复制消息</button>',
        '<button type="button" data-a="quote">@引用到输入框</button>',
        "</div>",
        "</div>"
      ].join("");
      document.body.appendChild(drawer);
    }
    return { mask: mask, drawer: drawer };
  }

  function openDrawer(data) {
    var nodes = ensureNodes();
    var drawer = nodes.drawer;
    var mask = nodes.mask;
    drawer.querySelector('[data-k="sender"]').textContent = data.sender || "-";
    drawer.querySelector('[data-k="time"]').textContent = data.time || "-";
    drawer.querySelector('[data-k="eventId"]').textContent = data.eventId || "-";
    drawer.querySelector('[data-k="body"]').textContent = data.body || "-";
    drawer.dataset.message = data.body || "";
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    mask.classList.add("open");
    document.body.classList.add(BODY_OPEN_CLASS);
  }

  function closeDrawer() {
    var drawer = document.getElementById(DRAWER_ID);
    var mask = document.getElementById(MASK_ID);
    if (drawer) {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
    }
    if (mask) mask.classList.remove("open");
    document.body.classList.remove(BODY_OPEN_CLASS);
  }

  function getText(node, selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var n = node.querySelector(selectors[i]);
      var t = (n && n.textContent ? n.textContent : "").trim();
      if (t) return t;
    }
    return "";
  }

  function extractMessage(tile) {
    var sender = getText(tile, [
      ".mx_SenderProfile_name",
      ".mx_DisambiguatedProfile_displayName",
      ".mx_EventTile_sender",
      "[data-testid='member-name']"
    ]);
    var time = getText(tile, ["time", ".mx_MessageTimestamp", ".mx_EventTile_timestamp"]);
    var body = getText(tile, [
      ".mx_MTextBody",
      ".mx_EventTile_body",
      ".mx_EventTile_line .mx_Body",
      ".mx_EventTile_content"
    ]);
    if (!body) {
      body = (tile.textContent || "").trim().replace(/\s+/g, " ");
      if (body.length > 1200) body = body.slice(0, 1200) + " ...";
    }
    var eventId = String(tile.getAttribute("data-event-id") || "").trim();
    if (!eventId) {
      var token = String(tile.getAttribute("data-scroll-tokens") || "").trim();
      if (token) eventId = token;
    }
    return { sender: sender, time: time, body: body, eventId: eventId };
  }

  function insertQuoteToComposer(text) {
    var composer = document.querySelector(".mx_BasicMessageComposer_input");
    if (!composer) return;
    var quoted = ["> " + String(text || "").replace(/\n/g, "\n> "), ""].join("\n");
    composer.focus();
    try {
      document.execCommand("insertText", false, quoted);
    } catch {
      composer.textContent = (composer.textContent || "") + quoted;
    }
  }

  function normalizeText(input) {
    return String(input || "").trim().toLowerCase();
  }

  function normalizeDisplayText(input) {
    return String(input || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  }

  function setNodeTextIfSimple(node, nextText) {
    if (!(node instanceof Element)) return false;
    if (node.children && node.children.length > 0) return false;
    var before = normalizeDisplayText(node.textContent || "");
    if (!before || before === nextText) return false;
    node.textContent = nextText;
    return true;
  }

  function setNodeTextLoose(node, nextText) {
    if (!(node instanceof Element)) return false;
    if (node.querySelector("button, a, [role='button'], [role='menuitem']")) return false;
    var before = normalizeDisplayText(node.textContent || "");
    if (!before || before === nextText) return false;
    node.textContent = nextText;
    return true;
  }

  function replaceByPhrase(text) {
    var out = String(text || "");
    UI_REGEX_REPLACEMENTS.forEach(function (rule) {
      if (!rule || !rule.from || !rule.to) return;
      out = out.replace(rule.from, rule.to);
    });
    Object.keys(UI_PHRASE_MAP).forEach(function (from) {
      if (!from) return;
      var to = UI_PHRASE_MAP[from];
      if (!to) return;
      if (out.indexOf(from) >= 0) out = out.split(from).join(to);
    });
    return out;
  }

  function applyPhraseLocalizationToNode(node) {
    if (!(node instanceof Element)) return false;
    if (!node.offsetParent) return false;
    if (node.closest("#" + DRAWER_ID)) return false;
    var changed = false;
    var text = String(node.textContent || "");
    var replaced = replaceByPhrase(text);
    if (replaced !== text) {
      node.textContent = replaced;
      changed = true;
    }

    ["title", "aria-label", "placeholder"].forEach(function (attr) {
      var value = node.getAttribute(attr);
      if (!value) return;
      var next = replaceByPhrase(value);
      if (next !== value) {
        node.setAttribute(attr, next);
        changed = true;
      }
    });
    return changed;
  }

  function applyPhraseLocalizationToTextNodes(root) {
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var node = walker.nextNode();
    while (node) {
      var parent = node.parentElement;
      if (parent && !parent.closest("#" + DRAWER_ID)) {
        var raw = String(node.nodeValue || "");
        var trimmed = normalizeDisplayText(raw);
        if (trimmed) {
          var replaced = replaceByPhrase(raw);
          if (replaced !== raw) node.nodeValue = replaced;
        }
      }
      node = walker.nextNode();
    }
  }

  function shouldSuppressRecoveryPromptText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < RECOVERY_PROMPT_PATTERNS.length; i += 1) {
      var p = String(RECOVERY_PROMPT_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function shouldSuppressSessionVerificationPromptText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < SESSION_VERIFICATION_PROMPT_PATTERNS.length; i += 1) {
      var p = String(SESSION_VERIFICATION_PROMPT_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function shouldSuppressLogoutEncryptionWarningText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < LOGOUT_ENCRYPTION_WARNING_PATTERNS.length; i += 1) {
      var p = String(LOGOUT_ENCRYPTION_WARNING_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function findPromptContainer(node) {
    if (!(node instanceof Element)) return null;
    return (
      node.closest(".mx_Toast, .mx_Dialog, .mx_Modal, .mx_SetupEncryptionToast, .mx_GenericToast, [role='dialog'], [aria-modal='true']")
      || node.closest(".mx_LeftPanel")
      || node.closest(".mx_LeftPanel div")
      || node.closest("div")
      || null
    );
  }

  function looksLikeRecoveryPrompt(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!shouldSuppressRecoveryPromptText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function looksLikeSessionVerificationPrompt(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!shouldSuppressSessionVerificationPromptText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function suppressSessionVerificationCards(root) {
    if (DCF_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var containers = scope.querySelectorAll(
      ".mx_ContextualMenu, .mx_Popover, .mx_Toast, .mx_Dialog, .mx_Modal, " +
      ".mx_GenericToast, .mx_SetupEncryptionToast, [role='dialog'], [aria-modal='true'], [role='menu']"
    );
    for (var i = 0; i < containers.length; i += 1) {
      var container = containers[i];
      if (!(container instanceof Element)) continue;
      if (!looksLikeSessionVerificationPrompt(container)) continue;
      var clicked = clickFirst(container, [
        "稍后再说",
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "verify later",
        "later",
        "skip",
        "not now",
        "dismiss"
      ]);
      if (!clicked) {
        clicked = clickFirst(container, ["关闭", "close", "x"]);
      }
      if (!clicked) {
        container.style.setProperty("display", "none", "important");
      }
    }
  }

  function forceSuppressSessionVerification(root) {
    if (DCF_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var buttons = scope.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      if (!(btn instanceof Element)) continue;
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!(label === "验证" || label === "verify")) continue;
      var cursor = btn;
      var card = null;
      for (var depth = 0; depth < 14 && cursor; depth += 1) {
        var txt = normalizeDisplayText(cursor.textContent || "");
        if (shouldSuppressSessionVerificationPromptText(txt)) {
          card = cursor;
          break;
        }
        cursor = cursor.parentElement;
      }
      if (!card) continue;
      var clicked = clickFirst(card, [
        "稍后再说",
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "later",
        "skip",
        "dismiss"
      ]);
      if (!clicked) {
        card.style.setProperty("display", "none", "important");
      }
    }
  }

  function looksLikeLogoutEncryptionWarning(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!shouldSuppressLogoutEncryptionWarningText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function clickFirst(container, labels) {
    if (!(container instanceof Element)) return false;
    var buttons = container.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!label) continue;
      for (var j = 0; j < labels.length; j += 1) {
        if (label === labels[j]) {
          try { btn.click(); } catch {}
          return true;
        }
      }
    }
    return false;
  }

  function suppressRecoveryPrompts(root) {
    if (DCF_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var seedNodes = scope.querySelectorAll(
      ".mx_LeftPanel *, .mx_Toast *, .mx_Dialog *, .mx_Modal *, [role='dialog'] *, [aria-modal='true'] *"
    );
    for (var bi = 0; bi < seedNodes.length; bi += 1) {
      var seed = seedNodes[bi];
      if (!(seed instanceof Element)) continue;
      var wrap = findPromptContainer(seed);
      if (!looksLikeRecoveryPrompt(wrap)) continue;
      var cls = String((wrap && wrap.className) || "").toLowerCase();
      var inLeftPanel = Boolean(wrap.closest(".mx_LeftPanel"));
      var safeContainer = inLeftPanel || cls.indexOf("toast") >= 0 || cls.indexOf("dialog") >= 0 || cls.indexOf("modal") >= 0 || wrap.getAttribute("role") === "dialog";
      if (!safeContainer) continue;

      var clicked = clickFirst(wrap, ["忽略", "跳过", "稍后", "skip", "later", "not now", "dismiss"]);
      if (!clicked) {
        clicked = clickFirst(wrap, ["关闭", "close", "x"]);
      }
      if (!clicked) {
        // Fallback only for safe toast/dialog containers.
        wrap.style.setProperty("display", "none", "important");
      }
    }

    for (var si = 0; si < seedNodes.length; si += 1) {
      var sessionSeed = seedNodes[si];
      if (!(sessionSeed instanceof Element)) continue;
      var sessionWrap = findPromptContainer(sessionSeed);
      if (!looksLikeSessionVerificationPrompt(sessionWrap)) continue;
      var sessionCls = String((sessionWrap && sessionWrap.className) || "").toLowerCase();
      var sessionInLeftPanel = Boolean(sessionWrap.closest(".mx_LeftPanel"));
      var sessionSafeContainer = sessionInLeftPanel || sessionCls.indexOf("toast") >= 0 || sessionCls.indexOf("dialog") >= 0 || sessionCls.indexOf("modal") >= 0 || sessionWrap.getAttribute("role") === "dialog";
      if (!sessionSafeContainer) continue;

      var sessionClicked = clickFirst(sessionWrap, [
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "verify later",
        "later",
        "skip",
        "not now",
        "dismiss"
      ]);
      if (!sessionClicked) {
        sessionClicked = clickFirst(sessionWrap, ["关闭", "close", "x"]);
      }
      if (!sessionClicked) {
        sessionWrap.style.setProperty("display", "none", "important");
      }
    }

    for (var li = 0; li < seedNodes.length; li += 1) {
      var logoutSeed = seedNodes[li];
      if (!(logoutSeed instanceof Element)) continue;
      var logoutWrap = findPromptContainer(logoutSeed);
      if (!looksLikeLogoutEncryptionWarning(logoutWrap)) continue;
      var logoutCls = String((logoutWrap && logoutWrap.className) || "").toLowerCase();
      var logoutSafeContainer = logoutCls.indexOf("toast") >= 0 || logoutCls.indexOf("dialog") >= 0 || logoutCls.indexOf("modal") >= 0 || logoutWrap.getAttribute("role") === "dialog";
      if (!logoutSafeContainer) continue;

      var logoutClicked = clickFirst(logoutWrap, [
        "我不想要我的加密消息",
        "继续退出",
        "退出登录",
        "注销",
        "退出",
        "i don't want my encrypted messages",
        "sign out anyway",
        "sign out",
        "log out"
      ]);
      if (!logoutClicked) {
        logoutWrap.style.setProperty("display", "none", "important");
      }
    }

    var allButtons = scope.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var ai = 0; ai < allButtons.length; ai += 1) {
      var btn = allButtons[ai];
      if (!(btn instanceof Element)) continue;
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!(label === "忽略" || label === "稍后" || label === "跳过" || label === "skip" || label === "later" || label === "not now")) continue;
      var cursor = btn;
      var matched = false;
      for (var depth = 0; depth < 6 && cursor; depth += 1) {
        var txt = normalizeDisplayText(cursor.textContent || "").toLowerCase();
        if (shouldSuppressRecoveryPromptText(txt)) {
          matched = true;
          break;
        }
        cursor = cursor.parentElement;
      }
      if (!matched) continue;
      try { btn.click(); } catch {}
    }

    for (var vi = 0; vi < allButtons.length; vi += 1) {
      var verifyBtn = allButtons[vi];
      if (!(verifyBtn instanceof Element)) continue;
      var verifyLabel = normalizeDisplayText(verifyBtn.textContent || "").toLowerCase();
      if (
        !(verifyLabel === "后启用再说"
          || verifyLabel === "稍后"
          || verifyLabel === "跳过"
          || verifyLabel === "忽略"
          || verifyLabel === "verify later"
          || verifyLabel === "later"
          || verifyLabel === "skip"
          || verifyLabel === "not now")
      ) continue;
      var verifyCursor = verifyBtn;
      var verifyMatched = false;
      for (var vDepth = 0; vDepth < 6 && verifyCursor; vDepth += 1) {
        var verifyTxt = normalizeDisplayText(verifyCursor.textContent || "").toLowerCase();
        if (shouldSuppressSessionVerificationPromptText(verifyTxt)) {
          verifyMatched = true;
          break;
        }
        verifyCursor = verifyCursor.parentElement;
      }
      if (!verifyMatched) continue;
      try { verifyBtn.click(); } catch {}
    }

    for (var oi = 0; oi < allButtons.length; oi += 1) {
      var logoutBtn = allButtons[oi];
      if (!(logoutBtn instanceof Element)) continue;
      var logoutLabel = normalizeDisplayText(logoutBtn.textContent || "").toLowerCase();
      if (
        !(logoutLabel === "我不想要我的加密消息"
          || logoutLabel === "继续退出"
          || logoutLabel === "退出登录"
          || logoutLabel === "注销"
          || logoutLabel === "退出"
          || logoutLabel === "i don't want my encrypted messages"
          || logoutLabel === "sign out anyway"
          || logoutLabel === "sign out"
          || logoutLabel === "log out")
      ) continue;
      var logoutCursor = logoutBtn;
      var logoutMatched = false;
      for (var oDepth = 0; oDepth < 8 && logoutCursor; oDepth += 1) {
        var logoutTxt = normalizeDisplayText(logoutCursor.textContent || "").toLowerCase();
        if (shouldSuppressLogoutEncryptionWarningText(logoutTxt)) {
          logoutMatched = true;
          break;
        }
        logoutCursor = logoutCursor.parentElement;
      }
      if (!logoutMatched) continue;
      try { logoutBtn.click(); } catch {}
    }
  }

  function shouldTreatAsRoomPreviewPrompt(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    return (
      t.indexOf("不能被预览") >= 0
      || t.indexOf("你想加入吗") >= 0
      || t.indexOf("加入讨论") >= 0
      || t.indexOf("can't be previewed") >= 0
      || t.indexOf("would you like to join") >= 0
      || t.indexOf("join the discussion") >= 0
    );
  }

  function isFactoryBotPreview(scope) {
    var roomView = scope.querySelector(".mx_RoomView");
    var txt = normalizeDisplayText(roomView && roomView.textContent || "").toLowerCase();
    if (!txt) return false;
    var hasFactoryName = txt.indexOf("数字工厂bot") >= 0 || txt.indexOf("digital factory") >= 0;
    if (!hasFactoryName) return false;
    return shouldTreatAsRoomPreviewPrompt(txt);
  }

  function redirectFactoryPreviewToServiceRoom(root) {
    if (!isRoomView()) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    if (!isFactoryBotPreview(scope)) return;
    var guarded = String(sessionStorage.getItem(FACTORY_PREVIEW_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    var targetHash = toRoomAliasHash(FACTORY_ROOM_ALIAS);
    if (!targetHash) return;
    sessionStorage.setItem(FACTORY_PREVIEW_REDIRECT_GUARD, "1");
    window.location.hash = targetHash;
  }

  function redirectRoomPreviewToDefault(root) {
    var armed = String(sessionStorage.getItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG) || "") === "1";
    if (!armed) return;
    if (!isRoomView()) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var roomView = scope.querySelector(".mx_RoomView");
    if (!roomView) return;
    if (!shouldTreatAsRoomPreviewPrompt(roomView.textContent || "")) return;
    var guarded = String(sessionStorage.getItem(ROOM_PREVIEW_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    sessionStorage.setItem(ROOM_PREVIEW_REDIRECT_GUARD, "1");
    sessionStorage.removeItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG);
    window.location.hash = "#/home";
  }

  function loadRuntimeFlags() {
    return fetch("/config.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("config load failed");
        return res.json();
      })
      .then(function (cfg) {
        var dcf = cfg && typeof cfg === "object" ? cfg.dcf : null;
        if (dcf && typeof dcf === "object" && typeof dcf.e2ee_enabled === "boolean") {
          DCF_E2EE_ENABLED = dcf.e2ee_enabled;
        }
        if (dcf && typeof dcf === "object" && typeof dcf.factory_room_alias === "string" && dcf.factory_room_alias.trim()) {
          FACTORY_ROOM_ALIAS = dcf.factory_room_alias.trim();
        }
      })
      .catch(function () {});
  }

  function toRoomAliasHash(alias) {
    var raw = String(alias || "").trim();
    if (!raw) return "";
    return "#/room/" + encodeURIComponent(raw);
  }

  function redirectEncryptedFactoryDmToServiceRoom(root) {
    if (DCF_E2EE_ENABLED === true) return;
    if (!isRoomView()) return;
    var guarded = String(sessionStorage.getItem(ENCRYPTED_BOT_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var roomHeader = scope.querySelector(".mx_RoomHeader, .mx_RoomView_header, .mx_RoomHeader_wrapper");
    var roomNameText = normalizeDisplayText(roomHeader && roomHeader.textContent || "").toLowerCase();
    if (roomNameText.indexOf("数字工厂bot") < 0 && roomNameText.indexOf("digital factory") < 0) return;
    var roomView = scope.querySelector(".mx_RoomView");
    var bodyText = normalizeDisplayText(roomView && roomView.textContent || "").toLowerCase();
    var encrypted = bodyText.indexOf("已启动加密") >= 0 || bodyText.indexOf("end-to-end encrypted") >= 0;
    if (!encrypted) return;
    var targetHash = toRoomAliasHash(FACTORY_ROOM_ALIAS);
    if (!targetHash) return;
    sessionStorage.setItem(ENCRYPTED_BOT_REDIRECT_GUARD, "1");
    window.location.hash = targetHash;
  }

  function suppressEncryptionUiHints(root) {
    if (DCF_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var iconNodes = scope.querySelectorAll(
      ".mx_EventTile_e2eIcon, .mx_E2EIcon, [data-testid='e2e-icon'], " +
      "[title*='Encrypted by a device not verified by its owner'], [title*='not verified'], [title*='未验证'], " +
      "[aria-label*='Encrypted by a device not verified by its owner'], [aria-label*='not verified'], [aria-label*='未验证']"
    );
    for (var i = 0; i < iconNodes.length; i += 1) {
      var icon = iconNodes[i];
      if (!(icon instanceof Element)) continue;
      icon.style.setProperty("display", "none", "important");
    }

    var noticeNodes = scope.querySelectorAll(
      ".mx_RoomView .mx_EventTile, .mx_RoomView .mx_Notice, .mx_RoomView .mx_GenericEventListSummary, .mx_RoomView .mx_Toast"
    );
    for (var j = 0; j < noticeNodes.length; j += 1) {
      var node = noticeNodes[j];
      if (!(node instanceof Element)) continue;
      var text = normalizeDisplayText(node.textContent || "").toLowerCase();
      if (!text) continue;
      var isEncryptionHint = (
        text.indexOf("已启用加密") >= 0
        || text.indexOf("end-to-end encrypted") >= 0
        || text.indexOf("verify this device") >= 0
        || text.indexOf("验证此设备") >= 0
        || text.indexOf("session verification") >= 0
        || text.indexOf("会话验证") >= 0
      );
      if (!isEncryptionHint) continue;
      node.style.setProperty("display", "none", "important");
    }

    var composers = scope.querySelectorAll("textarea[placeholder], input[placeholder], [contenteditable='true'][aria-label]");
    for (var k = 0; k < composers.length; k += 1) {
      var composer = composers[k];
      if (!(composer instanceof Element)) continue;
      var ph = String(composer.getAttribute("placeholder") || composer.getAttribute("aria-label") || "");
      var low = normalizeDisplayText(ph).toLowerCase();
      if (!low) continue;
      if (low.indexOf("encrypted message") >= 0 || low.indexOf("加密消息") >= 0) {
        if (composer.hasAttribute("placeholder")) composer.setAttribute("placeholder", "发送消息......");
        if (composer.hasAttribute("aria-label")) composer.setAttribute("aria-label", "发送消息");
      }
    }
  }

  function applyUiTextLocalization(root) {
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var nodes = scope.querySelectorAll("button, a, [role='menuitem'], [role='button'], .mx_AccessibleButton, .mx_StyledButton");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!(node instanceof Element)) continue;
      if (!node.offsetParent) continue;
      if (node.closest("#" + DRAWER_ID)) continue;
      var current = normalizeDisplayText(node.textContent || "");
      if (!current) continue;
      var mapped = UI_TEXT_MAP[current] || UI_TEXT_MAP[current.toLowerCase()];
      if (!mapped) continue;
      setNodeTextIfSimple(node, mapped);
      applyPhraseLocalizationToNode(node);
    }

    var passiveNodes = scope.querySelectorAll(
      ".mx_LeftPanel p, .mx_LeftPanel span, .mx_LeftPanel div, .mx_LeftPanel a, " +
      ".mx_HomePage p, .mx_HomePage span, .mx_HomePage div, .mx_HomePage a, .mx_HomePage h1, .mx_HomePage h2, .mx_HomePage h3, " +
      ".mx_Dialog p, .mx_Dialog span, .mx_Dialog div, .mx_Dialog h1, .mx_Dialog h2, .mx_Dialog h3, .mx_Dialog h4, " +
      ".mx_Modal p, .mx_Modal span, .mx_Modal div, .mx_Modal h1, .mx_Modal h2, .mx_Modal h3, .mx_Modal h4, " +
      ".mx_Toast p, .mx_Toast span, .mx_Toast div, " +
      ".mx_RoomView p, .mx_RoomView span"
    );
    for (var j = 0; j < passiveNodes.length; j += 1) {
      var el = passiveNodes[j];
      if (!(el instanceof Element)) continue;
      if (!el.offsetParent) continue;
      var text = normalizeDisplayText(el.textContent || "");
      if (!text) continue;
      var tMapped = UI_TEXT_MAP[text] || UI_TEXT_MAP[text.toLowerCase()];
      if (tMapped) {
        if (!setNodeTextIfSimple(el, tMapped)) {
          setNodeTextLoose(el, tMapped);
        }
      }
      applyPhraseLocalizationToNode(el);
    }

    var attrsNodes = scope.querySelectorAll("[title], [aria-label], input[placeholder], textarea[placeholder]");
    for (var k = 0; k < attrsNodes.length; k += 1) {
      applyPhraseLocalizationToNode(attrsNodes[k]);
    }
    applyPhraseLocalizationToTextNodes(scope);
    suppressRecoveryPrompts(scope);
    suppressSessionVerificationCards(scope);
    forceSuppressSessionVerification(scope);
    suppressEncryptionUiHints(scope);
    redirectRoomPreviewToDefault(scope);
    redirectFactoryPreviewToServiceRoom(scope);
    redirectEncryptedFactoryDmToServiceRoom(scope);
  }

  function getMatrixUserId() {
    return String(localStorage.getItem("mx_user_id") || "").trim();
  }

  function hasNotificationLabel(text) {
    var t = normalizeText(text);
    return t === "通知" || t === "notifications";
  }

  function openAdminInNewTab() {
    var url = String(adminEntryState.adminUrl || "/admin/index.html");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function findNotificationAnchor() {
    var nodes = document.querySelectorAll("button, a, [role='menuitem']");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!(node instanceof Element)) continue;
      if (node.closest("#" + DRAWER_ID)) continue;
      if (!node.offsetParent) continue;
      if (!hasNotificationLabel(node.textContent || "")) continue;
      return node;
    }
    return null;
  }

  function ensureAdminEntryItem() {
    var old = document.querySelectorAll("." + ADMIN_ENTRY_ITEM_CLASS);
    if (!adminEntryState.visible) {
      old.forEach(function (n) { n.remove(); });
      return;
    }
    if (old.length > 1) {
      for (var i = 1; i < old.length; i += 1) old[i].remove();
    }
    if (old.length === 1) return;
    var anchor = findNotificationAnchor();
    if (!anchor || !anchor.parentElement) return;
    var item;
    if (anchor.tagName === "A") {
      item = document.createElement("a");
      item.href = String(adminEntryState.adminUrl || "/admin/index.html");
      item.target = "_blank";
      item.rel = "noopener noreferrer";
    } else {
      item = document.createElement("button");
      item.type = "button";
      item.addEventListener("click", function (event) {
        event.preventDefault();
        openAdminInNewTab();
      });
    }
    item.className = String(anchor.className || "").trim() + " " + ADMIN_ENTRY_ITEM_CLASS;
    item.setAttribute("role", anchor.getAttribute("role") || "menuitem");
    item.textContent = "管理后台";
    anchor.parentElement.insertBefore(item, anchor);
  }

  function fetchAdminEntryCapability() {
    if (adminEntryState.checked) return Promise.resolve();
    adminEntryState.checked = true;
    var matrixUserId = getMatrixUserId();
    if (!matrixUserId) {
      adminEntryState.visible = false;
      return Promise.resolve();
    }
    var query = "/api/auth/matrix-admin-entry?matrixUserId=" + encodeURIComponent(matrixUserId);
    return fetch(query, { credentials: "include", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("admin entry capability request failed");
        return r.json();
      })
      .then(function (data) {
        adminEntryState.visible = Boolean(data && data.showAdminEntry);
        adminEntryState.adminUrl = String((data && data.adminUrl) || "/admin/index.html");
      })
      .catch(function () {
        adminEntryState.visible = false;
      });
  }

  function watchAdminEntryMenu() {
    fetchAdminEntryCapability().then(function () {
      ensureAdminEntryItem();
      applyUiTextLocalization(document);
      var observer = new MutationObserver(function () {
        ensureAdminEntryItem();
        applyUiTextLocalization(document);
        suppressRecoveryPrompts(document);
        redirectRoomPreviewToDefault(document);
        redirectFactoryPreviewToServiceRoom(document);
        redirectEncryptedFactoryDmToServiceRoom(document);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(function () {
        ensureAdminEntryItem();
        applyUiTextLocalization(document);
        suppressRecoveryPrompts(document);
        redirectRoomPreviewToDefault(document);
        redirectFactoryPreviewToServiceRoom(document);
        redirectEncryptedFactoryDmToServiceRoom(document);
      }, 500);
    });
  }

  function bindGlobalEvents() {
    document.addEventListener("click", function (event) {
      if (!isRoomView()) return;
      var target = event.target;
      if (!(target instanceof Element)) return;

      var leaveBtn = target.closest("button, .mx_AccessibleButton, [role='button']");
      if (leaveBtn) {
        var leaveLabel = normalizeDisplayText(leaveBtn.textContent || "").toLowerCase();
        if (
          leaveLabel.indexOf("离开房间") >= 0
          || leaveLabel === "离开"
          || leaveLabel.indexOf("leave room") >= 0
          || leaveLabel === "leave"
        ) {
          sessionStorage.setItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG, "1");
        }
      }

      // Intercept voice/video call buttons to provide feedback when call infra unavailable
      var callBtn = target.closest("[aria-label='Voice call'], [aria-label='Video call'], [aria-label='语音通话'], [aria-label='视频通话'], [aria-label='Start voice call'], [aria-label='Start video call'], [aria-label='发起语音通话'], [aria-label='发起视频通话']");
      if (callBtn) {
        // Let Element Web handle the click natively; if call infra is configured it will work.
        // We just ensure the button's aria-label is localized.
        var callLabel = String(callBtn.getAttribute("aria-label") || "");
        if (UI_TEXT_MAP[callLabel]) {
          callBtn.setAttribute("aria-label", UI_TEXT_MAP[callLabel]);
          callBtn.setAttribute("title", UI_TEXT_MAP[callLabel]);
        }
        // Don't block the event — let Element Web try the call
      }

      if (target.closest("#" + MASK_ID) || target.closest("#" + DRAWER_ID + " .dcf-close")) {
        closeDrawer();
        return;
      }

      var actionBtn = target.closest("#" + DRAWER_ID + " [data-a]");
      if (actionBtn) {
        var drawer = document.getElementById(DRAWER_ID);
        if (!drawer) return;
        var action = String(actionBtn.getAttribute("data-a") || "");
        var message = String(drawer.dataset.message || "");
        if (action === "copy" && message) {
          navigator.clipboard && navigator.clipboard.writeText(message).catch(function () {});
        }
        if (action === "quote" && message) {
          insertQuoteToComposer(message);
        }
        return;
      }

      var tile = target.closest(".mx_EventTile");
      if (!tile) return;
      if (target.closest("a, button, input, textarea, .mx_ReactionsRow")) return;
      var data = extractMessage(tile);
      if (!data.body) return;
      openDrawer(data);
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDrawer();
    });
  }

  ready(function () {
    loadRuntimeFlags().finally(function () {
      clearCryptoClientStorageIfDisabled();
      var languageChanged = ensurePreferredLanguage();
      tryReloadForLanguageApply(languageChanged);
      redirectToUnifiedLoginIfNeeded();
      if (!isRoomView()) sessionStorage.removeItem(ROOM_PREVIEW_REDIRECT_GUARD);
      window.addEventListener("hashchange", redirectToUnifiedLoginIfNeeded);
      window.addEventListener("hashchange", function () {
        if (!isRoomView()) {
          sessionStorage.removeItem(ROOM_PREVIEW_REDIRECT_GUARD);
          sessionStorage.removeItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG);
          sessionStorage.removeItem(ENCRYPTED_BOT_REDIRECT_GUARD);
          sessionStorage.removeItem(FACTORY_PREVIEW_REDIRECT_GUARD);
        }
      });
      ensureStyle();
      ensureNodes();
      bindGlobalEvents();
      applyUiTextLocalization(document);
      suppressRecoveryPrompts(document);
      redirectRoomPreviewToDefault(document);
      redirectFactoryPreviewToServiceRoom(document);
      redirectEncryptedFactoryDmToServiceRoom(document);
      watchAdminEntryMenu();
    });
  });
})();
