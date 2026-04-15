import { CoTMessage, type CoTStep } from '../../domain/agent/CoTMessage';
import type { MessageBlock } from '../../domain/agent/MessageBlock';
import type { NotificationProps } from '../../domain/notification/Notification';

export { createCrossChannelNotifications, getAgentGreeting };
function createCrossChannelNotifications(): NotificationProps[] {
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

function getAgentGreeting(agentId: string): CoTMessage[] {
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

