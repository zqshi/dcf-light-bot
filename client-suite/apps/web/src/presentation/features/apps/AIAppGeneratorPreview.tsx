/**
 * @deprecated 已弃用 — 创建流程已整合到 AICreationPanel 三步向导中。
 * 保留此文件避免潜在的外部引用报错。
 *
 * AIAppGeneratorPreview — AI 应用生成预览 (stitch_22 对齐)
 * 左栏: 自然语言提示词 + 关联接口 + 生成日志
 * 右栏: 应用预览卡片 (桌面端/移动端切换)
 * 底部: AI进度 + 完成发布/手动调整
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface AIAppGeneratorPreviewProps {
  onBack?: () => void;
}

export function AIAppGeneratorPreview({ onBack }: AIAppGeneratorPreviewProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [leaveType, setLeaveType] = useState('带薪年假');
  return (
    <div className="flex-1 flex overflow-hidden bg-fill-tertiary/20">
      {/* Left config panel */}
      <div className="w-80 bg-bg-white-var border-r border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button type="button" onClick={onBack} className="p-1 text-text-secondary hover:bg-bg-hover rounded-md">
            <Icon name="chevron_left" size={20} />
          </button>
          <h3 className="text-sm font-semibold text-text-primary">AI 应用生成预览</h3>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-y-auto">
          {/* NL Prompt */}
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">自然语言提示词</h4>
            <div className="p-3 rounded-xl bg-fill-tertiary/30 border border-border text-xs text-text-secondary leading-relaxed italic">
              "帮我创建一个'剩余年假查询'应用，需要对接 HR 系统数据，界面简洁，包含一个查询按钮和剩余天数展示。"
            </div>
          </section>

          {/* Mapped APIs */}
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">已关联接口 (MAPPED APIS)</h4>
            <div className="space-y-2">
              <ApiCard icon="hub" name="查询接口" detail="Linked to HR Data" />
              <ApiCard icon="person" name="身份验证" detail="SSO Middleware" />
            </div>
          </section>

          {/* Generation log */}
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">生成日志</h4>
            <div className="space-y-2">
              <LogEntry status="done" text="意图识别完成：查询年假" />
              <LogEntry status="done" text="数据字段映射：[remaining_days]" />
              <LogEntry status="loading" text="正在优化布局与样式..." />
            </div>
          </section>
        </div>

        {/* Bottom: AI progress + publish */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" size={16} className="text-primary" />
            <span className="text-xs text-text-secondary">AI 正在调优</span>
          </div>
          <div className="h-1 bg-fill-tertiary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-3/4 animate-pulse" />
          </div>
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('应用发布功能开发中', 'info')}
            className="w-full py-3 rounded-xl bg-surface-dark text-white text-sm font-semibold hover:bg-surface-dark/90 transition-colors"
          >
            完成并发布
          </button>
        </div>
      </div>

      {/* Right preview area */}
      <div className="flex-1 flex flex-col">
        {/* Preview toolbar */}
        <div className="flex items-center justify-center gap-4 px-6 py-3 bg-bg-white-var border-b border-border">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => setPreviewMode('desktop')} className={`px-3 py-1.5 text-xs font-medium ${previewMode === 'desktop' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>桌面端预览</button>
            <button type="button" onClick={() => setPreviewMode('mobile')} className={`px-3 py-1.5 text-xs font-medium ${previewMode === 'mobile' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>移动端</button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Icon name="desktop_windows" size={14} />
            <span>1440 × 900</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button type="button" onClick={() => useToastStore.getState().addToast('已刷新预览', 'info')} className="p-1.5 text-text-secondary hover:bg-bg-hover rounded-md">
              <Icon name="refresh" size={16} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('代码查看功能开发中', 'info')} className="p-1.5 text-text-secondary hover:bg-bg-hover rounded-md">
              <Icon name="code" size={16} />
            </button>
          </div>
        </div>

        {/* Preview card */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-bg-white-var rounded-3xl shadow-xl border border-border p-8 w-full max-w-lg">
            {/* GENERATIVE LAYOUT badge */}
            <div className="flex justify-end mb-4">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[10px] text-text-muted">
                <Icon name="auto_awesome" size={12} className="text-primary" />
                GENERATIVE LAYOUT
              </span>
            </div>

            {/* App header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="event_available" size={28} className="text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">剩余年假查询</h3>
                <p className="text-xs text-text-muted">HR 数字化办公插件</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-fill-tertiary/30 p-4">
                <p className="text-[10px] text-text-muted mb-1">当前年份</p>
                <p className="text-lg font-bold text-text-primary">2024 年度</p>
              </div>
              <div className="rounded-xl bg-fill-tertiary/30 p-4">
                <p className="text-[10px] text-success mb-1">剩余天数 (Remaining Days)</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-success">12.5</span>
                  <span className="text-sm text-text-muted">天</span>
                </div>
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">查询员工姓名</label>
                <input type="text" value="张三 (现职)" readOnly className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-fill-tertiary/20" />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">休假类型</label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-fill-tertiary/20 appearance-none">
                  <option>带薪年假</option>
                </select>
              </div>
            </div>

            {/* Query button */}
            <button type="button" onClick={() => useToastStore.getState().addToast('查询功能开发中', 'info')} className="w-full py-3.5 rounded-xl bg-surface-dark text-white text-sm font-semibold flex items-center justify-center gap-2">
              立即查询 <Icon name="arrow_forward" size={16} />
            </button>

            <p className="text-[10px] text-text-muted text-center mt-3">
              数据来源于公司 HR Core 系统，最后更新于：今天 09:30
            </p>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-bg-white-var border-t border-border">
          <button type="button" onClick={() => useToastStore.getState().addToast('手动调整功能开发中', 'info')} className="px-4 py-2 text-sm text-text-secondary border border-border rounded-xl hover:bg-bg-hover flex items-center gap-1.5">
            <Icon name="edit" size={14} /> 手动调整
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('AI 正在重新生成布局…', 'info')} className="px-4 py-2 text-sm text-text-secondary border border-border rounded-xl hover:bg-bg-hover flex items-center gap-1.5">
            <Icon name="auto_awesome" size={14} /> 换个布局
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiCard({ icon, name, detail }: { icon: string; name: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon name={icon} size={16} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-text-primary">{name}</p>
        <p className="text-[10px] text-primary">{detail}</p>
      </div>
      <Icon name="link" size={14} className="text-text-muted" />
    </div>
  );
}

function LogEntry({ status, text }: { status: 'done' | 'loading'; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {status === 'done' ? (
        <Icon name="check_circle" size={14} className="text-success" />
      ) : (
        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      )}
      <span className={`text-xs ${status === 'loading' ? 'text-primary' : 'text-text-secondary'}`}>{text}</span>
    </div>
  );
}
