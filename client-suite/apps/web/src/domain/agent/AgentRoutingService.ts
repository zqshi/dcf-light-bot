import type { Agent } from './Agent';
import type { CapabilityTemplate } from './CapabilityTemplate';
import type { CapabilityRegistry } from './CapabilityRegistry';

export type RouteResult =
  | { action: 'reuse'; agent: Agent; template: CapabilityTemplate }
  | { action: 'create'; template: CapabilityTemplate };

export interface DetectedIntent {
  templateId: string;
  confidence: number;
}

const INTENT_PATTERNS: Array<{ templateId: string; keywords: RegExp }> = [
  { templateId: 'cap-security', keywords: /审计|漏洞|安全|CVE|扫描安全|渗透|合规/ },
  { templateId: 'cap-dev', keywords: /代码|开发|编程|重构|debug|编译|函数|API|接口开发/ },
  { templateId: 'cap-docs', keywords: /文档|写作|撰写|说明书|README|wiki/ },
  { templateId: 'cap-data', keywords: /数据|分析|报表|统计|可视化|指标|SQL/ },
  { templateId: 'cap-design', keywords: /设计|UI|UX|原型|界面|视觉|Figma/ },
  { templateId: 'cap-test', keywords: /测试|单测|e2e|质量|QA|Bug|回归/ },
  { templateId: 'cap-ops', keywords: /部署|运维|监控|CI|CD|Docker|K8s|告警/ },
  { templateId: 'cap-translate', keywords: /翻译|本地化|i18n|多语言|国际化/ },
];

/**
 * AgentRoutingService — 纯域服务，从用户输入推断能力意图并决定路由
 */
export class AgentRoutingService {
  /**
   * 从用户输入文本推断需要调用的能力
   * 返回 null 表示通用对话，无需路由到特定能力
   */
  static detectIntent(text: string): DetectedIntent | null {
    for (const { templateId, keywords } of INTENT_PATTERNS) {
      const match = text.match(keywords);
      if (match) {
        return { templateId, confidence: 0.8 };
      }
    }
    return null;
  }

  /**
   * 根据意图和注册表决定路由：
   * - 已有对应 agent → reuse
   * - 没有 → create（调用方负责实际创建和注册）
   */
  static route(
    intent: DetectedIntent,
    registry: CapabilityRegistry,
  ): RouteResult | null {
    const template = registry.findTemplate(intent.templateId);
    if (!template) return null;

    const existing = registry.getActiveAgent(intent.templateId);
    if (existing) {
      return { action: 'reuse', agent: existing, template };
    }
    return { action: 'create', template };
  }
}
