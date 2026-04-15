import type { AgentRuntime } from '../../domain/agent/AgentRuntime';
import type { AgentTask } from '../../domain/agent/AgentTask';
import type { CoTMessage } from '../../domain/agent/CoTMessage';
import type { DecisionRequest } from '../../domain/agent/DecisionRequest';
import type { UserGoal } from '../../domain/agent/UserGoal';
import type { ProjectBoard } from '../../domain/agent/ProjectBoard';
import type { SystemHealthSnapshot } from '../../domain/agent/AgentOrchestrationService';
import type { DecisionTree } from '../../domain/agent/DecisionTree';
import type { CollaborationChain } from '../../domain/agent/CollaborationChain';
import type { OpenClawDrawerContent } from '../../domain/agent/DrawerContent';
import type { AttentionItem } from '../../domain/agent/DrawerContent';

export interface MockApp {
  id: string;
  name: string;
  description: string;
  stage: 'designing' | 'building' | 'preview' | 'done';
  codeSnapshots: Array<{ html: string; css: string; js: string; timestamp: number }>;
  createdAt: number;
  updatedAt: number;
}

export interface MockDocument {
  id: string;
  title: string;
  content: string;
  sections: Array<{ title: string; status: 'pending' | 'writing' | 'done' }>;
  createdAt: number;
  updatedAt: number;
}

export interface ProactiveActivity {
  id: string;
  icon: string;
  iconColor: string;
  action: string;
  detail: string;
  time: string;
  category: 'autonomous' | 'monitoring' | 'insight';
}

export interface ProactiveInsight {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'success';
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
  type: 'primary' | 'discussion' | 'shared';
}

export interface OpenClawState {
  runtimes: AgentRuntime[];
  tasks: AgentTask[];
  selectedTaskId: string | null;
  /** 按上下文隔离的对话存储，key: 'primary' | 'task-<id>' | 'shared-<id>' */
  conversations: Record<string, CoTMessage[]>;
  /** 当前活跃的对话上下文 ID */
  activeConversationId: string;
  sessionId: string | null;
  isSending: boolean;
  systemHealth: SystemHealthSnapshot | null;
  quickCommands: Array<{ id: string; icon: string; label: string; desc: string }>;
  proactiveActivities: ProactiveActivity[];
  proactiveInsights: ProactiveInsight[];
  decisionTrees: Record<string, DecisionTree>;
  expandedActivityId: string | null;
  collaborationChains: CollaborationChain[];
  decisionRequests: DecisionRequest[];
  goals: UserGoal[];
  activeGoalId: string | null;
  apps: MockApp[];
  documents: MockDocument[];
  boards: ProjectBoard[];
  drawerContent: OpenClawDrawerContent | null;
  drawerWidth: number;
  activeSharedAgentId: string | null;
  activeAttentionItemId: string | null;
  composerPrefill: string | null;
  /** C 栏正在讨论的通知 ID（非 null 时 C 栏显示事件上下文而非聊天） */
  discussingNotificationId: string | null;
  /** C 栏正在讨论的决策 ID（非 null 时 C 栏显示决策上下文） */
  discussingDecisionId: string | null;
  /** C 栏正在讨论的任务 ID（非 null 时 C 栏显示任务上下文） */
  discussingTaskId: string | null;
  /** C 栏正在讨论的目标 ID（非 null 时 C 栏显示目标上下文） */
  discussingGoalId: string | null;
  /** 派生自对话 blocks + 外部通知 */
  attentionItems: AttentionItem[];
  /** B 栏当前展示的任务 ID（与 selectedNotificationId 互斥） */
  bColumnTaskId: string | null;
  /** B 栏当前展示的目标 ID */
  bColumnGoalId: string | null;
  /** B 栏当前展示的决策 ID */
  bColumnDecisionId: string | null;
  /** 中栏需要滚动到的消息 ID */
  scrollToMessageId: string | null;
  /** 所有对话会话列表 */
  conversationSessions: ConversationSession[];
  /** A 栏当前 Tab */
  aColumnTab: 'attention' | 'history';
  _cleanup: (() => void) | null;

  openDrawer(content: OpenClawDrawerContent): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setDrawerWidth(width: number): void;
  setActiveAttentionItem(id: string | null): void;
  selectBColumnTask(id: string | null): void;
  selectBColumnGoal(id: string | null): void;
  selectBColumnDecision(id: string | null): void;
  /** 切换活跃对话上下文，自动创建空对话 */
  switchConversation(id: string): void;
  openDrawerForAttentionItem(itemId: string): void;
  clearScrollTarget(): void;
  rebuildAttentionItems(): void;
  setRuntimes(runtimes: AgentRuntime[]): void;
  updateRuntime(agentId: string, updater: (r: AgentRuntime) => AgentRuntime): void;
  setTasks(tasks: AgentTask[]): void;
  updateTask(taskId: string, updater: (t: AgentTask) => AgentTask): void;
  selectTask(taskId: string | null): void;
  appendMessage(msg: CoTMessage): void;
  updateLastMessage(updater: (m: CoTMessage) => CoTMessage): void;
  setIsSending(v: boolean): void;
  setSystemHealth(health: SystemHealthSnapshot): void;
  expandActivity(activityId: string | null): void;
  executeFollowUp(activityId: string, actionId: string): void;
  pauseTask(taskId: string): void;
  resumeTask(taskId: string): void;
  cancelTask(taskId: string): void;
  addDecisionRequest(request: DecisionRequest): void;
  respondToDecision(decisionId: string, updater: (d: DecisionRequest) => DecisionRequest): void;
  respondDecision(decisionId: string, action: 'accept' | 'modify' | 'decline' | 'defer', params?: {
    feedback?: string;
    optionId?: string;
    deferUntil?: number;
  }): void;
  addGoal(goal: UserGoal): void;
  updateGoal(goalId: string, updater: (g: UserGoal) => UserGoal): void;
  setActiveGoal(goalId: string | null): void;
  addApp(app: MockApp): void;
  updateApp(appId: string, updater: (a: MockApp) => MockApp): void;
  addDocument(doc: MockDocument): void;
  updateDocument(docId: string, updater: (d: MockDocument) => MockDocument): void;
  addBoard(board: ProjectBoard): void;
  updateBoard(boardId: string, updater: (b: ProjectBoard) => ProjectBoard): void;
  startSharedAgentChat(agentId: string): void;
  returnToPrimaryAgent(): void;
  setComposerPrefill(text: string | null): void;
  setDiscussingNotificationId(id: string | null): void;
  setDiscussingDecisionId(id: string | null): void;
  setDiscussingTaskId(id: string | null): void;
  setDiscussingGoalId(id: string | null): void;
  returnToHome(): void;
  setAColumnTab(tab: 'attention' | 'history'): void;
  createNewConversation(title?: string): void;
  switchToSession(sessionId: string): void;
  initConversation(): void;
  initialize(): Promise<void>;
  reset(): void;
}

export type StoreSet = (partial: Partial<OpenClawState> | ((state: OpenClawState) => Partial<OpenClawState>)) => void;
export type StoreGet = () => OpenClawState;
