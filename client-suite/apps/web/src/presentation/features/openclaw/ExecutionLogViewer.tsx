/**
 * ExecutionLogViewer — 执行日志组件（可复用）
 */
import { Icon } from '../../components/ui/Icon';

interface LogEntry {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  INFO: 'text-slate-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-slate-500',
};

interface ExecutionLogViewerProps {
  logs: LogEntry[];
  maxHeight?: number;
}

export function ExecutionLogViewer({ logs, maxHeight = 200 }: ExecutionLogViewerProps) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/20 overflow-y-auto dcf-scrollbar font-mono text-[11px] leading-relaxed p-2.5"
      style={{ maxHeight }}
    >
      {logs.length === 0 ? (
        <p className="text-slate-500 text-center py-4">暂无日志</p>
      ) : (
        logs.map((entry, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600 shrink-0">[{entry.time}]</span>
            <span className={`shrink-0 ${LEVEL_STYLE[entry.level]}`}>{entry.level}</span>
            <span className="text-slate-300">{entry.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

export const MOCK_LOGS: LogEntry[] = [
  { time: '12:45:01', level: 'INFO', message: '连接至核心安全审计服务...' },
  { time: '12:45:05', level: 'INFO', message: '开始扫描 auth-service.js (247 行)' },
  { time: '12:45:12', level: 'WARN', message: '发现未加密 Cookie: session_id' },
  { time: '12:45:18', level: 'WARN', message: 'JWT secret 硬编码于第 42 行' },
  { time: '12:45:25', level: 'INFO', message: '扫描网络第 7 层协议...' },
  { time: '12:45:30', level: 'ERROR', message: 'TLS 1.0 连接已被弃用' },
  { time: '12:45:35', level: 'INFO', message: '生成安全建议文档...' },
];

export type { LogEntry };
