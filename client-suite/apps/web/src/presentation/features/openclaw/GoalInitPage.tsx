/**
 * GoalInitPage — C 栏目标讨论上下文卡片
 *
 * 当 discussingGoalId 非空时渲染在 C 栏对话流顶部，
 * 提供目标进度、里程碑摘要、关联项数量。
 * 详细里程碑/时间线按需在 D 栏 Drawer 展开。
 */
import { useMemo, useState } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { Icon } from '../../components/ui/Icon';
import type { GoalStatus, GoalPriority } from '../../../domain/agent/UserGoal';
import type { OpenClawDrawerContent } from '../../../domain/agent/DrawerContent';

const STATUS_STYLES: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: '进行中', color: 'text-green-400' },
  paused: { label: '已暂停', color: 'text-yellow-400' },
  completed: { label: '已完成', color: 'text-blue-400' },
  archived: { label: '已归档', color: 'text-slate-400' },
  cancelled: { label: '已取消', color: 'text-red-400' },
};

const PRIORITY_STYLES: Record<GoalPriority, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-400', label: '紧急' },
  high: { dot: 'bg-orange-400', label: '重要' },
  normal: { dot: 'bg-blue-400', label: '普通' },
  low: { dot: 'bg-slate-400', label: '低' },
};

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天截止';
  if (days === 1) return '明天截止';
  return `${days} 天后截止`;
}

interface GoalInitPageProps {
  onOpenDrawer?: (content: OpenClawDrawerContent) => void;
}

export function GoalInitPage({ onOpenDrawer }: GoalInitPageProps) {
  const discussingGoalId = useOpenClawStore((s) => s.discussingGoalId);
  const goals = useOpenClawStore((s) => s.goals);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const tasks = useOpenClawStore((s) => s.tasks);

  const [collapsed, setCollapsed] = useState(false);

  const goal = useMemo(
    () => goals.find((g) => g.id === discussingGoalId),
    [goals, discussingGoalId],
  );

  if (!goal) return null;

  const statusStyle = STATUS_STYLES[goal.status];
  const priorityStyle = PRIORITY_STYLES[goal.priority];
  const completedMilestones = goal.milestones.filter((m) => m.status === 'completed');
  const activeMilestone = goal.milestones.find((m) => m.status === 'active');
  const relatedDecisionCount = goal.relatedDecisionIds?.length ?? 0;
  const relatedTaskCount = goal.relatedTaskIds?.length ?? 0;

  const handleClose = () => {
    useOpenClawStore.getState().setDiscussingGoalId(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityStyle.dot}`} />
          <Icon name="flag" size={15} className="text-green-400 shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">{goal.title}</span>
            <Icon name={collapsed ? 'expand_more' : 'expand_less'} size={14} className="text-slate-500 shrink-0" />
          </button>
          {collapsed && (
            <span className="text-[10px] text-slate-500 shrink-0">{goal.overallProgress}%</span>
          )}
          <span className={`text-[9px] ${statusStyle.color}`}>{statusStyle.label}</span>
          {goal.deadline && (
            <span className={`text-[10px] shrink-0 ${goal.isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
              {formatDeadline(goal.deadline)}
            </span>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Collapsible body */}
        {!collapsed && (
          <div className="max-h-[40vh] overflow-y-auto dcf-scrollbar">
            {/* Description + progress bar */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">{goal.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
                    style={{ width: `${goal.overallProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium shrink-0">{goal.overallProgress}%</span>
              </div>
            </div>

            {/* Milestones summary */}
            {goal.milestones.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="flag" size={12} className="text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400">里程碑</span>
                  <span className="text-[9px] text-slate-600">
                    {completedMilestones.length}/{goal.milestones.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {goal.milestones.map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2">
                      <Icon
                        name={ms.status === 'completed' ? 'check_circle' : ms.status === 'active' ? 'radio_button_checked' : 'radio_button_unchecked'}
                        size={12}
                        className={ms.status === 'completed' ? 'text-green-400' : ms.status === 'active' ? 'text-primary' : 'text-slate-500'}
                      />
                      <span className={`text-[10px] flex-1 truncate ${
                        ms.status === 'completed' ? 'text-slate-400 line-through'
                        : ms.status === 'active' ? 'text-slate-200 font-medium'
                        : 'text-slate-500'
                      }`}>
                        {ms.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related items + timeline trigger */}
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
              {relatedDecisionCount > 0 && (
                <span className="text-[10px] text-slate-500">
                  <Icon name="bolt" size={10} className="inline mr-0.5 text-orange-400/70" />
                  {relatedDecisionCount} 决策
                </span>
              )}
              {relatedTaskCount > 0 && (
                <span className="text-[10px] text-slate-500">
                  <Icon name="pending_actions" size={10} className="inline mr-0.5 text-primary/70" />
                  {relatedTaskCount} 任务
                </span>
              )}
              <span className="flex-1" />
              {goal.progressUpdates.length > 0 && onOpenDrawer && (
                <button
                  type="button"
                  onClick={() => onOpenDrawer({ type: 'goal-tracker', title: '目标追踪', data: { goalId: goal.id } })}
                  className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  进展时间线
                  <Icon name="chevron_right" size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
