import type {
  AgentPersonality,
  AgentStatus,
  AgentCategory,
  ModelId,
  UserId,
} from '../shared/types';

export interface AgentProps {
  id: string;
  name: string;
  role: string;
  department: string;
  personality: AgentPersonality;
  model: ModelId;
  status?: AgentStatus;
  category?: AgentCategory;
  employeeId?: string;
  email?: string;
  invokeCount?: number;
  creatorId?: UserId;
  createdAt?: number;
  description?: string;
  avatarGradient?: string;
}

export class Agent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly department: string;
  readonly personality: AgentPersonality;
  readonly model: ModelId;
  readonly status: AgentStatus;
  readonly category?: AgentCategory;
  readonly employeeId: string;
  readonly email: string;
  readonly invokeCount: number;
  readonly creatorId?: UserId;
  readonly createdAt: number;
  readonly description?: string;
  readonly avatarGradient?: string;

  private constructor(props: AgentProps) {
    this.id = props.id;
    this.name = props.name;
    this.role = props.role;
    this.department = props.department;
    this.personality = props.personality;
    this.model = props.model;
    this.status = props.status ?? 'online';
    this.category = props.category;
    this.employeeId = props.employeeId ?? Agent.generateEmployeeId();
    this.email = props.email ?? `${props.id}@dcf.local`;
    this.invokeCount = props.invokeCount ?? 0;
    this.creatorId = props.creatorId;
    this.createdAt = props.createdAt ?? Date.now();
    this.description = props.description;
    this.avatarGradient = props.avatarGradient;
  }

  static create(props: AgentProps): Agent {
    return new Agent(props);
  }

  private static generateEmployeeId(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `DCF-${num}`;
  }

  withInvoke(): Agent {
    return new Agent({
      ...this.toProps(),
      invokeCount: this.invokeCount + 1,
    });
  }

  private toProps(): AgentProps {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      department: this.department,
      personality: this.personality,
      model: this.model,
      status: this.status,
      category: this.category,
      employeeId: this.employeeId,
      email: this.email,
      invokeCount: this.invokeCount,
      creatorId: this.creatorId,
      createdAt: this.createdAt,
      description: this.description,
      avatarGradient: this.avatarGradient,
    };
  }
}
