/**
 * Register all dock routes — called once at app init
 */
import { registerDockRoute } from './dockRegistry';

// Chat
import { ChatPane } from '../features/chat/ChatPane';
import { MessagesSidebar } from '../features/chat/RoomList';

// Apps
import { AppsGrid } from '../features/apps/AppsGrid';

// Contacts
import { ContactsSidebar, ContactsPage } from '../features/contacts/ContactsPage';

// Knowledge
import { KnowledgeSidebar, KnowledgePage } from '../features/knowledge/KnowledgePage';

// Tasks
import { TodoSidebar, TodoPage } from '../features/todo/TodoPage';

// Notifications
import { NotificationsSidebar, NotificationsPage } from '../features/notifications/NotificationsPage';

// Calendar
import { CalendarSidebar, CalendarPage } from '../features/calendar/CalendarPage';

// Subscription (Feed)
import { FeedSidebar, FeedPage } from '../features/subscription/FeedPage';

// Agents
import { AgentsHub, AgentsSidebar } from '../features/agents/AgentsHub';

// Skills
import { SkillsCenter, SkillsSidebar } from '../features/skills/SkillsCenter';

// Settings
import { SettingsSidebar, SettingsPage } from '../features/settings/SettingsPage';

// OpenClaw
import { OpenClawPage } from '../features/openclaw/OpenClawPage';

export function registerAllRoutes() {
  // Top navigation (matches Dock TOP_ITEMS order)
  registerDockRoute({ key: 'messages', icon: 'chat_bubble', label: '消息', Sidebar: MessagesSidebar, Main: ChatPane, position: 'top' });
  registerDockRoute({ key: 'apps', icon: 'grid_view', label: '轻应用', Sidebar: null, Main: AppsGrid, position: 'top' });
  registerDockRoute({ key: 'contacts', icon: 'people', label: '通讯录', Sidebar: ContactsSidebar, Main: ContactsPage, position: 'top' });
  registerDockRoute({ key: 'knowledge', icon: 'menu_book', label: '知识库', Sidebar: KnowledgeSidebar, Main: KnowledgePage, position: 'top' });
  registerDockRoute({ key: 'tasks', icon: 'task_alt', label: '待办', Sidebar: TodoSidebar, Main: TodoPage, position: 'top' });
  registerDockRoute({ key: 'notifications', icon: 'notifications', label: '通知', Sidebar: NotificationsSidebar, Main: NotificationsPage, position: 'top' });
  registerDockRoute({ key: 'calendar', icon: 'calendar_month', label: '日历', Sidebar: CalendarSidebar, Main: CalendarPage, position: 'top' });
  registerDockRoute({ key: 'subscription', icon: 'dynamic_feed', label: '动态', Sidebar: FeedSidebar, Main: FeedPage, position: 'top' });

  // Bottom navigation
  registerDockRoute({ key: 'agents', icon: 'smart_toy', label: 'Agent', Sidebar: AgentsSidebar, Main: AgentsHub, position: 'bottom' });
  registerDockRoute({ key: 'settings', icon: 'settings', label: '设置', Sidebar: SettingsSidebar, Main: SettingsPage, position: 'bottom' });

  // OpenClaw
  registerDockRoute({ key: 'openclaw', icon: 'terminal', label: 'OpenClaw', Sidebar: null, Main: OpenClawPage, position: 'top' });

  // Hidden routes (accessible via code but not in Dock)
  registerDockRoute({ key: 'skills', icon: 'bolt', label: '技能', Sidebar: SkillsSidebar, Main: SkillsCenter, position: 'top' });
}
