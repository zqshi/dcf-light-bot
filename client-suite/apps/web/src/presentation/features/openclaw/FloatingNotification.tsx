/**
 * FloatingNotification — 右下浮动通知铃铛
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface FloatingNotificationProps {
  count?: number;
}

export function FloatingNotification({ count = 3 }: FloatingNotificationProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {expanded && (
        <div className="mb-3 w-72 rounded-xl border border-white/10 bg-bg-white-var shadow-2xl overflow-hidden animate-[dcf-fade-in_0.2s_ease-out]">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-200">通知</span>
            <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-slate-300">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto dcf-scrollbar">
            {[
              '王经理回复了安全扫描报告',
              '漏洞扫描任务完成 (45%)',
              'lodash CVE 漏洞预警',
            ].map((msg, i) => (
              <div key={i} onClick={() => useToastStore.getState().addToast(msg, 'info')} className="px-3 py-2 border-b border-white/5 text-xs text-slate-300 hover:bg-white/5 cursor-pointer">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="relative w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark transition-colors"
      >
        <Icon name="notifications" size={22} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
