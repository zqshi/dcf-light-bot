/**
 * MockOpenClawDataSource
 *
 * Centralises ALL mock data for the 12 OpenClaw presentation components.
 * Follows the same "static factory" pattern as MockMatrixClient.
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

  // ── Cross-channel Notifications ───────────────────────────────────

  static createCrossChannelNotifications(): NotificationProps[] {
    const ts = new Date().toISOString();
    const now = Date.now();
    const min = 60_000;
    const hour = 3_600_000;
    return [
      {
        id: 'ocn-1',
        type: 'mention',
        channel: 'lark',
        sender: { name: '王经理' },
        title: 'Lark · 王经理',
        body: '安全扫描报告已看过，什么时候可以开始下一阶段？',
        timestamp: ts,
        read: false,
        triageStatus: 'needs-human',
        externalId: 'lark-msg-001',
        roomId: 'lark-room-security',
        agentReaction: {
          summary: '常规进度询问，建议直接回复',
          draftReply: '您好王经理，安全扫描修复工作已安排本周内完成，预计周四前全部修复。下一阶段（渗透测试）计划周五启动，届时会同步通知您进度。',
          actionTaken: '已查看扫描报告，确认无新增高危项',
          confidence: 'high',
          reasoningSteps: [
            { label: '意图识别', detail: '王经理询问"下一阶段何时开始"，属于进度跟进类消息，不涉及技术决策' },
            { label: '上下文关联', detail: '对话历史显示安全扫描已完成，3 个高危修复排期已确认（SQL 注入优先），与"下一阶段"（渗透测试）衔接' },
            { label: '紧迫度评估', detail: '消息间隔 2 分钟，非紧急催促。客户审计在下周三，时间充裕' },
            { label: '建议生成', detail: '基于修复进度（周四完成）和渗透测试依赖关系（需修复完成后），建议周五启动下一阶段' },
          ],
          suggestedActions: [
            { id: 'sa-1-a', icon: 'send', label: '采纳回复', command: '采纳 Agent 建议的回复并发送' },
            { id: 'sa-1-b', icon: 'security', label: '查看漏洞修复进度', command: '查看当前安全漏洞修复的详细进度和剩余高危项' },
            { id: 'sa-1-c', icon: 'event_note', label: '安排渗透测试', command: '帮我安排渗透测试计划，确认环境依赖和执行时间' },
            { id: 'sa-1-d', icon: 'description', label: '生成进度报告', command: '生成安全加固项目进度报告，包含已完成和待办项' },
          ],
        },
        contextMessages: [
          { id: 'ctx-1-1', senderName: '王经理', body: '安全扫描什么时候能跑一下？上周客户那边提了要求', timestamp: now - 5 * hour, isOwn: false },
          { id: 'ctx-1-2', senderName: '你', body: '好的，我安排一下。目标环境是预发布还是生产？', timestamp: now - 4.5 * hour, isOwn: true },
          { id: 'ctx-1-3', senderName: '王经理', body: '预发布先跑，没问题再上生产', timestamp: now - 4 * hour, isOwn: false },
          { id: 'ctx-1-4', senderName: '你', body: '收到，预发布环境安全扫描已启动，预计 1 小时出报告', timestamp: now - 3.5 * hour, isOwn: true },
          { id: 'ctx-1-5', senderName: '你', body: '扫描完成，发现 3 个高危、7 个中危、12 个低危。详细报告已生成发送到您邮箱，请查收', timestamp: now - 2 * hour, isOwn: true },
          { id: 'ctx-1-6', senderName: '王经理', body: '好的，我抽时间看一下', timestamp: now - hour, isOwn: false },
          { id: 'ctx-1-7', senderName: '王经理', body: '报告里提到的 3 个高危漏洞，修复排期是怎样的？', timestamp: now - 30 * min, isOwn: false },
          { id: 'ctx-1-8', senderName: '你', body: '已安排本周内修复，预计周四前完成。高危项涉及：SQL 注入（API 层参数校验）、XSS（前端输入过滤）、CSRF Token 过期机制', timestamp: now - 25 * min, isOwn: true },
          { id: 'ctx-1-9', senderName: '王经理', body: 'SQL 注入那个优先级最高，能先修吗？客户审计下周三', timestamp: now - 10 * min, isOwn: false },
          { id: 'ctx-1-10', senderName: '你', body: '明白，SQL 注入修复优先提级到今天下午，明早前部署到预发布验证', timestamp: now - 5 * min, isOwn: true },
          { id: 'ctx-1-11', senderName: '王经理', body: '安全扫描报告已看过，什么时候可以开始下一阶段？', timestamp: now - 2 * min, isOwn: false },
        ],
      },
      {
        id: 'ocn-2',
        type: 'system',
        channel: 'email',
        sender: { name: '李工' },
        title: 'Email · 系统告警',
        body: '服务器证书即将过期，请尽快续签。\n\ndear 运维团队，\n\nprod-api.example.com 的 SSL 证书将于 2024-05-08 到期（剩余 7 天），届时将导致 HTTPS 服务不可用，影响全站访问。\n\n请尽快安排续签事宜。\n\n— 运维监控系统自动告警',
        timestamp: ts,
        read: false,
        triageStatus: 'needs-human',
        externalId: 'email-msg-042',
        emailMeta: {
          to: '运维团队 <ops@example.com>, 张工 <zhang@example.com>',
          cc: '技术总监 <cto@example.com>',
        },
        agentReaction: {
          summary: '涉及生产环境，建议人工决策续签方案',
          draftReply: '李工，收到告警。我这边建议使用 Let\'s Encrypt 自动续签，零成本且可靠。续签脚本已准备好，确认后立即执行。',
          actionTaken: '已检查证书状态：prod-api.example.com 剩余 7 天',
          confidence: 'medium',
          reasoningSteps: [
            { label: '告警解析', detail: 'prod-api.example.com SSL 证书 7 天后过期，涉及生产环境主域名，影响全站 HTTPS' },
            { label: '历史追溯', detail: '30 天前首次预警时，原管理人是已离职张工，阿里云账号已收回。续签方案尚未敲定' },
            { label: '方案评估', detail: '可选方案：① Let\'s Encrypt 自动续签（零成本，需部署 certbot）② 阿里云新账号申请（需运维主管授权）③ 商业证书采购' },
            { label: '风险判断', detail: '仅剩 7 天，方案③（采购）周期太长不现实。方案①最快但需确认团队对 Let\'s Encrypt 的接受度，建议人工决策' },
          ],
          suggestedActions: [
            { id: 'sa-2-a', icon: 'send', label: '采纳 Let\'s Encrypt 方案', command: '确认使用 Let\'s Encrypt 续签，立即部署 certbot 自动续签脚本' },
            { id: 'sa-2-b', icon: 'vpn_key', label: '申请商业证书', command: '走商业证书采购流程，联系运维主管授权阿里云 SSL 托管' },
            { id: 'sa-2-c', icon: 'monitor_heart', label: '检查所有证书', command: '全面检查所有服务域名证书到期情况，生成证书健康报告' },
            { id: 'sa-2-d', icon: 'schedule', label: '设置自动巡检', command: '配置证书到期自动巡检，提前 30 天告警通知负责人' },
          ],
        },
        contextMessages: [
          { id: 'ctx-2-1', senderName: '运维系统', body: '证书到期预警：prod-api.example.com SSL 证书将于 30 天后过期（2024-05-15）', timestamp: now - 7 * 24 * hour, isOwn: false },
          { id: 'ctx-2-2', senderName: '李工', body: '看到预警了，这个证书之前是谁在管理？', timestamp: now - 7 * 24 * hour + 30 * min, isOwn: false },
          { id: 'ctx-2-3', senderName: '你', body: '之前的证书是通过阿里云 SSL 托管申请的，我查一下账号信息', timestamp: now - 6 * 24 * hour, isOwn: true },
          { id: 'ctx-2-4', senderName: '你', body: '查到了，证书在阿里云控制台，但申请人是已离职的张工，账号已收回。需要用新账号重新申请', timestamp: now - 6 * 24 * hour + 2 * hour, isOwn: true },
          { id: 'ctx-2-5', senderName: '李工', body: '那就重新申请一个吧，你那边有权限操作吗？', timestamp: now - 3 * 24 * hour, isOwn: false },
          { id: 'ctx-2-6', senderName: '你', body: '我没有阿里云 SSL 托管的操作权限，需要运维主管授权。先把这事记一下', timestamp: now - 2 * 24 * hour, isOwn: true },
          { id: 'ctx-2-7', senderName: '运维系统', body: '证书到期预警升级：prod-api.example.com SSL 证书将于 7 天后过期（2024-05-08），请立即处理', timestamp: now - 3 * hour, isOwn: false },
          { id: 'ctx-2-8', senderName: '李工', body: '这个证书我没有续签权限，需要你来处理', timestamp: now - 2 * hour, isOwn: false },
          { id: 'ctx-2-9', senderName: '李工', body: '服务器证书即将过期，请尽快续签。', timestamp: now - 10 * min, isOwn: false },
        ],
      },
      {
        id: 'ocn-3',
        type: 'mention',
        channel: 'slack',
        sender: { name: '张总' },
        title: 'Slack · 张总',
        body: '预算审批已通过。',
        timestamp: ts,
        read: false,
        triageStatus: 'auto-handled',
        externalId: 'slack-msg-108',
        roomId: 'slack-channel-finance',
        agentReaction: {
          summary: '纯通知，无需处理',
          actionTaken: '已归档到「Q2 预算」文件夹',
          confidence: 'high',
          reasoningSteps: [
            { label: '意图识别', detail: '张总发送"预算审批已通过"，属于确认通知类消息，无需回复' },
            { label: '上下文关联', detail: '预算从 28 万经两轮协商降至 24.5 万，审批链路完整，当前消息为最终结果通知' },
            { label: '自动操作', detail: '已将审批通过的预算归档到「Q2 预算」文件夹，关联采购计划自动触发' },
          ],
          suggestedActions: [
            { id: 'sa-3-a', icon: 'shopping_cart', label: '启动采购流程', command: '根据审批通过的 24.5 万预算，启动 Q2 基础设施采购流程' },
            { id: 'sa-3-b', icon: 'list_alt', label: '查看预算明细', command: '查看 Q2 预算各项分配明细和采购优先级' },
          ],
        },
        contextMessages: [
          { id: 'ctx-3-1', senderName: '张总', body: 'Q1 的服务器资源快不够了，Q2 有没有扩容计划？', timestamp: now - 3 * 24 * hour, isOwn: false },
          { id: 'ctx-3-2', senderName: '你', body: '正在规划，主要需求是：API 集群扩容 2 节点、Redis 集群升级、新增 CDN 带宽。我整理一下预算', timestamp: now - 2 * 24 * hour, isOwn: true },
          { id: 'ctx-3-3', senderName: '你', body: '张总，Q2 基础设施升级预算申请已提交：API 节点 x2（12万）、Redis 升级（6万）、CDN 扩容（5万）、备用节点预留（5万），总计 28 万', timestamp: now - 5 * hour, isOwn: true },
          { id: 'ctx-3-4', senderName: '张总', body: '金额有点高，能压缩到 25 万以内吗？备用节点可以先不搞', timestamp: now - 4 * hour, isOwn: false },
          { id: 'ctx-3-5', senderName: '你', body: '好的，去掉备用节点预留 5 万，CDN 扩容从 5 万降到 3.5 万（按实际用量预估）。调整后 24.5 万', timestamp: now - 3.5 * hour, isOwn: true },
          { id: 'ctx-3-6', senderName: '你', body: '调整后 24.5 万，去掉了备用节点的预留，CDN 按实际用量估算', timestamp: now - 3 * hour, isOwn: true },
          { id: 'ctx-3-7', senderName: '张总', body: '行，我提交给财务审批', timestamp: now - 2 * hour, isOwn: false },
          { id: 'ctx-3-8', senderName: '张总', body: '预算审批已通过。采购流程下周启动。', timestamp: now - 5 * min, isOwn: false },
        ],
      },
      {
        id: 'ocn-4',
        type: 'mention',
        channel: 'lark',
        sender: { name: '刘主管' },
        title: 'Lark · 刘主管',
        body: '最新部署情况如何？客户那边在催。',
        timestamp: ts,
        read: false,
        triageStatus: 'needs-human',
        externalId: 'lark-msg-002',
        roomId: 'lark-room-deploy',
        agentReaction: {
          summary: '客户催促，紧急度较高',
          draftReply: '刘主管您好，当前部署进度 85%，预计明天下午 6 点前完成全部服务部署。如有紧急需求可以插队优先处理，请确认优先级。',
          actionTaken: '已检查部署状态：5/6 服务就绪',
          confidence: 'medium',
          reasoningSteps: [
            { label: '紧迫度识别', detail: '刘主管连续追问（4小时前、45分钟前、5分钟前），频率递增，且明确提到"客户在催"，判定为高紧急度' },
            { label: '进度核实', detail: '已检查实际部署状态：auth/user/order/payment 4 个服务已完成，仅剩 notify 正在部署，进度约 85%' },
            { label: '风险评估', detail: '客户要求月底上线（剩余约 28 天），当前进度正常。但 demo 在今天下午，payment 刚完成，可能需要即时验证' },
            { label: '建议生成', detail: '给出明确时间节点（明天下午 6 点前），同时提供插队选项让主管判断优先级，避免过度承诺' },
          ],
          suggestedActions: [
            { id: 'sa-4-a', icon: 'send', label: '采纳回复', command: '采纳 Agent 建议的回复并发送给刘主管' },
            { id: 'sa-4-b', icon: 'rocket_launch', label: '加速 notify 部署', command: '检查 notify 服务部署日志，确认是否有阻塞，尝试加速部署' },
            { id: 'sa-4-c', icon: 'fact_check', label: '生成部署报告', command: '生成 v2.3 版本部署状态报告，包含各服务健康检查结果' },
            { id: 'sa-4-d', icon: 'bug_report', label: '检查 P1 修复状态', command: '检查之前发现的 2 个 P1 bug 的修复验证情况' },
          ],
        },
        contextMessages: [
          { id: 'ctx-4-1', senderName: '刘主管', body: '客户那边的 v2.3 版本需求确认了吗？他们说这个月底必须上线', timestamp: now - 8 * hour, isOwn: false },
          { id: 'ctx-4-2', senderName: '你', body: '需求确认了，开发上周就完成了。正在做集成测试，发现了 2 个 P1 级别 bug', timestamp: now - 7 * hour, isOwn: true },
          { id: 'ctx-4-3', senderName: '刘主管', body: 'P1 bug 什么时候能修？客户催得很紧', timestamp: now - 6 * hour, isOwn: false },
          { id: 'ctx-4-4', senderName: '你', body: '一个今天下午修，另一个需要后端配合，明天上午出修复', timestamp: now - 5.5 * hour, isOwn: true },
          { id: 'ctx-4-5', senderName: '刘主管', body: '昨天说的那个版本什么时候能上？', timestamp: now - 4 * hour, isOwn: false },
          { id: 'ctx-4-6', senderName: '你', body: '今天下午开始部署，预计明天完成。部署顺序：auth → user → order → payment → notify', timestamp: now - 3.5 * hour, isOwn: true },
          { id: 'ctx-4-7', senderName: '你', body: '部署进度更新：auth、user、order 已完成，payment 部署中（配置数据库连接池），预计 1 小时内完成', timestamp: now - 1.5 * hour, isOwn: true },
          { id: 'ctx-4-8', senderName: '刘主管', body: '客户说下午要 demo，payment 能不能先搞定？', timestamp: now - 45 * min, isOwn: false },
          { id: 'ctx-4-9', senderName: '你', body: 'payment 已完成，正在部署 notify 服务，还剩最后一个', timestamp: now - 20 * min, isOwn: true },
          { id: 'ctx-4-10', senderName: '刘主管', body: '最新部署情况如何？客户那边在催。', timestamp: now - 5 * min, isOwn: false },
        ],
      },
    ];
  }

  // ── System Health ─────────────────────────────────────────────────

  static createSystemHealth(runtimes: AgentRuntime[]): SystemHealthSnapshot {
    return AgentOrchestrationService.computeSystemHealth(runtimes);
  }

  // ── Agent Greeting Messages ───────────────────────────────────────

  static getAgentGreeting(agentId: string): CoTMessage[] {
    const sessionId = `mock-session-${agentId}`;
    const now = Date.now();

    const greetings: Record<string, () => CoTMessage[]> = {
      'sa-1': () => {
        const cotSteps: CoTStep[] = [
          {
            id: 'step-1', label: '扫描仓库', status: 'done',
            detail: '已扫描 auth-service.js 共 342 行，发现 5 处可疑代码段',
            toolCalls: [
              {
                id: 'tc-1-1', name: '代码扫描器', icon: 'search_code', status: 'done',
                input: '扫描 auth-service.js — 安全漏洞模式匹配',
                result: '扫描 342 行，命中 5 处可疑模式：2 处 SQL 拼接、1 处 eval()、1 处未转义输出、1 处硬编码密钥',
              },
              {
                id: 'tc-1-2', name: 'Git 历史分析', icon: 'history', status: 'done',
                input: '检索 auth-service.js 近 30 天修改记录',
                result: '最近 3 次提交涉及认证逻辑变更，最后修改者: dev-wang，日期: 2 天前',
              },
            ],
          },
          {
            id: 'step-2', label: '检索知识库', status: 'done',
            detail: '匹配到 OWASP Top 10 规则，3 项高危命中',
            knowledgeRefs: [
              {
                id: 'kr-2-1', name: 'OWASP Top 10', icon: 'menu_book', status: 'done',
                query: '检索 SQL 注入、XSS、认证绕过防御规则',
                result: '匹配到 A01:2021-Broken Access Control、A03:2021-Injection、A07:2021-XSS 三项规则',
                source: 'OWASP 安全知识库 v2021',
                citations: [
                  { title: 'A01:2021 — Broken Access Control', type: 'regulation', snippet: '94% 的应用存在某种形式的访问控制缺陷' },
                  { title: 'A03:2021 — Injection', type: 'regulation', snippet: 'SQL/NoSQL/OS/LDAP 注入，通过参数化查询防御' },
                  { title: 'A07:2021 — XSS', type: 'regulation', snippet: '反射型/存储型/DOM型 XSS，需输出编码+CSP' },
                ],
              },
              {
                id: 'kr-2-2', name: '内部安全规范', icon: 'shield', status: 'done',
                query: '检索公司安全编码规范 — 认证模块',
                result: '认证模块必须使用参数化查询，禁止 eval()，密钥须走 Vault 管理',
                source: '内部安全编码规范 v3.2',
                citations: [
                  { title: '安全编码规范 v3.2 — 认证模块', type: 'sop', snippet: '所有 SQL 操作必须使用参数化查询，禁止字符串拼接' },
                  { title: '密钥管理规范', type: 'sop', snippet: '生产环境密钥一律通过 Vault 注入，禁止硬编码' },
                ],
              },
            ],
          },
          {
            id: 'step-3', label: '生成建议', status: 'running',
            detail: '正在综合扫描结果与安全规范生成修复建议...',
            toolCalls: [
              {
                id: 'tc-3-1', name: 'AI 代码修复', icon: 'auto_fix_high', status: 'running',
                input: '基于 5 处漏洞 + OWASP 规则生成修复 patch',
              },
            ],
          },
        ];
        const blocks: MessageBlock[] = [
          { type: 'task-card', taskId: 'task-2' },
          { type: 'source-ref', sourceId: 'src-owasp', title: 'OWASP Top 10 安全规则', snippet: '检测到 3 项高危风险：SQL 注入、XSS、认证绕过' },
        ];
        return [
          CoTMessage.create({
            id: `${agentId}-user-1`,
            agentId,
            sessionId,
            role: 'user',
            text: '请对 auth-service.js 进行安全审计',
            timestamp: now - 60_000,
          }),
          CoTMessage.create({
            id: `${agentId}-agent-1`,
            agentId,
            sessionId,
            role: 'agent',
            text: '正在分析 auth-service.js 的安全状况...',
            timestamp: now - 30_000,
            cotSteps,
            blocks,
          }),
        ];
      },

      'sa-2': () => [
        CoTMessage.create({
          id: `${agentId}-agent-1`,
          agentId,
          sessionId,
          role: 'agent',
          text: '你好！我是文档写手，可以帮你撰写 PRD、API 文档和技术方案。有什么需要帮忙的吗？',
          timestamp: now,
        }),
      ],

      'sa-3': () => [
        CoTMessage.create({
          id: `${agentId}-agent-1`,
          agentId,
          sessionId,
          role: 'agent',
          text: '你好！我是数据分析师，擅长 SQL 生成、数据可视化和报表分析。以下是当前系统关键指标概览：',
          timestamp: now,
          blocks: [
            {
              type: 'kpi',
              items: [
                { label: '日活跃用户', value: '12,450', trend: 'up' },
                { label: '平均响应时间', value: '142ms', trend: 'down' },
                { label: 'API 成功率', value: '99.7%', trend: 'flat' },
                { label: '今日告警', value: '3', trend: 'up' },
              ],
            },
          ],
        }),
      ],

      'sa-5': () => [
        CoTMessage.create({
          id: `${agentId}-agent-1`,
          agentId,
          sessionId,
          role: 'agent',
          text: '你好！我是测试工程师，可以帮你生成单元测试、集成测试和 E2E 测试用例。请提供需要测试的模块信息。',
          timestamp: now,
        }),
      ],

      'sa-6': () => [
        CoTMessage.create({
          id: `${agentId}-agent-1`,
          agentId,
          sessionId,
          role: 'agent',
          text: '你好！我是运维助手，擅长 Docker、K8s 和 CI/CD 配置。当前系统运行正常，有什么需要帮忙的吗？',
          timestamp: now,
        }),
      ],

      'sa-8': () => [
        CoTMessage.create({
          id: `${agentId}-agent-1`,
          agentId,
          sessionId,
          role: 'agent',
          text: '你好！我是安全审计员，负责代码安全审计和漏洞扫描。当前有一项漏洞扫描任务正在执行中。',
          timestamp: now,
        }),
      ],
    };

    const factory = greetings[agentId];
    if (factory) return factory();

    // Default generic greeting
    return [
      CoTMessage.create({
        id: `${agentId}-agent-default`,
        agentId,
        sessionId,
        role: 'agent',
        text: '你好！我是你的 AI 助手，有什么可以帮你的吗？',
        timestamp: now,
      }),
    ];
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

  // ── Quick Commands (from WelcomePage) ─────────────────────────────

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

  // ── Decision Trees (因果决策树) ─────────────────────────────────────

  static getDecisionTrees(): DecisionTree[] {
    return [
      DecisionTree.create({
        activityId: 'pa-1',
        nodes: [
          { id: 'dt1-t', type: 'trigger', label: '定时触发', detail: '每日 02:00 安全巡检计划自动启动', status: 'completed' },
          { id: 'dt1-r', type: 'reasoning', label: '风险评估', detail: '扫描 12 个服务端点，匹配 CVE 数据库 + 47 条内部安全规则', status: 'completed', metadata: { endpoints: '12', rules: '47' } },
          { id: 'dt1-a', type: 'action', label: '自动修复', detail: '2 个中危漏洞已生成修复 PR (#342, #343)，已自动分配 reviewer', status: 'completed', metadata: { prs: '#342, #343' } },
          { id: 'dt1-o', type: 'outcome', label: '评估结果', detail: '0 高危 / 2 中危已修复 / 安全评分 A → A+', status: 'completed' },
        ],
        followUpActions: [
          { id: 'fu-1-1', label: '查看修复 PR', icon: 'code', actionType: 'approve' },
          { id: 'fu-1-2', label: '提升扫描频率', icon: 'speed', actionType: 'modify' },
          { id: 'fu-1-3', label: '忽略中危', icon: 'do_not_disturb', actionType: 'dismiss' },
        ],
        confidence: 95,
      }),
      DecisionTree.create({
        activityId: 'pa-2',
        nodes: [
          { id: 'dt2-t', type: 'trigger', label: '异常检测', detail: '/api/v1/documents P99 从 120ms 升至 340ms，超出阈值 200ms', status: 'completed', metadata: { threshold: '200ms', actual: '340ms' } },
          { id: 'dt2-r', type: 'reasoning', label: '根因定位', detail: '关联分析: DB 连接池使用率 92%、慢查询增加 3 倍、最近部署无变更', status: 'completed' },
          { id: 'dt2-a', type: 'action', label: '告警通知', detail: '已通过飞书通知研发部 @张工、@李工，附根因分析报告', status: 'completed' },
          { id: 'dt2-o', type: 'outcome', label: '等待处理', detail: '告警已送达，等待研发确认处理方案', status: 'active' },
        ],
        followUpActions: [
          { id: 'fu-2-1', label: '查看分析报告', icon: 'assessment', actionType: 'approve' },
          { id: 'fu-2-2', label: '临时扩容', icon: 'add_circle', actionType: 'escalate' },
          { id: 'fu-2-3', label: '调整阈值', icon: 'tune', actionType: 'modify' },
        ],
        confidence: 88,
      }),
      DecisionTree.create({
        activityId: 'pa-3',
        nodes: [
          { id: 'dt3-t', type: 'trigger', label: '性能监控', detail: '检测到 3 条慢查询 (>500ms)，来自 orders 和 inventory 表', status: 'completed' },
          { id: 'dt3-r', type: 'reasoning', label: '索引分析', detail: '缺少复合索引 (user_id, created_at)，全表扫描导致 IO 飙升', status: 'completed', metadata: { tables: 'orders, inventory', scanType: 'full' } },
          { id: 'dt3-a', type: 'action', label: '生成优化', detail: '已生成 3 条 CREATE INDEX DDL，提交技术评审', status: 'completed' },
          { id: 'dt3-o', type: 'outcome', label: '待审核', detail: '预计优化后查询时间降低 80%，等待 DBA 审核', status: 'active' },
        ],
        followUpActions: [
          { id: 'fu-3-1', label: '审核 DDL', icon: 'fact_check', actionType: 'approve' },
          { id: 'fu-3-2', label: '先在测试环境验证', icon: 'science', actionType: 'modify' },
          { id: 'fu-3-3', label: '暂不处理', icon: 'schedule', actionType: 'dismiss' },
        ],
        confidence: 92,
      }),
      DecisionTree.create({
        activityId: 'pa-4',
        nodes: [
          { id: 'dt4-t', type: 'trigger', label: '会议录音', detail: '检测到 10:00 产品周会录音文件 (52 分钟)', status: 'completed' },
          { id: 'dt4-r', type: 'reasoning', label: '语义分析', detail: 'ASR 转写 → NLP 摘要提取：5 项决议、8 个待办、2 个分歧点', status: 'completed' },
          { id: 'dt4-a', type: 'action', label: '同步分发', detail: '纪要已推送到飞书文档，待办已创建到 JIRA 看板', status: 'completed' },
          { id: 'dt4-o', type: 'outcome', label: '已完成', detail: '5 项决议已归档，8 个待办已分配到责任人', status: 'completed' },
        ],
        followUpActions: [
          { id: 'fu-4-1', label: '查看纪要', icon: 'description', actionType: 'approve' },
          { id: 'fu-4-2', label: '补充遗漏', icon: 'edit_note', actionType: 'modify' },
        ],
        confidence: 85,
      }),
      DecisionTree.create({
        activityId: 'pa-5',
        nodes: [
          { id: 'dt5-t', type: 'trigger', label: '定时汇总', detail: '每日 17:30 自动汇总工作进展', status: 'completed' },
          { id: 'dt5-r', type: 'reasoning', label: '数据聚合', detail: '采集 Git 提交 12 次、JIRA 状态变更 5 条、文档更新 3 篇', status: 'completed', metadata: { commits: '12', jira: '5', docs: '3' } },
          { id: 'dt5-a', type: 'action', label: '生成日报', detail: '已按模板生成日报草稿，包含工作量统计和明日计划', status: 'completed' },
          { id: 'dt5-o', type: 'outcome', label: '待确认', detail: '草稿已生成，等待你确认后发送', status: 'active' },
        ],
        followUpActions: [
          { id: 'fu-5-1', label: '确认发送', icon: 'send', actionType: 'approve' },
          { id: 'fu-5-2', label: '编辑修改', icon: 'edit', actionType: 'modify' },
          { id: 'fu-5-3', label: '今日不发', icon: 'cancel', actionType: 'reject' },
        ],
        confidence: 78,
      }),
    ];
  }

  // ── Collaboration Chains (跨 Agent 协作链) ─────────────────────────

  static getCollaborationChains(): CollaborationChain[] {
    const now = Date.now();
    return [
      CollaborationChain.create({
        id: 'chain-1',
        name: '安全漏洞修复链',
        description: '安全审计发现 CVE-2024-1234 → 运维隔离受影响服务 → 开发生成修复 PR',
        nodes: [
          { id: 'c1-n1', agentId: 'sa-8', agentName: '安全审计员', agentCategory: 'security', taskSummary: '扫描发现 CVE-2024-1234 高危漏洞，影响 auth-service', status: 'completed', startedAt: now - 300_000, completedAt: now - 240_000, outputSummary: 'CVE-2024-1234: auth-service JWT 验证绕过' },
          { id: 'c1-n2', agentId: 'sa-6', agentName: '运维助手', agentCategory: 'ops', taskSummary: '评估影响范围，隔离受影响服务实例 (2/5 节点)', status: 'completed', startedAt: now - 240_000, completedAt: now - 180_000, outputSummary: '已隔离 node-3, node-5，流量切换到健康节点' },
          { id: 'c1-n3', agentId: 'sa-1', agentName: '代码开发', agentCategory: 'dev', taskSummary: '生成 JWT 验证修复 patch，创建 PR #347', status: 'active', startedAt: now - 180_000 },
        ],
        edges: [
          { fromNodeId: 'c1-n1', toNodeId: 'c1-n2', label: '发现漏洞 → 隔离服务', dataPayload: 'CVE-2024-1234 详情 + 受影响服务列表' },
          { fromNodeId: 'c1-n2', toNodeId: 'c1-n3', label: '隔离完成 → 生成修复', dataPayload: '隔离状态 + 代码定位: auth-service/jwt.ts:42' },
        ],
        triggeredAt: now - 300_000,
        status: 'running',
      }),
      CollaborationChain.create({
        id: 'chain-2',
        name: '性能异常处理链',
        description: '运维监测 P99 飙升 → 数据分析师定位根因 → 开发优化查询',
        nodes: [
          { id: 'c2-n1', agentId: 'sa-6', agentName: '运维助手', agentCategory: 'ops', taskSummary: '监测到 /api/v1/documents P99 延迟从 120ms 飙升至 340ms', status: 'completed', startedAt: now - 500_000, completedAt: now - 450_000, outputSummary: '异常时段: 14:20-14:35, 受影响接口 3 个' },
          { id: 'c2-n2', agentId: 'sa-3', agentName: '数据分析师', agentCategory: 'data', taskSummary: '分析根因: DB 连接池饱和 + orders 表全表扫描', status: 'completed', startedAt: now - 450_000, completedAt: now - 380_000, outputSummary: '根因: 缺少 (user_id, created_at) 复合索引' },
          { id: 'c2-n3', agentId: 'sa-1', agentName: '代码开发', agentCategory: 'dev', taskSummary: '优化查询 + 调整连接池参数 + 创建索引', status: 'completed', startedAt: now - 380_000, completedAt: now - 320_000, outputSummary: 'PR #345: 添加索引 + 连接池 max 50→100' },
        ],
        edges: [
          { fromNodeId: 'c2-n1', toNodeId: 'c2-n2', label: '延迟告警 → 根因分析', dataPayload: '异常指标快照 + 时间窗口' },
          { fromNodeId: 'c2-n2', toNodeId: 'c2-n3', label: '根因定位 → 代码修复', dataPayload: '慢查询 SQL + 索引建议' },
        ],
        triggeredAt: now - 500_000,
        status: 'completed',
      }),
    ];
  }

  static simulateChainProgress(
    onUpdate: (chainId: string, nodeId: string, status: 'completed' | 'active') => void,
  ): () => void {
    // Simulate chain-1 node c1-n3 completing after 15 seconds
    const timer = setTimeout(() => {
      onUpdate('chain-1', 'c1-n3', 'completed');
    }, 15_000);
    return () => clearTimeout(timer);
  }

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
    // Exact match
    const exact = this.MOCK_RESPONSES[userText];
    if (exact) return exact;

    // Keyword match
    for (const [key, resp] of Object.entries(this.MOCK_RESPONSES)) {
      if (userText.includes(key)) return resp;
    }

    // Default response — with mock reasoning chain
    return {
      text: `好的，我已收到你的指令：「${userText}」\n\n**分析完成**：我会根据当前上下文自动匹配最合适的 Agent 来执行。处理过程中如果有需要你确认的决策点，我会以卡片形式推送给你。\n\n预计处理时间：3-5 分钟。如有紧急情况，我会主动通知。`,
      cotSteps: [
        { id: `s-${Date.now()}-1`, label: '意图解析', status: 'done', detail: `用户指令：「${userText.slice(0, 40)}${userText.length > 40 ? '…' : ''}」— 检测到常规指令类型` },
        { id: `s-${Date.now()}-2`, label: '上下文检索', status: 'done', detail: '关联 3 条近期消息 + 2 个活跃任务，上下文完整' },
        { id: `s-${Date.now()}-3`, label: 'Agent 匹配', status: 'done', detail: '已路由到对应能力 Agent，等待确认执行' },
      ],
    };
  }

  // ── Decision Requests ────────────────────────────────────────────────

  static createDecisionRequests(): DecisionRequest[] {
    const now = Date.now();
    const hour = 3_600_000;
    return [
      DecisionRequest.create({
        id: 'dec-1',
        agentId: 'ops-assistant',
        title: 'API 延迟异常，建议紧急扩容',
        context: '过去 30 分钟内，API P99 延迟从 120ms 飙升至 340ms，错误率从 0.01% 升至 0.3%。根因分析：DB 连接池已饱和（当前 50/50），主库 CPU 92%。预估 15 分钟后服务不可用。',
        recommendation: {
          id: 'opt-1a',
          label: '临时扩容至 5 节点',
          description: '立即将服务节点从 3 扩容至 5，同时将 DB 连接池上限提升至 100',
          reasoning: '延迟飙升的根因是连接池饱和，扩容可以快速缓解压力。5 节点足以应对当前 2x 的流量峰值。',
          estimatedImpact: '预计延迟降至 80ms，错误率恢复至 0.01% 以下',
          riskLevel: 'low',
        },
        alternatives: [
          {
            id: 'opt-1b',
            label: '仅提升 DB 连接池',
            description: '不扩容节点，仅将 DB 连接池从 50 提升至 100',
            reasoning: '可能是更轻量的方案，但需要确认 DB 实例是否能承受更高的连接数',
            estimatedImpact: '延迟可能降至 200ms，但不一定能完全恢复',
            riskLevel: 'medium',
          },
        ],
        urgency: 'critical',
        deadline: now + 10 * 60_000, // 10 minutes
        responseStatus: 'pending',
        createdAt: now - 2 * 60_000,
      }),
      DecisionRequest.create({
        id: 'dec-2',
        agentId: 'security-agent',
        title: '发现新的高危依赖漏洞，建议立即升级',
        context: '例行依赖扫描发现 log4j-core 2.14.1 存在 CVE-2023-44487（CVSS 9.8），当前有 3 个服务使用该版本。补丁版本 log4j-core 2.17.1 已可用。',
        recommendation: {
          id: 'opt-2a',
          label: '立即升级到 2.17.1',
          description: '创建紧急 PR 升级所有 3 个服务的 log4j-core 依赖，通过 CI 验证后合并部署',
          reasoning: '该漏洞 CVSS 9.8，已被确认为在野利用。log4j-core 2.17.1 修复了该漏洞且向后兼容。',
          estimatedImpact: '预计 2 小时内完成升级和部署，需要短暂重启 3 个服务',
          riskLevel: 'low',
        },
        alternatives: [
          {
            id: 'opt-2b',
            label: '今日低峰期升级',
            description: '等到今晚 22:00 低峰期再执行升级',
            reasoning: '低峰期重启风险更低，但漏洞在野利用窗口更长',
            estimatedImpact: '今晚 23:00 前完成，风险降低但暴露时间延长 6 小时',
            riskLevel: 'medium',
          },
        ],
        urgency: 'high',
        deadline: now + 2 * hour,
        responseStatus: 'pending',
        createdAt: now - 30 * 60_000,
      }),
    ];
  }

  // ── User Goals ────────────────────────────────────────────────────────

  static readonly GOAL_KEYWORDS: Record<string, { title: string; description: string; milestones: Array<{ name: string }> }> = {
    '安全加固': {
      title: '安全加固',
      description: '完成系统安全漏洞的全面排查和修复。',
      milestones: [{ name: '漏洞扫描' }, { name: '高危修复' }, { name: '安全验证' }],
    },
    '性能优化': {
      title: '性能优化',
      description: '优化系统性能至 SLA 标准水平。',
      milestones: [{ name: '基线测量' }, { name: '瓶颈分析' }, { name: '优化实施' }, { name: '回归验证' }],
    },
    '系统迁移': {
      title: '系统迁移',
      description: '完成系统从旧架构到新架构的迁移。',
      milestones: [{ name: '环境准备' }, { name: '数据迁移' }, { name: '服务切换' }, { name: '旧系统下线' }],
    },
  };

  static detectGoalIntent(text: string): string | null {
    return Object.keys(this.GOAL_KEYWORDS).find((kw) => text.includes(kw)) ?? null;
  }

  static createGoalFromIntent(
    agentId: string,
    intent: string,
    _userText: string,
  ): UserGoal {
    const config = this.GOAL_KEYWORDS[intent] ?? {
      title: intent,
      description: `完成 ${intent} 相关工作。`,
      milestones: [{ name: '准备阶段' }, { name: '执行阶段' }, { name: '验证阶段' }],
    };

    const now = Date.now();
    const milestones = config.milestones.map((m, i) => ({
      id: `ms-${Date.now()}-${i}`,
      name: m.name,
      status: (i === 0 ? 'active' : 'pending') as 'active' | 'pending',
      relatedTaskIds: [] as string[],
    }));

    return UserGoal.create({
      id: `goal-${Date.now()}`,
      title: config.title,
      description: config.description,
      priority: 'normal',
      status: 'active',
      deadline: now + 14 * 86_400_000,
      milestones,
      progressUpdates: [
        { timestamp: now, agentId, message: `目标已创建：${config.title}` },
      ],
      relatedTaskIds: [],
      relatedDecisionIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static getDefaultGoals(): UserGoal[] {
    const now = Date.now();
    const day = 86_400_000;
    return [
      UserGoal.create({
        id: 'goal-1',
        title: '完成 Q2 安全加固',
        description: '在月底前完成所有高危和中危漏洞的修复，确保安全评分达到 A+ 级别。',
        priority: 'high',
        status: 'active',
        deadline: now + 14 * day,
        milestones: [
          { id: 'ms-1a', name: '高危漏洞修复', status: 'completed', completedAt: now - 3 * day, relatedTaskIds: ['task-2'] },
          { id: 'ms-1b', name: '中危漏洞修复', status: 'active', relatedTaskIds: [] },
          { id: 'ms-1c', name: '安全评分验证', status: 'pending', relatedTaskIds: [] },
        ],
        progressUpdates: [
          { timestamp: now - 5 * day, agentId: 'sa-8', message: '目标已创建，开始排查高危漏洞' },
          { timestamp: now - 3 * day, agentId: 'sa-8', message: '3 个高危漏洞已全部修复并通过验证', milestoneId: 'ms-1a' },
          { timestamp: now - 1 * day, agentId: 'sa-8', message: '中危漏洞修复中，已完成 2/5', milestoneId: 'ms-1b' },
        ],
        relatedTaskIds: ['task-2'],
        relatedDecisionIds: ['dec-2'],
        createdAt: now - 5 * day,
        updatedAt: now - 1 * day,
      }),
      UserGoal.create({
        id: 'goal-2',
        title: '提升 API 性能至 SLA 标准',
        description: '将核心 API 的 P99 延迟降至 150ms 以下，错误率控制在 0.05% 以内。',
        priority: 'critical',
        status: 'active',
        deadline: now + 7 * day,
        milestones: [
          { id: 'ms-2a', name: '性能基线测量', status: 'completed', completedAt: now - 2 * day, relatedTaskIds: [] },
          { id: 'ms-2b', name: '数据库索引优化', status: 'active', relatedTaskIds: [] },
          { id: 'ms-2c', name: '连接池扩容', status: 'pending', relatedTaskIds: [] },
          { id: 'ms-2d', name: '回归验证', status: 'pending', relatedTaskIds: [] },
        ],
        progressUpdates: [
          { timestamp: now - 3 * day, agentId: 'sa-6', message: '目标已创建，开始性能基线测量' },
          { timestamp: now - 2 * day, agentId: 'sa-6', message: '基线完成：P99 340ms, 错误率 0.3%，严重超标', milestoneId: 'ms-2a' },
          { timestamp: now - 12 * 60_000, agentId: 'sa-6', message: '索引优化 DDL 已提交审核', milestoneId: 'ms-2b' },
        ],
        relatedTaskIds: [],
        relatedDecisionIds: ['dec-1'],
        createdAt: now - 3 * day,
        updatedAt: now - 12 * 60_000,
      }),
    ];
  }

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

      // Pick up a backlog card
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

      // Add logs to in-progress cards
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

      // Move in-progress to review
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

      // Move review to done
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
