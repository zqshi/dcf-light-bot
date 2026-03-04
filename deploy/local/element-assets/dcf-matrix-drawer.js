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
  var LANGUAGE_RELOAD_FLAG = "dcf_lang_reloaded_once";
  var UI_TEXT_MAP = {
    "Notifications": "通知",
    "Notification": "通知",
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
    "Jump to date": "跳转日期",
    "Mark as read": "标记已读",
    "Mark as unread": "标记未读",
    "Invite": "邀请"
  };

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
    var alreadyReloaded = String(sessionStorage.getItem(LANGUAGE_RELOAD_FLAG) || "") === "1";
    if (alreadyReloaded) return;
    sessionStorage.setItem(LANGUAGE_RELOAD_FLAG, "1");
    window.location.reload();
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
    return String(input || "").replace(/\s+/g, " ").trim();
  }

  function setNodeTextIfSimple(node, nextText) {
    if (!(node instanceof Element)) return false;
    if (node.children && node.children.length > 0) return false;
    var before = normalizeDisplayText(node.textContent || "");
    if (!before || before === nextText) return false;
    node.textContent = nextText;
    return true;
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
      var mapped = UI_TEXT_MAP[current];
      if (!mapped) continue;
      setNodeTextIfSimple(node, mapped);
    }
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
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(function () {
        ensureAdminEntryItem();
        applyUiTextLocalization(document);
      }, 1200);
    });
  }

  function bindGlobalEvents() {
    document.addEventListener("click", function (event) {
      if (!isRoomView()) return;
      var target = event.target;
      if (!(target instanceof Element)) return;

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
    var languageChanged = ensurePreferredLanguage();
    tryReloadForLanguageApply(languageChanged);
    redirectToUnifiedLoginIfNeeded();
    window.addEventListener("hashchange", redirectToUnifiedLoginIfNeeded);
    ensureStyle();
    ensureNodes();
    bindGlobalEvents();
    applyUiTextLocalization(document);
    watchAdminEntryMenu();
  });
})();
