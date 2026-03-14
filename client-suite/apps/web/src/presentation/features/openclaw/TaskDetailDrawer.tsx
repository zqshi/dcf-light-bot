/**
 * TaskDetailDrawer — 任务详情抽屉 (openclaw_1 右侧滑出)
 */
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';
import { SubTaskList, MOCK_SUBTASKS } from './SubTaskList';
import { ExecutionLogViewer, MOCK_LOGS } from './ExecutionLogViewer';

interface TaskDetailDrawerProps {
  onClose: () => void;
}

export function TaskDetailDrawer({ onClose }: TaskDetailDrawerProps) {
  const setSubView = useUIStore((s) => s.setSubView);

  return (
    <div className="w-[360px] shrink-0 border-l border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInRight_0.25s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">安全扫描任务 #882</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">进行中</span>
            <span className="text-[10px] text-primary font-semibold">84%</span>
            <span className="text-[10px] text-slate-500">TASK-SC-0882</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubView('openclaw:task-detail')}
            title="全屏查看"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Icon name="open_in_full" size={16} />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar px-4 py-3 space-y-4">
        {/* Sub-tasks */}
        <section>
          <h4 className="text-xs font-medium text-slate-300 mb-2">子任务执行情况</h4>
          <SubTaskList tasks={MOCK_SUBTASKS} />
        </section>

        {/* Execution logs */}
        <section>
          <h4 className="text-xs font-medium text-slate-300 mb-2">执行日志</h4>
          <ExecutionLogViewer logs={MOCK_LOGS} />
        </section>

        {/* Generated resources */}
        <section>
          <h4 className="text-xs font-medium text-slate-300 mb-2">生成资源</h4>
          <div className="flex flex-wrap gap-2">
            {['manifest.json', 'scan-report.pdf'].map((name) => (
              <button
                key={name}
                onClick={() => useToastStore.getState().addToast('文件下载功能开发中', 'info')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <Icon name="description" size={14} className="text-slate-500" />
                {name}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-4 py-3 flex gap-2">
        <button type="button" onClick={() => useToastStore.getState().addToast('任务已暂停', 'info')} className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1">
          <Icon name="pause" size={14} />
          暂停
        </button>
        <button type="button" onClick={() => useToastStore.getState().addToast('正在重试...', 'info')} className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1">
          <Icon name="refresh" size={14} />
          重试
        </button>
        <button type="button" onClick={() => useToastStore.getState().addToast('通知已发送', 'success')} className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1">
          <Icon name="notifications" size={14} />
          通知
        </button>
      </div>
    </div>
  );
}
