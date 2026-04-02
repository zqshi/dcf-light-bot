/**
 * CollaborationChain — 跨 Agent 协作链值对象
 *
 * 表示多个 Agent 之间的任务委托和数据传递链路。
 * 例：安全审计员发现漏洞 → 运维助手隔离服务 → 代码开发生成修复 PR
 */

export type HandoffStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ChainNode {
  id: string;
  agentId: string;
  agentName: string;
  agentCategory: string;
  taskSummary: string;
  status: HandoffStatus;
  startedAt: number;
  completedAt?: number;
  outputSummary?: string;
}

export interface ChainEdge {
  fromNodeId: string;
  toNodeId: string;
  label: string;
  dataPayload?: string;
}

export interface CollaborationChainProps {
  id: string;
  name: string;
  description: string;
  nodes: ChainNode[];
  edges: ChainEdge[];
  triggeredAt: number;
  status: 'running' | 'completed' | 'failed';
}

export class CollaborationChain {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodes: readonly ChainNode[];
  readonly edges: readonly ChainEdge[];
  readonly triggeredAt: number;
  readonly status: 'running' | 'completed' | 'failed';

  private constructor(props: CollaborationChainProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.nodes = props.nodes;
    this.edges = props.edges;
    this.triggeredAt = props.triggeredAt;
    this.status = props.status;
  }

  static create(props: CollaborationChainProps): CollaborationChain {
    return new CollaborationChain(props);
  }

  get activeNode(): ChainNode | undefined {
    return this.nodes.find((n) => n.status === 'active');
  }

  get completedCount(): number {
    return this.nodes.filter((n) => n.status === 'completed').length;
  }

  get progress(): number {
    return Math.round((this.completedCount / this.nodes.length) * 100);
  }

  withNodeStatus(nodeId: string, status: HandoffStatus): CollaborationChain {
    const now = Date.now();
    return new CollaborationChain({
      ...this.toProps(),
      nodes: this.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, status, ...(status === 'completed' ? { completedAt: now } : {}) }
          : n,
      ),
    });
  }

  withStatus(status: 'running' | 'completed' | 'failed'): CollaborationChain {
    return new CollaborationChain({ ...this.toProps(), status });
  }

  private toProps(): CollaborationChainProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: [...this.nodes],
      edges: [...this.edges],
      triggeredAt: this.triggeredAt,
      status: this.status,
    };
  }
}
