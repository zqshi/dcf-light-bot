/**
 * UserGoal — 用户目标实体
 *
 * 管理者模式下，用户设定的高层目标。
 * Agent 在执行过程中推进里程碑、追加进展，驱动自主完成。
 */
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived' | 'cancelled';
export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';
export type MilestoneStatus = 'pending' | 'active' | 'completed';

export interface GoalMilestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  completedAt?: number;
  relatedTaskIds: string[];
}

export interface GoalProgressUpdate {
  timestamp: number;
  agentId: string;
  message: string;
  milestoneId?: string;
}

export interface UserGoalProps {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  deadline?: number;
  milestones: GoalMilestone[];
  progressUpdates: GoalProgressUpdate[];
  relatedTaskIds: string[];
  relatedDecisionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export class UserGoal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly status: GoalStatus;
  readonly deadline?: number;
  readonly milestones: GoalMilestone[];
  readonly progressUpdates: GoalProgressUpdate[];
  readonly relatedTaskIds: string[];
  readonly relatedDecisionIds: string[];
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: UserGoalProps) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.priority = props.priority;
    this.status = props.status;
    this.deadline = props.deadline;
    this.milestones = props.milestones;
    this.progressUpdates = props.progressUpdates;
    this.relatedTaskIds = props.relatedTaskIds;
    this.relatedDecisionIds = props.relatedDecisionIds;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: UserGoalProps): UserGoal {
    return new UserGoal(props);
  }

  addProgressUpdate(agentId: string, message: string, milestoneId?: string): UserGoal {
    const update: GoalProgressUpdate = {
      timestamp: Date.now(),
      agentId,
      message,
      milestoneId,
    };
    return new UserGoal({
      ...this.toProps(),
      progressUpdates: [...this.progressUpdates, update],
      updatedAt: Date.now(),
    });
  }

  completeMilestone(milestoneId: string): UserGoal {
    const updatedMilestones = this.milestones.map((m) =>
      m.id === milestoneId
        ? { ...m, status: 'completed' as const, completedAt: Date.now() }
        : m,
    );
    // Auto-activate next pending milestone
    const completedIdx = updatedMilestones.findIndex((m) => m.id === milestoneId);
    if (completedIdx >= 0) {
      const next = updatedMilestones.find((m, i) => i > completedIdx && m.status === 'pending');
      if (next) {
        const nextIdx = updatedMilestones.indexOf(next);
        updatedMilestones[nextIdx] = { ...updatedMilestones[nextIdx], status: 'active' };
      }
    }
    // Auto-complete goal if all milestones done
    const allDone = updatedMilestones.every((m) => m.status === 'completed');
    return new UserGoal({
      ...this.toProps(),
      milestones: updatedMilestones,
      status: allDone ? 'completed' : this.status,
      updatedAt: Date.now(),
    });
  }

  updateStatus(status: GoalStatus): UserGoal {
    return new UserGoal({
      ...this.toProps(),
      status,
      updatedAt: Date.now(),
    });
  }

  linkTask(taskId: string): UserGoal {
    if (this.relatedTaskIds.includes(taskId)) return this;
    return new UserGoal({
      ...this.toProps(),
      relatedTaskIds: [...this.relatedTaskIds, taskId],
      updatedAt: Date.now(),
    });
  }

  linkDecision(decisionId: string): UserGoal {
    if (this.relatedDecisionIds.includes(decisionId)) return this;
    return new UserGoal({
      ...this.toProps(),
      relatedDecisionIds: [...this.relatedDecisionIds, decisionId],
      updatedAt: Date.now(),
    });
  }

  get overallProgress(): number {
    if (this.milestones.length === 0) return 0;
    const completed = this.milestones.filter((m) => m.status === 'completed').length;
    return Math.round((completed / this.milestones.length) * 100);
  }

  get isOverdue(): boolean {
    if (!this.deadline) return false;
    return Date.now() > this.deadline && this.status === 'active';
  }

  get activeMilestone(): GoalMilestone | null {
    return this.milestones.find((m) => m.status === 'active') ?? null;
  }

  private toProps(): UserGoalProps {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: this.status,
      deadline: this.deadline,
      milestones: this.milestones,
      progressUpdates: this.progressUpdates,
      relatedTaskIds: this.relatedTaskIds,
      relatedDecisionIds: this.relatedDecisionIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
