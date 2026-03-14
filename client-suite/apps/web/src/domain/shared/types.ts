export type RoomId = string;
export type UserId = string;
export type EventId = string;

export type RoomType = 'dm' | 'bot' | 'group' | 'subscription';

export type DockTab =
  | 'messages'
  | 'apps'
  | 'tasks'
  | 'notifications'
  | 'knowledge'
  | 'agents'
  | 'skills'
  | 'factory'
  | 'contacts'
  | 'calendar'
  | 'subscription'
  | 'openclaw'
  | 'settings';

export type AppMode = 'im' | 'openclaw';

export type DrawerContentType =
  | 'doc' | 'code' | 'preview' | 'markdown'
  | 'spreadsheet' | 'location' | 'subscription'
  | 'sheet' | 'slide';

export type MessageContentType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'agent-card'
  | 'drawer-content'
  | 'system-notification'
  | 'approval-request'
  | 'briefing';

export type AgentPersonality =
  | 'professional'
  | 'friendly'
  | 'creative'
  | 'analytical';

export type ModelId =
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-6'
  | 'gpt-4o'
  | 'deepseek-r1';

export type AgentStatus = 'online' | 'busy' | 'offline';

export type AgentCategory =
  | 'dev'
  | 'docs'
  | 'data'
  | 'design'
  | 'test'
  | 'ops'
  | 'translate'
  | 'security';
