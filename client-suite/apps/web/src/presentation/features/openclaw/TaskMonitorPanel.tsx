/**
 * TaskMonitorPanel — 右侧实时任务面板
 * 通知、进度条、资源柱状图、AI 洞察。
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface NotificationReplyContext {
  id: string;
  source: string;
  sender: string;
  message: string;
  roomId?: string;
}

interface TaskMonitorPanelProps {
  onOpenTaskDetail: () => void;
  onReply: (ctx: NotificationReplyContext) => void;
}

/* ── Mock data ── */
const SOURCE_COLORS: Record<string, string> = {
  Lark: '#34C759',
  Email: '#007AFF',
  Slack: '#FF3B30',
};

const NOTIFICATIONS = [
  { id: 'n1', source: 'Lark', sender: '王经理', time: '12:44', preview: '安全扫描报告已看过，什么时候可以开始下一阶段？' },
  { id: 'n2', source: 'Email', sender: '李工', time: '12:30', preview: '服务器证书即将过期，请尽快续签。' },
  { id: 'n3', source: 'Slack', sender: '张总', time: '11:50', preview: '预算审批已通过。' },
];

const TASKS = [
  { id: 't1', name: '市场监测 (Market)', progress: 80, detail: 'NASDAQ', color: '#00D4B8' },
  { id: 't2', name: '漏洞扫描', progress: 45, detail: 'API Gateway', color: '#FF9500' },
];

const BAR_DATA = [
  { label: '08:00', value: 35 },
  { label: '09:00', value: 62 },
  { label: '10:00', value: 85 },
  { label: '11:00', value: 48 },
  { label: '12:00', value: 72 },
];

export function TaskMonitorPanel({ onOpenTaskDetail, onReply }: TaskMonitorPanelProps) {
  const [aiInsightOn, setAiInsightOn] = useState(true);
  const [taskProgress, setTaskProgress] = useState(() => TASKS.map((t) => t.progress));

  // Simulate progress animation
  useEffect(() => {
    const timer = setInterval(() => {
      setTaskProgress((prev) =>
        prev.map((p, i) => {
          if (p >= 100) return 100;
          const delta = Math.random() * 2;
          return Math.min(100, Math.round((p + delta) * 10) / 10);
        }),
      );
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-[300px] shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-slate-100">实时任务面板</h3>
        <button type="button" onClick={() => useToastStore.getState().addToast('面板全屏模式即将上线', 'info')} className="text-slate-400 hover:text-slate-200 transition-colors">
          <Icon name="open_in_full" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar px-4 pb-4 space-y-4">
        {/* Notifications */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">全局通知</span>
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {NOTIFICATIONS.length}
            </span>
          </div>
          <div className="space-y-2">
            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: SOURCE_COLORS[n.source] ?? '#64748b' }} />
                    <span className="text-xs font-medium text-slate-200">{n.source} · {n.sender}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{n.time}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{n.preview}</p>
                <button
                  onClick={() => onReply({ id: n.id, source: n.source, sender: n.sender, message: n.preview })}
                  className="mt-1.5 text-[10px] text-primary hover:underline"
                >
                  回复
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Task progress */}
        <section>
          <span className="text-xs font-medium text-slate-300 block mb-2">任务进度</span>
          <div className="space-y-3">
            {TASKS.map((t, i) => {
              const progress = Math.round(taskProgress[i] ?? t.progress);
              return (
                <button
                  key={t.id}
                  onClick={onOpenTaskDetail}
                  className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] p-2.5 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-200">{t.name}</span>
                    <span className="text-xs font-semibold" style={{ color: t.color }}>{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: t.color,
                        boxShadow: `0 0 10px ${t.color}80`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{t.detail}{progress >= 100 ? ' · 已完成' : ''}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Resource utilization mini bar chart */}
        <section>
          <span className="text-xs font-medium text-slate-300 block mb-2">资源占用趋势</span>
          <div className="flex items-end gap-2 h-16">
            {BAR_DATA.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                  <div
                    className="w-full max-w-[20px] rounded-t transition-all duration-300"
                    style={{
                      height: `${d.value}%`,
                      background: `linear-gradient(180deg, #00D4B8 0%, rgba(0,212,184,0.3) 100%)`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* AI Insight */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">AI 洞察推荐</span>
            <button
              onClick={() => setAiInsightOn(!aiInsightOn)}
              className={`w-8 h-4 rounded-full transition-colors relative ${aiInsightOn ? 'bg-primary' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${aiInsightOn ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className={`rounded-lg p-3 bg-gradient-to-br from-[rgba(0,212,184,0.12)] to-[rgba(0,122,255,0.08)] border border-primary/20 ${!aiInsightOn ? 'opacity-40' : ''}`}>
            <p className="text-xs text-slate-200 leading-relaxed">
              建议升级 <code className="text-primary">lodash@4.17.15</code> 至最新版本，
              已检测到 3 个已知 CVE 漏洞。
            </p>
            <button type="button" onClick={() => useToastStore.getState().addToast('lodash 升级任务已创建', 'success')} className="mt-2 text-[11px] font-medium text-primary hover:underline flex items-center gap-1">
              <Icon name="bolt" size={14} />
              执行自动升级
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
