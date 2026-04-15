import { DecisionTree } from '../../domain/agent/DecisionTree';
import { CollaborationChain } from '../../domain/agent/CollaborationChain';
import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';

export function getDecisionTrees(): DecisionTree[] {
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

export function getCollaborationChains(): CollaborationChain[] {
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

export function simulateChainProgress(
  onUpdate: (chainId: string, nodeId: string, status: 'completed' | 'active') => void,
): () => void {
  const timer = setTimeout(() => {
    onUpdate('chain-1', 'c1-n3', 'completed');
  }, 15_000);
  return () => clearTimeout(timer);
}

export function createDecisionRequests(): DecisionRequest[] {
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
      deadline: now + 10 * 60_000,
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

export const GOAL_KEYWORDS: Record<string, { title: string; description: string; milestones: Array<{ name: string }> }> = {
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

export function detectGoalIntent(text: string): string | null {
  return Object.keys(GOAL_KEYWORDS).find((kw) => text.includes(kw)) ?? null;
}

export function createGoalFromIntent(
  agentId: string,
  intent: string,
  _userText: string,
): UserGoal {
  const config = GOAL_KEYWORDS[intent] ?? {
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

export function getDefaultGoals(): UserGoal[] {
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
