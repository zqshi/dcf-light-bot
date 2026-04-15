/**
 * MockOpenClawDataSource
 *
 * Centralises ALL mock data for the 12 OpenClaw presentation components.
 * Follows the same "static factory" pattern as MockMatrixClient.
 *
 * Heavy data factories are split into:
 *   - mockNotificationData.ts  (notifications + agent greetings)
 *   - mockDecisionGoalData.ts  (decision trees/requests, collaboration chains, goals)
 */

import { AgentRuntime, type ChannelConnection } from '../../domain/agent/AgentRuntime';
import { AgentTask, type AgentSubtask, type ExecutionLog } from '../../domain/agent/AgentTask';
import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';
import { ProjectBoard, type ProjectBoardCard, type ProjectBoardColumn } from '../../domain/agent/ProjectBoard';
import { CoTMessage, type CoTStep } from '../../domain/agent/CoTMessage';
import type { MessageBlock } from '../../domain/agent/MessageBlock';
import {
  AgentOrchestrationService,
  type SystemHealthSnapshot,
} from '../../domain/agent/AgentOrchestrationService';
import type { NotificationProps } from '../../domain/notification/Notification';
import type { SharedAgent } from '../../application/stores/agentStore';
import type { CapabilityTemplate } from '../../domain/agent/CapabilityTemplate';
import { APP_TEMPLATES, matchAppTemplate } from './MockAppTemplates';
import { DOC_TEMPLATES, matchDocTemplate } from './MockDocTemplates';
import type { AgentRuntimeStatus } from '../../domain/shared/types';
import { DecisionTree } from '../../domain/agent/DecisionTree';
import { CollaborationChain } from '../../domain/agent/CollaborationChain';
import { createCrossChannelNotifications, getAgentGreeting } from './mockNotificationData';
import {
  getDecisionTrees as _getDecisionTrees,
  getCollaborationChains as _getCollaborationChains,
  simulateChainProgress as _simulateChainProgress,
  createDecisionRequests as _createDecisionRequests,
  GOAL_KEYWORDS,
  detectGoalIntent as _detectGoalIntent,
  createGoalFromIntent as _createGoalFromIntent,
  getDefaultGoals as _getDefaultGoals,
} from './mockDecisionGoalData';

// ─── Helpers ──────────────────────────────────────────────────────────

const randBetween = (lo: number, hi: number) =>
  Math.floor(Math.random() * (hi - lo + 1)) + lo;

function formatTimeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

const DEFAULT_CHANNELS: ChannelConnection[] = [
  { channelType: 'lark', status: 'connected', lastSyncAt: Date.now() - 60_000 },
  { channelType: 'slack', status: 'disconnected', lastSyncAt: Date.now() - 300_000 },
  { channelType: 'matrix', status: 'connected', lastSyncAt: Date.now() - 10_000 },
];

const CATEGORY_STATUS_MAP: Record<string, AgentRuntimeStatus> = {
  dev: 'working',
  docs: 'idle',
  data: 'idle',
  design: 'offline',
  test: 'idle',
  ops: 'monitoring',
  translate: 'idle',
  security: 'monitoring',
};

// ─── Class ────────────────────────────────────────────────────────────

export class MockOpenClawDataSource {
  // ── Runtimes ──────────────────────────────────────────────────────

  /** @deprecated Use createRuntimesFromTemplates */
  static createRuntimes(agents: SharedAgent[]): AgentRuntime[] {
    return agents.map((a) =>
      AgentRuntime.create({
        agentId: a.id,
        runtimeStatus: CATEGORY_STATUS_MAP[a.category] ?? 'idle',
        currentTaskId: null,
        tokenUsage: randBetween(100_000, 500_000),
        lastActiveAt: Date.now() - randBetween(0, 600_000),
        connectedChannels: DEFAULT_CHANNELS,
      }),
    );
  }

  static createRuntimesFromTemplates(templates: CapabilityTemplate[]): AgentRuntime[] {
    return templates.map((t) =>
      AgentRuntime.create({
        agentId: t.id,
        runtimeStatus: CATEGORY_STATUS_MAP[t.category] ?? 'idle',
        currentTaskId: null,
        tokenUsage: randBetween(100_000, 500_000),
        lastActiveAt: Date.now() - randBetween(0, 600_000),
        connectedChannels: DEFAULT_CHANNELS,
      }),
    );
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  static createTasks(): AgentTask[] {
    const now = Date.now();

    const task1Subtasks: AgentSubtask[] = [
      { id: 'mst1', name: '数据采集', status: 'success' },
      { id: 'mst2', name: '趋势分析', status: 'success' },
      { id: 'mst3', name: '竞品对比', status: 'running' },
      { id: 'mst4', name: '报告生成', status: 'pending' },
    ];

    const task1Logs: ExecutionLog[] = [
      { timestamp: now - 120_000, level: 'INFO', message: '开始采集市场数据...' },
      { timestamp: now - 90_000, level: 'INFO', message: '数据采集完成，共 2,340 条记录' },
      { timestamp: now - 60_000, level: 'INFO', message: '趋势分析完成，发现 3 个关键趋势' },
      { timestamp: now - 30_000, level: 'INFO', message: '正在进行竞品对比分析...' },
      { timestamp: now - 10_000, level: 'DEBUG', message: '已完成 80% 的竞品数据匹配' },
    ];

    const task2Subtasks: AgentSubtask[] = [
      { id: 'vst1', name: '端口扫描', status: 'success' },
      { id: 'vst2', name: '漏洞检测', status: 'running' },
      { id: 'vst3', name: '报告生成', status: 'pending' },
    ];

    const task2Logs: ExecutionLog[] = [
      { timestamp: now - 180_000, level: 'INFO', message: '启动端口扫描...' },
      { timestamp: now - 150_000, level: 'INFO', message: '端口扫描完成，开放端口: 22, 80, 443, 8080' },
      { timestamp: now - 100_000, level: 'WARN', message: '检测到 8080 端口运行未授权服务' },
      { timestamp: now - 50_000, level: 'INFO', message: '正在进行漏洞检测...' },
    ];

    return [
      AgentTask.create({
        id: 'task-1',
        agentId: 'sa-6',
        todoId: 'todo-market',
        name: '市场监测 (Market)',
        status: 'running',
        progress: 80,
        subtasks: task1Subtasks,
        logs: task1Logs,
        color: '#00D4B8',
        createdAt: now - 300_000,
        updatedAt: now - 10_000,
        reasoningSteps: [
          { label: '数据源评估', detail: '已接入 3 个市场数据源：Wind、Bloomberg、公开财报，覆盖 85% 的目标公司' },
          { label: '趋势识别', detail: '检测到竞品 A 在 Q1 加大研发投入 40%，可能推出竞品功能' },
          { label: '竞品分析中', detail: '正在对比 5 项核心功能指标，已完成 3/5…' },
        ],
      }),
      AgentTask.create({
        id: 'task-2',
        agentId: 'sa-8',
        todoId: 'todo-scan',
        name: '漏洞扫描',
        status: 'running',
        progress: 45,
        subtasks: task2Subtasks,
        logs: task2Logs,
        color: '#FF9500',
        createdAt: now - 300_000,
        updatedAt: now - 50_000,
        reasoningSteps: [
          { label: '攻击面测绘', detail: '已识别 12 个公开端点，3 个内部 API 遗漏认证' },
          { label: 'CVE 匹配', detail: '匹配到 47 条已知 CVE，0 条高危命中' },
          { label: '深度检测中', detail: '正在对 8080 端口未授权服务进行指纹识别…' },
        ],
      }),
    ];
  }

  // ── Delegated: Notifications + Greetings (mockNotificationData.ts) ──

  static createCrossChannelNotifications(): NotificationProps[] {
    return createCrossChannelNotifications();
  }

  static createSystemHealth(runtimes: AgentRuntime[]): SystemHealthSnapshot {
    return AgentOrchestrationService.computeSystemHealth(runtimes);
  }

  static getAgentGreeting(agentId: string): CoTMessage[] {
    return getAgentGreeting(agentId);
  }

  // ── Proactive Activities (自主行为记录) ──────────────────────────

  static getProactiveActivities(): Array<{
    id: string;
    icon: string;
    iconColor: string;
    action: string;
    detail: string;
    time: string;
    category: 'autonomous' | 'monitoring' | 'insight';
  }> {
    const now = Date.now();
    return [
      {
        id: 'pa-1', icon: 'security', iconColor: '#FF9500',
        action: '完成安全巡检',
        detail: '扫描了 12 个服务端点，发现 0 个高危漏洞，2 个中危已自动提交修复 PR',
        time: formatTimeAgo(now - 25 * 60_000), category: 'autonomous',
      },
      {
        id: 'pa-2', icon: 'monitoring', iconColor: '#34C759',
        action: '监测到 API 延迟波动',
        detail: '/api/v1/documents 接口 P99 从 120ms 升至 340ms，已通知研发部',
        time: formatTimeAgo(now - 48 * 60_000), category: 'monitoring',
      },
      {
        id: 'pa-3', icon: 'auto_fix_high', iconColor: '#00D4B8',
        action: '自动优化数据库查询',
        detail: '检测到 3 条慢查询（>500ms），已生成索引优化建议并提交审核',
        time: formatTimeAgo(now - 92 * 60_000), category: 'autonomous',
      },
      {
        id: 'pa-4', icon: 'summarize', iconColor: '#007AFF',
        action: '整理会议纪要',
        detail: '从今日 10:00 产品周会录音中提取 5 项决议、8 个待办，已同步到待办看板',
        time: formatTimeAgo(now - 150 * 60_000), category: 'autonomous',
      },
      {
        id: 'pa-5', icon: 'trending_up', iconColor: '#AF52DE',
        action: '生成日报初稿',
        detail: '基于今日 Git 提交和 JIRA 状态变更，已生成工作日报草稿供你确认',
        time: formatTimeAgo(now - 200 * 60_000), category: 'insight',
      },
    ];
  }

  static getProactiveInsights(): Array<{
    id: string;
    icon: string;
    color: string;
    title: string;
    description: string;
    urgency: 'info' | 'warning' | 'success';
  }> {
    return [
      {
        id: 'pi-1', icon: 'event_upcoming', color: '#FF9500',
        title: '明日有 2 场会议冲突',
        description: '14:00 技术评审与 14:30 产品对齐时间重叠，建议调整',
        urgency: 'warning',
      },
      {
        id: 'pi-2', icon: 'task_alt', color: '#34C759',
        title: '本周 OKR 进度良好',
        description: '3/4 关键结果已达标，剩余 1 项预计周四完成',
        urgency: 'success',
      },
      {
        id: 'pi-3', icon: 'description', color: '#007AFF',
        title: '有 3 份文档待你审批',
        description: '来自研发部和市场部，最早提交于 2 天前',
        urgency: 'info',
      },
    ];
  }

  // ── Quick Commands ────────────────────────────────────────────────

  static getQuickCommands(): Array<{ id: string; icon: string; label: string; desc: string }> {
    return [
      { id: 'qc-1', icon: '🔍', label: '代码审查', desc: '对指定文件进行安全和质量审查' },
      { id: 'qc-2', icon: '📊', label: '数据分析', desc: '生成 SQL 查询并可视化数据' },
      { id: 'qc-3', icon: '📝', label: '文档生成', desc: '根据代码自动生成 API 文档' },
      { id: 'qc-4', icon: '🧪', label: '测试生成', desc: '为模块生成单元测试和集成测试' },
    ];
  }

  // ── Resource Usage Bar Data ───────────────────────────────────────

  static getBarData(): Array<{ label: string; value: number }> {
    return [
      { label: 'CPU', value: 42 },
      { label: '内存', value: 68 },
      { label: 'GPU', value: 25 },
      { label: '存储', value: 55 },
      { label: '网络', value: 37 },
    ];
  }

  // ── Task Progress Simulation ──────────────────────────────────────

  static simulateTaskProgress(
    onUpdate: (taskId: string, progress: number) => void,
  ): () => void {
    const taskProgress: Record<string, number> = {
      'task-1': 80,
      'task-2': 45,
    };

    const timer = setInterval(() => {
      for (const taskId of Object.keys(taskProgress)) {
        if (taskProgress[taskId] >= 100) continue;
        const delta = randBetween(0, 2);
        taskProgress[taskId] = Math.min(100, taskProgress[taskId] + delta);
        onUpdate(taskId, taskProgress[taskId]);
      }
    }, 3_000);

    return () => clearInterval(timer);
  }

  // ── Task Creation from Intent ─────────────────────────────────────

  private static taskCounter = 0;

  static readonly TASK_KEYWORDS = ['扫描', '审计', '分析', '检查', '生成报告', '部署', '测试', '优化', '监控'];

  static detectTaskIntent(text: string): string | null {
    return this.TASK_KEYWORDS.find((kw) => text.includes(kw)) ?? null;
  }

  static createTaskFromIntent(
    agentId: string,
    intent: string,
    responseText: string,
  ): AgentTask {
    this.taskCounter++;
    const taskId = `task-auto-${Date.now()}-${this.taskCounter}`;
    const now = Date.now();

    const INTENT_CONFIG: Record<string, { name: string; color: string; subtasks: AgentSubtask[] }> = {
      '扫描': {
        name: '安全扫描',
        color: '#FF9500',
        subtasks: [
          { id: `${taskId}-s1`, name: '端口扫描', status: 'running' },
          { id: `${taskId}-s2`, name: '漏洞检测', status: 'pending' },
          { id: `${taskId}-s3`, name: '报告生成', status: 'pending' },
        ],
      },
      '审计': {
        name: '代码审计',
        color: '#FF3B30',
        subtasks: [
          { id: `${taskId}-s1`, name: '代码扫描', status: 'running' },
          { id: `${taskId}-s2`, name: '规则匹配', status: 'pending' },
          { id: `${taskId}-s3`, name: '风险评估', status: 'pending' },
        ],
      },
      '分析': {
        name: '数据分析',
        color: '#007AFF',
        subtasks: [
          { id: `${taskId}-s1`, name: '数据采集', status: 'running' },
          { id: `${taskId}-s2`, name: '统计分析', status: 'pending' },
          { id: `${taskId}-s3`, name: '可视化', status: 'pending' },
        ],
      },
      '测试': {
        name: '测试执行',
        color: '#34C759',
        subtasks: [
          { id: `${taskId}-s1`, name: '用例生成', status: 'running' },
          { id: `${taskId}-s2`, name: '执行测试', status: 'pending' },
          { id: `${taskId}-s3`, name: '结果汇总', status: 'pending' },
        ],
      },
    };

    const config = INTENT_CONFIG[intent] ?? {
      name: `${intent}任务`,
      color: '#00D4B8',
      subtasks: [
        { id: `${taskId}-s1`, name: '准备中', status: 'running' },
        { id: `${taskId}-s2`, name: '执行中', status: 'pending' },
        { id: `${taskId}-s3`, name: '完成', status: 'pending' },
      ],
    };

    const logs: ExecutionLog[] = [
      { timestamp: now, level: 'INFO', message: `任务已创建：${config.name}` },
      { timestamp: now + 100, level: 'INFO', message: `开始执行 ${config.subtasks[0].name}...` },
    ];

    return AgentTask.create({
      id: taskId,
      agentId,
      todoId: `todo-${taskId}`,
      name: config.name,
      status: 'running',
      progress: randBetween(5, 15),
      subtasks: config.subtasks,
      logs,
      color: config.color,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Delegated: Decisions + Goals (mockDecisionGoalData.ts) ────────

  static getDecisionTrees(): DecisionTree[] { return _getDecisionTrees(); }
  static getCollaborationChains(): CollaborationChain[] { return _getCollaborationChains(); }
  static simulateChainProgress(
    onUpdate: (chainId: string, nodeId: string, status: 'completed' | 'active') => void,
  ): () => void { return _simulateChainProgress(onUpdate); }

  // ── Mock chat responses ──

  private static readonly MOCK_RESPONSES: Record<string, { text: string; blocks?: MessageBlock[] }> = {
    '你能做什么': {
      text: '我是你的数字分身，可以帮你处理以下工作：\n\n1. **安全审计** — 自动扫描代码漏洞、依赖 CVE、端口暴露\n2. **数据分析** — 查询业务指标、生成可视化报告\n3. **代码开发** — 辅助编写、Review、重构代码\n4. **运维监控** — 实时监测系统健康、异常告警\n5. **文档管理** — 搜索知识库、同步文档\n\n你可以直接用自然语言下达指令，我会自动调用对应的专业 Agent 协同完成。',
    },
    '扫描': {
      text: '好的，我来为你启动安全扫描任务。\n\n将扫描以下范围：\n- 所有服务端点的端口暴露情况\n- 第三方依赖的已知 CVE 漏洞\n- 代码中的安全反模式\n\n任务已创建，可以在右侧面板查看进度。',
    },
    '分析': {
      text: '数据分析任务已启动。我会从以下维度进行分析：\n\n- **流量趋势**: 最近 7 天的 API 调用量变化\n- **性能指标**: P50/P95/P99 延迟分布\n- **错误率**: 各接口 5xx 错误占比\n\n分析完成后会生成可视化报告。',
    },
    '看板': {
      text: '好的，已为你创建项目看板。\n\n看板包含 **4 个阶段**：待办 → 进行中 → 评审中 → 已完成。\n\n已分配 **4 个 Agent** 自动编排任务执行：\n- 🔧 代码开发\n- 📊 数据分析\n- 🔒 安全审计\n- ⚙️ 运维助手\n\nAgent 会自动认领待办卡片并推进进度，你可以点击任意 Agent 查看其执行过程和思考链路。',
    },
    '项目面板': {
      text: '好的，已为你创建项目看板。\n\n看板包含 **4 个阶段**：待办 → 进行中 → 评审中 → 已完成。\n\n已分配 **4 个 Agent** 自动编排任务执行：\n- 🔧 代码开发\n- 📊 数据分析\n- 🔒 安全审计\n- ⚙️ 运维助手\n\nAgent 会自动认领待办卡片并推进进度，你可以点击任意 Agent 查看其执行过程和思考链路。',
    },
    '项目管理': {
      text: '好的，已为你创建项目看板。\n\n看板包含 **4 个阶段**：待办 → 进行中 → 评审中 → 已完成。\n\n已分配 **4 个 Agent** 自动编排任务执行：\n- 🔧 代码开发\n- 📊 数据分析\n- 🔒 安全审计\n- ⚙️ 运维助手\n\nAgent 会自动认领待办卡片并推进进度，你可以点击任意 Agent 查看其执行过程和思考链路。',
    },
  };

  static getMockChatResponse(userText: string): { text: string; blocks?: MessageBlock[]; cotSteps?: CoTStep[] } {
    const exact = this.MOCK_RESPONSES[userText];
    if (exact) return exact;

    for (const [key, resp] of Object.entries(this.MOCK_RESPONSES)) {
      if (userText.includes(key)) return resp;
    }

    return {
      text: `好的，我已收到你的指令：「${userText}」\n\n**分析完成**：我会根据当前上下文自动匹配最合适的 Agent 来执行。处理过程中如果有需要你确认的决策点，我会以卡片形式推送给你。\n\n预计处理时间：3-5 分钟。如有紧急情况，我会主动通知。`,
      cotSteps: [
        { id: `s-${Date.now()}-1`, label: '意图解析', status: 'done', detail: `用户指令：「${userText.slice(0, 40)}${userText.length > 40 ? '…' : ''}」— 检测到常规指令类型` },
        { id: `s-${Date.now()}-2`, label: '上下文检索', status: 'done', detail: '关联 3 条近期消息 + 2 个活跃任务，上下文完整' },
        { id: `s-${Date.now()}-3`, label: 'Agent 匹配', status: 'done', detail: '已路由到对应能力 Agent，等待确认执行' },
      ],
    };
  }

  // ── Delegated: Decision Requests + Goals ───────────────────────────

  static createDecisionRequests(): DecisionRequest[] { return _createDecisionRequests(); }
  static readonly GOAL_KEYWORDS = GOAL_KEYWORDS;
  static detectGoalIntent(text: string): string | null { return _detectGoalIntent(text); }
  static createGoalFromIntent(agentId: string, intent: string, userText: string): UserGoal {
    return _createGoalFromIntent(agentId, intent, userText);
  }
  static getDefaultGoals(): UserGoal[] { return _getDefaultGoals(); }

  // ── App Builder ──────────────────────────────────────────────────

  static readonly APP_KEYWORDS = ['创建应用', '做个应用', '建一个应用', '开发应用', '写个应用',
    '天气应用', '计算器', '待办应用', 'todo应用', '日历应用', '小工具'];

  private static appCounter = 0;

  static detectAppIntent(text: string): string | null {
    if (this.APP_KEYWORDS.some((kw) => text.includes(kw))) return text;
    if (/(?:创建|做|写|开发|搭建).*(?:应用|工具|页面|APP|app|小程序)/.test(text)) return text;
    return null;
  }

  static createAppFromIntent(intent: string, userText: string) {
    this.appCounter++;
    const now = Date.now();
    const key = matchAppTemplate(userText);
    const tpl = APP_TEMPLATES[key];
    return {
      id: `app-${now}-${this.appCounter}`,
      name: tpl.name,
      description: tpl.description,
      stage: 'designing' as const,
      codeSnapshots: [{ ...tpl.skeleton, timestamp: now }],
      createdAt: now,
      updatedAt: now,
    };
  }

  static simulateAppProgress(
    appId: string,
    userText: string,
    onUpdate: (appId: string, stage: string, snapshot: { html: string; css: string; js: string; timestamp: number }) => void,
  ): () => void {
    const key = matchAppTemplate(userText);
    const tpl = APP_TEMPLATES[key];
    const stages: Array<{ delay: number; stage: string; snap: { html: string; css: string; js: string } }> = [
      { delay: 2500, stage: 'building', snap: tpl.building },
      { delay: 6000, stage: 'preview', snap: tpl.final },
      { delay: 8000, stage: 'done', snap: tpl.final },
    ];
    const timers = stages.map(({ delay, stage, snap }) =>
      setTimeout(() => onUpdate(appId, stage, { ...snap, timestamp: Date.now() }), delay),
    );
    return () => timers.forEach(clearTimeout);
  }

  // ── Document Writer ──────────────────────────────────────────────

  static readonly DOC_KEYWORDS = ['写文档', '写一篇', '生成文档', '撰写', '帮我写',
    '技术文档', '设计文档', '需求文档', 'API文档', '操作手册', '用户指南'];

  private static docCounter = 0;

  static detectDocIntent(text: string): string | null {
    if (this.DOC_KEYWORDS.some((kw) => text.includes(kw))) return text;
    if (/(?:写|撰写|生成|起草).*(?:文档|报告|手册|指南|说明书)/.test(text)) return text;
    return null;
  }

  static createDocFromIntent(intent: string, userText: string) {
    this.docCounter++;
    const now = Date.now();
    const key = matchDocTemplate(userText);
    const tpl = DOC_TEMPLATES[key];
    return {
      id: `doc-${now}-${this.docCounter}`,
      title: tpl.title,
      content: '',
      sections: tpl.sections.map((s: { title: string }, i: number) => ({
        title: s.title,
        status: i === 0 ? 'writing' as const : 'pending' as const,
      })),
      createdAt: now,
      updatedAt: now,
    };
  }

  static getDocSectionContents(userText: string): Array<{ title: string; html: string }> {
    const key = matchDocTemplate(userText);
    return DOC_TEMPLATES[key].sections;
  }

  static simulateDocProgress(
    docId: string,
    sections: Array<{ title: string; html: string }>,
    onUpdate: (docId: string, sectionIndex: number, accumulatedContent: string) => void,
  ): () => void {
    let accumulated = '';
    const timers = sections.map((section, i) =>
      setTimeout(() => {
        accumulated += section.html;
        onUpdate(docId, i, accumulated);
      }, (i + 1) * 2500),
    );
    return () => timers.forEach(clearTimeout);
  }

  // ── Project Board (Kanban) ────────────────────────────────────────

  static readonly BOARD_KEYWORDS = ['看板', '项目板', 'kanban', '项目管理', '任务管理',
    '项目看板', '任务看板', '敏捷看板', 'sprint', '项目面板', '任务面板'];

  private static boardCounter = 0;

  static detectBoardIntent(text: string): string | null {
    if (this.BOARD_KEYWORDS.some((kw) => text.includes(kw))) return text;
    if (/(?:创建|新建|搭建|做个|打开|展示|显示).*(?:看板|board|项目管理|项目面板)/.test(text)) return text;
    return null;
  }

  static createBoardFromIntent(userText: string): ProjectBoard {
    this.boardCounter++;
    const now = Date.now();
    const id = `board-${now}-${this.boardCounter}`;

    const columns: ProjectBoardColumn[] = [
      { id: 'col-backlog', name: '待办', color: '#64748b' },
      { id: 'col-progress', name: '进行中', color: '#007AFF' },
      { id: 'col-review', name: '评审中', color: '#FF9500' },
      { id: 'col-done', name: '已完成', color: '#34C759' },
    ];

    const agents = [
      { id: 'sa-dev', name: '代码开发' },
      { id: 'sa-data', name: '数据分析' },
      { id: 'sa-security', name: '安全审计' },
      { id: 'sa-ops', name: '运维助手' },
    ];

    const cards: ProjectBoardCard[] = [
      { id: `${id}-c1`, title: 'API 接口文档更新', description: '更新 REST API 文档，补充新增端点', columnId: 'col-backlog', assignedAgentId: null, assignedAgentName: null, priority: 'normal', tags: ['文档', 'API'], executionLogs: [], reasoningSteps: [], status: 'idle', createdAt: now - 3600000, updatedAt: now - 3600000 },
      { id: `${id}-c2`, title: '移动端响应式适配', description: '修复移动端布局错位和触摸交互问题', columnId: 'col-backlog', assignedAgentId: null, assignedAgentName: null, priority: 'high', tags: ['前端', '移动端'], executionLogs: [], reasoningSteps: [], status: 'idle', createdAt: now - 7200000, updatedAt: now - 7200000 },
      { id: `${id}-c3`, title: '用户认证模块重构', description: '将 JWT 验证逻辑从路由层下沉到 domain 层', columnId: 'col-progress', assignedAgentId: 'sa-dev', assignedAgentName: '代码开发', priority: 'critical', tags: ['后端', '安全'], executionLogs: [
        { timestamp: now - 120000, level: 'INFO', message: '开始分析现有认证模块结构' },
        { timestamp: now - 90000, level: 'INFO', message: '识别出 3 处 JWT 校验逻辑散落在路由层' },
        { timestamp: now - 60000, level: 'INFO', message: '创建 domain/auth/TokenValidator 实体' },
      ], reasoningSteps: [
        { label: '架构分析', detail: '当前 JWT 校验分散在 5 个路由文件中，违反 DDD 分层原则' },
        { label: '重构策略', detail: '创建 TokenValidator 领域服务，统一校验逻辑，路由层仅调用' },
        { label: '影响评估', detail: '涉及 5 个路由文件 + 新增 2 个 domain 文件，无接口变更' },
      ], status: 'working', createdAt: now - 180000, updatedAt: now - 60000 },
      { id: `${id}-c4`, title: '数据库查询优化', description: '为高频查询添加索引，优化 N+1 问题', columnId: 'col-progress', assignedAgentId: 'sa-data', assignedAgentName: '数据分析', priority: 'high', tags: ['数据库', '性能'], executionLogs: [
        { timestamp: now - 100000, level: 'INFO', message: '分析慢查询日志，定位 Top 5 瓶颈' },
        { timestamp: now - 80000, level: 'WARN', message: '发现 users 表缺少 email 字段索引' },
        { timestamp: now - 50000, level: 'INFO', message: '生成索引迁移脚本 migration_042.sql' },
      ], reasoningSteps: [
        { label: '性能剖析', detail: '慢查询日志显示 users 表全表扫描占 40% 查询时间' },
        { label: '方案设计', detail: '添加 (email, status) 复合索引 + 优化 ORM 预加载策略' },
      ], status: 'working', createdAt: now - 240000, updatedAt: now - 50000 },
      { id: `${id}-c5`, title: '前端性能优化', description: '代码分割 + 懒加载关键路由', columnId: 'col-review', assignedAgentId: 'sa-dev', assignedAgentName: '代码开发', priority: 'normal', tags: ['前端', '性能'], executionLogs: [
        { timestamp: now - 300000, level: 'INFO', message: '分析 bundle 大小，vendors 占 68%' },
        { timestamp: now - 200000, level: 'INFO', message: '实现 React.lazy 路由级分割' },
        { timestamp: now - 150000, level: 'INFO', message: 'Lighthouse 得分从 62 提升至 89' },
      ], reasoningSteps: [
        { label: '问题诊断', detail: 'Bundle 分析: vendors.js 1.2MB，main.js 800KB' },
        { label: '优化策略', detail: 'React.lazy + Suspense 路由级分割 + 动态 import 大型库' },
        { label: '成效验证', detail: 'FCP 从 3.2s 降至 1.4s，Lighthouse 得分 89' },
      ], status: 'done', createdAt: now - 600000, updatedAt: now - 150000 },
      { id: `${id}-c6`, title: '安全漏洞扫描修复', description: 'CVE-2024-XXXX 依赖漏洞修复', columnId: 'col-review', assignedAgentId: 'sa-security', assignedAgentName: '安全审计', priority: 'critical', tags: ['安全', 'CVE'], executionLogs: [
        { timestamp: now - 400000, level: 'WARN', message: '检测到 3 个高危 CVE 漏洞' },
        { timestamp: now - 350000, level: 'INFO', message: '升级 lodash 4.17.15 → 4.17.21' },
        { timestamp: now - 280000, level: 'INFO', message: '全部漏洞已修补，等待评审确认' },
      ], reasoningSteps: [
        { label: '漏洞扫描', detail: 'npm audit: 3 high, 1 critical in lodash, express-jwt' },
        { label: '修复方案', detail: '升级受影响依赖至已修补版本，回归测试通过' },
      ], status: 'done', createdAt: now - 500000, updatedAt: now - 280000 },
      { id: `${id}-c7`, title: 'CI/CD 流水线配置', description: '配置 GitHub Actions 自动化测试和部署', columnId: 'col-done', assignedAgentId: 'sa-ops', assignedAgentName: '运维助手', priority: 'normal', tags: ['DevOps', 'CI'], executionLogs: [
        { timestamp: now - 900000, level: 'INFO', message: '创建 .github/workflows/ci.yml' },
        { timestamp: now - 800000, level: 'INFO', message: '配置 lint + test + build 三阶段' },
        { timestamp: now - 700000, level: 'INFO', message: '流水线首次运行成功 ✓' },
      ], reasoningSteps: [
        { label: '方案选择', detail: 'GitHub Actions 免费额度足够，与仓库天然集成' },
        { label: '流水线设计', detail: 'lint → test → build → deploy，每阶段独立可重试' },
      ], status: 'done', createdAt: now - 1000000, updatedAt: now - 700000 },
      { id: `${id}-c8`, title: '日志监控告警系统', description: '接入 Grafana + Loki 日志采集和告警', columnId: 'col-done', assignedAgentId: 'sa-ops', assignedAgentName: '运维助手', priority: 'high', tags: ['监控', '运维'], executionLogs: [
        { timestamp: now - 1200000, level: 'INFO', message: '部署 Loki 日志采集器' },
        { timestamp: now - 1100000, level: 'INFO', message: '创建 Grafana 仪表盘 5 个面板' },
        { timestamp: now - 1000000, level: 'INFO', message: '配置 P95 延迟 > 500ms 告警规则' },
      ], reasoningSteps: [
        { label: '技术选型', detail: 'Grafana + Loki 轻量开源，与 K8s 集成良好' },
      ], status: 'done', createdAt: now - 1500000, updatedAt: now - 1000000 },
    ];

    return ProjectBoard.create({
      id,
      name: /(?:项目|产品|sprint|迭代)/.test(userText) ? '产品迭代看板' : 'Agent 协作看板',
      description: 'Agent 自动编排执行，实时跟踪任务进度',
      columns,
      cards,
      agentIds: agents.map((a) => a.id),
      createdAt: now,
      updatedAt: now,
    });
  }

  static simulateBoardProgress(
    initialBoard: ProjectBoard,
    onUpdate: (board: ProjectBoard) => void,
  ): () => void {
    let board = initialBoard;
    const agents = [
      { id: 'sa-dev', name: '代码开发' },
      { id: 'sa-data', name: '数据分析' },
      { id: 'sa-security', name: '安全审计' },
      { id: 'sa-ops', name: '运维助手' },
    ];

    const LOG_MESSAGES_PROGRESS = [
      '正在分析任务需求和依赖关系',
      '开始编写实现代码',
      '运行单元测试验证逻辑',
      '代码审查自检完成',
      '准备提交评审',
    ];
    const LOG_MESSAGES_REVIEW = [
      '评审中：检查代码质量和规范',
      '评审通过，合并到主分支',
    ];
    const REASONING_PROGRESS = [
      { label: '需求理解', detail: '解析任务描述，确定实现边界' },
      { label: '方案设计', detail: '设计技术方案，评估影响范围' },
      { label: '编码实现', detail: '按照方案逐步编写和测试代码' },
    ];

    const timer = setInterval(() => {
      const backlog = board.getCardsByColumn('col-backlog');
      const progress = board.getCardsByColumn('col-progress');
      const review = board.getCardsByColumn('col-review');
      const now = Date.now();
      let changed = false;

      if (backlog.length > 0 && Math.random() < 0.3) {
        const card = backlog[0];
        const agent = agents[Math.floor(Math.random() * agents.length)];
        board = board
          .moveCard(card.id, 'col-progress')
          .assignAgent(card.id, agent.id, agent.name)
          .updateCard(card.id, {
            executionLogs: [{ timestamp: now, level: 'INFO', message: `${agent.name} 认领任务，开始执行` }],
            reasoningSteps: [REASONING_PROGRESS[0]],
          });
        changed = true;
      }

      for (const card of progress.filter((c) => c.status === 'working')) {
        if (Math.random() < 0.4) {
          const msgIdx = Math.min(card.executionLogs.length, LOG_MESSAGES_PROGRESS.length - 1);
          const stepIdx = Math.min(card.reasoningSteps.length, REASONING_PROGRESS.length - 1);
          board = board.updateCard(card.id, {
            executionLogs: [...card.executionLogs, { timestamp: now, level: 'INFO', message: LOG_MESSAGES_PROGRESS[msgIdx] }],
            reasoningSteps: card.reasoningSteps.length < REASONING_PROGRESS.length
              ? [...card.reasoningSteps, REASONING_PROGRESS[stepIdx]]
              : card.reasoningSteps,
          });
          changed = true;
        }
      }

      if (progress.length > 0 && Math.random() < 0.2) {
        const card = progress.find((c) => c.executionLogs.length >= 3) ?? null;
        if (card) {
          board = board
            .moveCard(card.id, 'col-review')
            .updateCard(card.id, {
              executionLogs: [...card.executionLogs, { timestamp: now, level: 'INFO', message: LOG_MESSAGES_REVIEW[0] }],
            });
          changed = true;
        }
      }

      if (review.length > 0 && Math.random() < 0.15) {
        const card = review[0];
        board = board
          .moveCard(card.id, 'col-done')
          .updateCard(card.id, {
            status: 'done',
            executionLogs: [...card.executionLogs, { timestamp: now, level: 'INFO', message: LOG_MESSAGES_REVIEW[1] }],
          });
        changed = true;
      }

      if (changed) onUpdate(board);
    }, 4000);

    return () => clearInterval(timer);
  }
}
