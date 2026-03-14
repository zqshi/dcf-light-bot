/**
 * Workspace — 主工作台页面渲染（完整 HTML 结构）
 */
import { getState } from '../lib/store.js';

export function renderWorkspace(container) {
  const { user } = getState();
  const initials = (user?.displayName || 'U').slice(0, 1).toUpperCase();

  container.innerHTML = `
    <!-- ═══ Layout Container — stitch 全屏四栏 ═══ -->
    <div class="layout-container">

      <!-- ── Dock — stitch 玻璃导航栏 ── -->
      <nav class="dock-nav">
        <div class="dock-logo">
          <span class="material-symbols-outlined">hub</span>
        </div>
        <div class="dock-items">
          <div class="dock-item">
            <button class="dock-btn dock-active" data-dock-tab="messages" title="消息">
              <span class="material-symbols-outlined">chat_bubble</span>
              <span class="unread-badge hidden" id="dock-unread-messages">0</span>
            </button>
            <div class="dock-submenu">
              <button class="dock-submenu-item" data-subtab="conversations"><span class="material-symbols-outlined">forum</span>会话列表</button>
              <button class="dock-submenu-item" data-subtab="factory-create"><span class="material-symbols-outlined">smart_toy</span>数字工厂</button>
            </div>
          </div>
          <div class="dock-item">
            <button class="dock-btn" data-dock-tab="agents" title="共享Agent">
              <span class="material-symbols-outlined">group</span>
            </button>
          </div>
          <div class="dock-item">
            <button class="dock-btn" data-dock-tab="apps" title="轻应用">
              <span class="material-symbols-outlined">grid_view</span>
            </button>
          </div>
          <div class="dock-item">
            <button class="dock-btn" data-dock-tab="skills" title="技能中心">
              <span class="material-symbols-outlined">extension</span>
            </button>
          </div>
          <div class="dock-item">
            <button class="dock-btn" data-dock-tab="factory" title="数字工厂">
              <span class="material-symbols-outlined">precision_manufacturing</span>
            </button>
          </div>
        </div>
        <div class="dock-separator"></div>
        <div class="dock-bottom">
          <div class="dock-item">
            <button class="dock-btn" data-dock-tab="settings" title="设置">
              <span class="material-symbols-outlined">settings</span>
            </button>
          </div>
          <div class="dock-avatar" id="dock-user-avatar" title="${user?.displayName || '用户'}">
            <span class="dock-avatar-initial">${initials}</span>
          </div>
        </div>
      </nav>

      <!-- ── Left Sidebar ── -->
      <aside class="left-sidebar">
        <!-- == Conversations Panel == -->
        <div class="sidebar-panel" id="conversations-panel">
          <div class="sidebar-header">
            <div class="sidebar-title-row">
              <h1 class="sidebar-title">消息</h1>
              <button class="sidebar-title-action" title="新建消息"><span class="material-symbols-outlined">edit_square</span></button>
            </div>
            <div class="sidebar-search">
              <span class="material-symbols-outlined">search</span>
              <input type="text" id="conv-search" placeholder="搜索会话或用户..." />
            </div>
            <div class="sidebar-tabs">
              <button class="sidebar-tab tab-active" data-tab="conversations" data-filter="all">全部</button>
              <button class="sidebar-tab" data-tab="conversations" data-filter="dm">私聊</button>
              <button class="sidebar-tab" data-tab="conversations" data-filter="bot">数字员工</button>
              <button class="sidebar-tab" data-tab="conversations" data-filter="group">群组</button>
            </div>
          </div>
          <div class="sidebar-list" id="conv-list"></div>
        </div>

        <!-- == Shared Agents List Panel == -->
        <div class="sidebar-panel hidden" id="agents-list-panel">
          <div class="sidebar-header">
            <div class="sidebar-search">
              <span class="material-symbols-outlined">search</span>
              <input type="text" id="agent-search" placeholder="搜索共享 Agent..." />
            </div>
          </div>
          <div class="sidebar-list" id="agents-sidebar-list"></div>
        </div>

        <!-- == Apps List Panel == -->
        <div class="sidebar-panel hidden" id="apps-list-panel">
          <div class="sidebar-header" style="border-bottom:none;">
            <div style="font-size:14px;font-weight:600;color:var(--text-heading)">轻应用中心</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">自定义你的工作面板</div>
          </div>
          <div class="lite-apps-grid" id="apps-grid"></div>
        </div>

        <!-- == Skills Center Panel == -->
        <div class="sidebar-panel hidden" id="skills-list-panel">
          <div class="sidebar-header">
            <div class="sidebar-search">
              <span class="material-symbols-outlined">search</span>
              <input type="text" id="skills-search" placeholder="搜索技能..." />
            </div>
            <div class="sidebar-tabs">
              <button class="sidebar-tab tab-active" data-tab="skills-list" data-filter="all">全部</button>
              <button class="sidebar-tab" data-tab="skills-list" data-filter="general">通用</button>
              <button class="sidebar-tab" data-tab="skills-list" data-filter="domain">领域</button>
            </div>
          </div>
          <div class="sidebar-list" id="skills-sidebar-list"></div>
        </div>

        <!-- == Factory List Panel == -->
        <div class="sidebar-panel hidden" id="factory-list-panel">
          <div class="sidebar-header">
            <div style="font-size:14px;font-weight:600;color:var(--text-heading)">数字员工工厂</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">创建和管理你的数字员工</div>
          </div>
          <div class="sidebar-list" id="factory-agent-list"></div>
        </div>

        <!-- == Settings Panel == -->
        <div class="sidebar-panel hidden" id="settings-panel">
          <div class="settings-section">
            <div class="settings-section-title">账号</div>
            <div class="settings-item" id="settings-profile"><span class="material-symbols-outlined">person</span><span class="settings-item-label">个人资料</span></div>
            <div class="settings-item" id="settings-notification"><span class="material-symbols-outlined">notifications</span><span class="settings-item-label">通知设置</span></div>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">平台</div>
            <div class="settings-item" id="settings-theme"><span class="material-symbols-outlined">palette</span><span class="settings-item-label">主题外观</span></div>
            <div class="settings-item" id="settings-language"><span class="material-symbols-outlined">language</span><span class="settings-item-label">语言</span></div>
            <div class="settings-item" id="settings-server"><span class="material-symbols-outlined">dns</span><span class="settings-item-label">服务器设置</span></div>
          </div>
          <div class="settings-section">
            <div class="settings-item" id="settings-logout" style="color:var(--error-color)"><span class="material-symbols-outlined">logout</span><span class="settings-item-label">退出登录</span></div>
          </div>
        </div>
      </aside>

      <!-- ── Main Content ── -->
      <main class="main-content">
        <!-- Workspace: Messages / Chat -->
        <div class="workspace-panel" id="workspace-messages">
          <!-- Welcome state (shown when no room selected) -->
          <div class="empty-state" id="chat-welcome">
            <div class="empty-state-icon"><span class="material-symbols-outlined">forum</span></div>
            <div class="empty-state-title">欢迎使用 DCF 协作平台</div>
            <div class="empty-state-desc">选择一个会话开始沟通，或创建新的数字员工</div>
            <div class="welcome-cards">
              <div class="welcome-card" data-action="create-agent">
                <span class="material-symbols-outlined">smart_toy</span>
                <div class="welcome-card-title">创建数字员工</div>
                <div class="welcome-card-desc">通过数字工厂 Bot 创建专属 AI 助手</div>
              </div>
              <div class="welcome-card" data-action="find-bot">
                <span class="material-symbols-outlined">search</span>
                <div class="welcome-card-title">搜索数字工厂</div>
                <div class="welcome-card-desc">查找"数字工厂"Bot 开始创建流程</div>
              </div>
              <div class="welcome-card" data-action="shared-agents">
                <span class="material-symbols-outlined">group</span>
                <div class="welcome-card-title">共享 Agent 大厅</div>
                <div class="welcome-card-desc">浏览和调用团队共享的 Agent</div>
              </div>
            </div>
          </div>

          <!-- Chat view (shown when a room is selected) -->
          <div class="hidden" id="chat-view" style="display:none;flex-direction:column;height:100%">
            <div class="chat-header">
              <div class="chat-header-avatar" id="chat-room-avatar"><span class="material-symbols-outlined">groups</span></div>
              <div class="chat-header-info">
                <div class="chat-header-name" id="chat-room-name">数字工厂</div>
                <div class="chat-header-status" id="chat-room-status">在线</div>
              </div>
              <div class="chat-header-actions">
                <button class="chat-action-btn" title="语音通话" id="btn-voice"><span class="material-symbols-outlined">call</span></button>
                <button class="chat-action-btn" title="视频通话" id="btn-video"><span class="material-symbols-outlined">video_call</span></button>
                <button class="chat-action-btn" title="查看文档" id="btn-drawer-doc"><span class="material-symbols-outlined">description</span></button>
                <button class="chat-action-btn" title="查看代码" id="btn-drawer-code"><span class="material-symbols-outlined">code</span></button>
                <button class="chat-action-btn" title="预览原型" id="btn-drawer-preview"><span class="material-symbols-outlined">visibility</span></button>
                <button class="chat-action-btn" title="更多" id="btn-more"><span class="material-symbols-outlined">more_vert</span></button>
              </div>
            </div>
            <div class="chat-messages" id="chat-messages"></div>
            <div class="typing-indicator hidden" id="typing-indicator">
              <div class="typing-dots"><span></span><span></span><span></span></div>
              <span class="typing-text" id="typing-text">正在输入...</span>
            </div>
            <footer class="chat-input-footer">
              <div class="mention-popup" id="mention-popup"></div>
              <div class="chat-input-row">
                <button class="input-icon-btn" title="添加" id="btn-file"><span class="material-symbols-outlined">add_circle</span></button>
                <textarea id="chat-input" rows="1" placeholder="发送消息..."></textarea>
                <button class="input-icon-btn" title="表情" id="btn-emoji"><span class="material-symbols-outlined">sentiment_satisfied</span></button>
                <button class="chat-send-btn" id="chat-send" title="发送"><span class="material-symbols-outlined">send</span></button>
              </div>
              <input type="file" id="file-input" class="hidden" />
              <input type="file" id="image-input" accept="image/*" class="hidden" />
            </footer>
          </div>
        </div>

        <!-- Workspace: Shared Agents Hall -->
        <div class="workspace-panel hidden" id="workspace-agents">
          <div class="workspace-panel-header">
            <h2>共享 Agent 大厅</h2>
            <p>浏览和使用团队共享的数字员工 Agent，按需调用避免重复创建</p>
          </div>
          <div class="agents-grid" id="agents-hall-grid"></div>
        </div>

        <!-- Workspace: Lite Apps -->
        <div class="workspace-panel hidden" id="workspace-apps">
          <div class="workspace-panel-header">
            <h2>轻应用面板</h2>
            <p>自定义 Dock 轻应用，快速访问常用工具</p>
          </div>
          <div id="apps-workspace-content" style="padding:20px">
            <div class="lite-apps-grid" id="apps-workspace-grid"></div>
          </div>
        </div>

        <!-- Workspace: Skills Center -->
        <div class="workspace-panel hidden" id="workspace-skills">
          <div class="workspace-panel-header">
            <h2>Skills 技能中心</h2>
            <p>管理数字员工的技能库，支持共享和按岗位关联</p>
          </div>
          <div class="agents-grid" id="skills-hall-grid"></div>
        </div>

        <!-- Workspace: Digital Factory -->
        <div class="workspace-panel hidden" id="workspace-factory">
          <div id="factory-workspace-content"></div>
        </div>

        <!-- Workspace: Settings -->
        <div class="workspace-panel hidden" id="workspace-settings">
          <div style="padding:32px 40px;max-width:560px;margin:0 auto">
            <h2 style="font-size:18px;font-weight:700;color:var(--text-heading);margin-bottom:20px">设置</h2>
            <div id="settings-content">
              <div style="padding:18px;background:rgba(255,255,255,0.85);border:0.5px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:14px">
                <div style="font-size:13px;font-weight:600;color:var(--text-heading);margin-bottom:14px">个人信息</div>
                <div style="display:flex;align-items:center;gap:14px">
                  <div class="header-avatar" style="width:48px;height:48px;font-size:18px">${initials}</div>
                  <div>
                    <div style="font-size:14px;font-weight:600;color:var(--text-heading)">${user?.displayName || '用户'}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${user?.userId || ''}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${user?.org || ''} · ${user?.department || ''}</div>
                  </div>
                </div>
              </div>
              <div style="padding:18px;background:rgba(255,255,255,0.85);border:0.5px solid var(--border-color);border-radius:var(--radius-md)">
                <div style="font-size:13px;font-weight:600;color:var(--text-heading);margin-bottom:10px">服务器信息</div>
                <div style="font-size:13px;color:var(--text-secondary)" id="server-info"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- ── Right Drawer ── -->
      <aside class="right-drawer" id="right-drawer">
        <div class="drawer-resizer" id="right-drawer-resizer"></div>
        <div class="drawer-header">
          <div class="drawer-header-left">
            <button class="drawer-collapse-btn"><span class="material-symbols-outlined">chevron_right</span></button>
            <span class="material-symbols-outlined drawer-header-icon" id="drawer-icon">description</span>
            <h2 class="drawer-header-title" id="drawer-title">协作面板</h2>
            <span class="drawer-header-badge" id="drawer-badge">草稿</span>
          </div>
          <div class="drawer-header-right">
            <div class="drawer-collaborators" id="drawer-collaborators">
              <div class="drawer-collab-avatar">
                <span class="material-symbols-outlined">person</span>
              </div>
              <div class="drawer-collab-avatar">
                <span class="material-symbols-outlined">person</span>
              </div>
              <div class="drawer-collab-count">+3</div>
            </div>
            <button class="drawer-share-btn" id="drawer-share">
              <span class="material-symbols-outlined">share</span>
              <span>分享</span>
            </button>
            <button class="drawer-close-btn"><span class="material-symbols-outlined">more_vert</span></button>
          </div>
        </div>
        <div class="drawer-tabs">
          <button class="drawer-tab active" data-drawer-panel="panel-doc"><span class="material-symbols-outlined">description</span>文档</button>
          <button class="drawer-tab" data-drawer-panel="panel-code"><span class="material-symbols-outlined">code</span>代码</button>
          <button class="drawer-tab" data-drawer-panel="panel-preview"><span class="material-symbols-outlined">visibility</span>预览</button>
        </div>
        <div class="drawer-body">
          <!-- Document Panel -->
          <div class="drawer-panel active" id="panel-doc">
            <div class="doc-panel">
              <div class="doc-panel-toolbar">
                <button class="doc-tool-btn" data-cmd="bold" title="加粗"><span class="material-symbols-outlined">format_bold</span></button>
                <button class="doc-tool-btn" data-cmd="italic" title="斜体"><span class="material-symbols-outlined">format_italic</span></button>
                <button class="doc-tool-btn" data-cmd="underline" title="下划线"><span class="material-symbols-outlined">format_underlined</span></button>
                <button class="doc-tool-btn" data-cmd="insertUnorderedList" title="列表"><span class="material-symbols-outlined">format_list_bulleted</span></button>
                <button class="doc-tool-btn" data-cmd="insertOrderedList" title="编号"><span class="material-symbols-outlined">format_list_numbered</span></button>
                <button class="doc-tool-btn" data-cmd="formatBlock" title="标题"><span class="material-symbols-outlined">title</span></button>
              </div>
              <div class="doc-editor-wrapper">
                <div class="doc-editor" id="doc-editor" contenteditable="true">
                  <h1>文档预览区域</h1>
                  <p>点击对话中的文档附件，或由数字员工发送的文档将在此展示。</p>
                  <p>支持直接编辑，修改内容会通过对话同步给数字员工。</p>
                </div>
              </div>
            </div>
            <div class="drawer-interact-bar">
              <input type="text" placeholder="用自然语言描述对文档的修改..." id="doc-nl-input" />
              <button id="doc-nl-submit"><span class="material-symbols-outlined">auto_awesome</span></button>
            </div>
          </div>

          <!-- Code Panel -->
          <div class="drawer-panel" id="panel-code">
            <div class="code-panel">
              <div class="code-panel-header">
                <span class="material-symbols-outlined">code</span>
                <span class="file-name" id="code-file-name">main.py</span>
                <span class="lang-badge" id="code-lang-badge">Python</span>
              </div>
              <div class="code-viewer" id="code-viewer"><pre><span class="line-number">1</span># 数字员工发送的代码将在此展示
<span class="line-number">2</span># 支持语法高亮和行号显示
<span class="line-number">3</span>
<span class="line-number">4</span>def hello():
<span class="line-number">5</span>    print("Hello from Digital Employee!")
</pre></div>
            </div>
            <div class="drawer-interact-bar">
              <input type="text" placeholder="用自然语言描述代码修改..." id="code-nl-input" />
              <button id="code-nl-submit"><span class="material-symbols-outlined">auto_awesome</span></button>
            </div>
          </div>

          <!-- Preview Panel -->
          <div class="drawer-panel" id="panel-preview">
            <div class="preview-panel" style="height:100%;display:flex;flex-direction:column">
              <div class="preview-toolbar">
                <button class="input-tool-btn" title="刷新" id="preview-refresh"><span class="material-symbols-outlined">refresh</span></button>
                <input type="text" class="preview-url" id="preview-url-input" placeholder="preview://local" readonly />
                <button class="input-tool-btn" title="元素选择" id="preview-select-el"><span class="material-symbols-outlined">gps_fixed</span></button>
              </div>
              <div style="flex:1;position:relative">
                <iframe class="preview-frame" id="preview-frame" style="width:100%;height:100%;border:none"
                  srcdoc="<div style='display:flex;align-items:center;justify-content:center;height:100%;color:#AEAEB2;font-family:Inter,sans-serif;font-size:14px'><div style='text-align:center'><div style='font-size:40px;margin-bottom:12px'>🖼️</div><div>原型预览区域</div><div style='font-size:12px;margin-top:4px'>数字员工生成的原型将在此渲染</div></div></div>">
                </iframe>
                <div class="preview-overlay" id="preview-overlay"></div>
              </div>
              <div class="preview-nl-input">
                <input type="text" placeholder="选择元素后，用自然语言描述修改..." id="preview-nl-input" />
                <button id="preview-nl-submit">应用修改</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

    </div>

    <!-- Toast container -->
    <div class="toast-container" id="toast-container"></div>

    <!-- User menu dropdown — stitch popover (anchored to dock avatar) -->
    <div class="hidden" id="user-menu" style="position:fixed;z-index:999;background:rgba(255,255,255,0.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:0.5px solid rgba(0,0,0,0.08);border-radius:12px;box-shadow:0 10px 40px -10px rgba(0,0,0,0.12);padding:6px;min-width:180px">
      <div class="dock-submenu-item" id="menu-profile"><span class="material-symbols-outlined">person</span>个人资料</div>
      <div class="dock-submenu-item" id="menu-settings"><span class="material-symbols-outlined">settings</span>设置</div>
      <div style="height:1px;background:var(--border-color);margin:4px 0"></div>
      <div class="dock-submenu-item" id="menu-logout" style="color:var(--error-color)"><span class="material-symbols-outlined">logout</span>退出登录</div>
    </div>
  `;
}
