/**
 * TodoFullPage — 个人待办三栏主页 (stitch_1 + stitch_12 对齐)
 * 左侧: 待办分类导航 (今日/即将/已完成/清单)
 * 中间: 任务列表 (按优先级分组 + 添加输入框)
 * 右侧: 任务详情面板 (子任务/协作/进展同步 + AI小贴士)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

interface TodoItem {
  id: string;
  title: string;
  priority: 'high' | 'normal' | 'low';
  time?: string;
  channel?: string;
  attachment?: string;
  group: string;
  done?: boolean;
  doneTime?: string;
}

const MOCK_TODOS: TodoItem[] = [
  { id: 't1', title: '审核桌面客户端重构 PR', priority: 'high', time: '今日 14:00', channel: '前端开发小组', group: '高优先级' },
  { id: 't2', title: '准备季度财务汇报演示文稿', priority: 'high', time: '今日 17:30', attachment: '财务报表_Q3.pdf', group: '高优先级' },
  { id: 't3', title: '回复 Alex 关于暗黑模式的疑问', priority: 'normal', channel: '来自私聊会话', group: '日常事务' },
  { id: 't4', title: '预定下周二的会议室', priority: 'normal', time: '10月29日', group: '日常事务' },
  { id: 't5', title: '更新个人周报', priority: 'low', group: '已完成', done: true, doneTime: '完成于 上午 09:15' },
];

const SUBTASKS: SubTask[] = [
  { id: 's1', text: '阅读重构设计规范', done: true },
  { id: 's2', text: '拉取代码并本地运行测试', done: false },
  { id: 's3', text: '编写 Code Review 反馈意见', done: false },
];

const NAV_ITEMS = [
  { key: 'today', label: '今日待办', icon: 'today', count: 5 },
  { key: 'upcoming', label: '即将到来', icon: 'upcoming', count: 12 },
  { key: 'done', label: '已完成', icon: 'check_circle', count: 0 },
];

const LISTS = [
  { key: 'work', label: '工作项目', color: '#FF9500' },
  { key: 'personal', label: '个人生活', color: '#5856D6' },
];

export function TodoFullPage() {
  const [selectedNav, setSelectedNav] = useState('today');
  const [selectedTodo, setSelectedTodo] = useState<string | null>('t1');
  const [search, setSearch] = useState('');
  const [progressNote, setProgressNote] = useState('');

  const groups = MOCK_TODOS.reduce<Record<string, TodoItem[]>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});

  const selected = MOCK_TODOS.find((t) => t.id === selectedTodo);
  const doneCount = SUBTASKS.filter((s) => s.done).length;

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left sidebar */}
      <div className="w-60 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">个人待办</h3>
          <button type="button" onClick={() => useToastStore.getState().addToast('新建待办功能开发中', 'info')} className="p-1 text-primary hover:bg-bg-hover rounded-md">
            <Icon name="add" size={18} />
          </button>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索待办事项…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedNav(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                selectedNav === item.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon name={item.icon} size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {item.count}
                </span>
              )}
            </button>
          ))}

          <div className="pt-4 pb-1 px-3">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">清单</span>
          </div>
          {LISTS.map((list) => (
            <button
              key={list.key}
              type="button"
              onClick={() => useToastStore.getState().addToast(`已切换到清单: ${list.label}`, 'info')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-bg-hover"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: list.color }} />
              {list.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Center task list */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text-primary">今日待办</h2>
            <p className="text-[11px] text-text-muted">10月24日，星期四</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md">
              <Icon name="filter_list" size={16} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md">
              <Icon name="more_horiz" size={16} />
            </button>
          </div>
        </div>

        {/* Add todo input */}
        <div className="px-5 py-3 border-b border-border/50">
          <div onClick={() => useToastStore.getState().addToast('添加待办功能开发中', 'info')} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors">
            <Icon name="add" size={16} />
            <span className="text-xs">添加待办事项…</span>
            <div className="ml-auto flex items-center gap-1">
              <Icon name="calendar_today" size={14} />
              <Icon name="flag" size={14} />
            </div>
          </div>
        </div>

        {/* Task groups */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    group === '高优先级' ? 'bg-error' : group === '已完成' ? 'bg-success' : 'bg-primary'
                  }`}
                />
                <span className="text-xs font-semibold text-text-secondary">{group}</span>
              </div>
              <div className="space-y-1">
                {items.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    onClick={() => setSelectedTodo(todo.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                      selectedTodo === todo.id
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-transparent hover:bg-bg-hover/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          todo.done ? 'bg-primary border-primary' : 'border-border'
                        }`}
                      >
                        {todo.done && <Icon name="check" size={10} className="text-white" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                          {todo.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {todo.priority === 'high' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium text-error bg-error/10 rounded">高</span>
                          )}
                          {todo.time && (
                            <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                              <Icon name="schedule" size={10} /> {todo.time}
                            </span>
                          )}
                          {todo.channel && (
                            <span className="text-[10px] text-primary flex items-center gap-0.5">
                              <Icon name="tag" size={10} /> {todo.channel}
                            </span>
                          )}
                          {todo.attachment && (
                            <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                              <Icon name="attach_file" size={10} /> {todo.attachment}
                            </span>
                          )}
                          {todo.doneTime && (
                            <span className="text-[10px] text-text-muted">{todo.doneTime}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      <div className="w-80 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">任务详情</h3>
              <button type="button" onClick={() => setSelectedTodo(null)} className="p-1 text-text-muted hover:text-text-secondary">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selected.priority === 'high' && (
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium text-error bg-error/10 rounded-full">
                  高优先级待办
                </span>
              )}
              <h4 className="text-base font-bold text-text-primary">{selected.title}</h4>

              {/* Properties */}
              <div className="space-y-2.5">
                {selected.time && (
                  <div className="flex items-center gap-2 text-xs">
                    <Icon name="calendar_today" size={14} className="text-text-muted" />
                    <span className="text-text-secondary">{selected.time}</span>
                  </div>
                )}
                {selected.channel && (
                  <div className="flex items-center gap-2 text-xs">
                    <Icon name="tag" size={14} className="text-text-muted" />
                    <span className="text-primary">{selected.channel} <Icon name="open_in_new" size={10} /></span>
                  </div>
                )}
                {selected.attachment && (
                  <div className="flex items-center gap-2 text-xs">
                    <Icon name="description" size={14} className="text-text-muted" />
                    <span className="text-primary">{selected.attachment} <Icon name="open_in_new" size={10} /></span>
                  </div>
                )}
              </div>

              {/* Subtasks */}
              {!selected.done && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-secondary">子任务</span>
                    <span className="text-[10px] text-text-muted">{doneCount}/{SUBTASKS.length} 已完成</span>
                  </div>
                  <div className="space-y-1.5">
                    {SUBTASKS.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover/50">
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            st.done ? 'bg-primary border-primary' : 'border-border'
                          }`}
                        >
                          {st.done && <Icon name="check" size={8} className="text-white" />}
                        </span>
                        <span className={`text-xs ${st.done ? 'line-through text-text-muted' : 'text-text-secondary'}`}>
                          {st.text}
                        </span>
                      </div>
                    ))}
                    <button type="button" onClick={() => useToastStore.getState().addToast('添加子任务功能开发中', 'info')} className="text-xs text-primary hover:underline px-2">
                      + 添加子任务
                    </button>
                  </div>
                </section>
              )}

              {/* Collaborators */}
              <section>
                <span className="text-xs font-semibold text-text-secondary mb-2 block">协作成员</span>
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">李</div>
                  <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center text-[10px] font-bold text-warning">S</div>
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted cursor-pointer hover:border-primary hover:text-primary" onClick={() => useToastStore.getState().addToast('添加协作成员功能开发中', 'info')}>
                    <Icon name="add" size={12} />
                  </div>
                  <span className="text-[10px] text-text-muted ml-1">+1</span>
                </div>
              </section>

              {/* Progress sync */}
              {!selected.done && (
                <section>
                  <span className="text-xs font-semibold text-text-secondary mb-2 block">进展同步</span>
                  <div className="border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2 text-text-muted">
                      <button type="button" onClick={() => useToastStore.getState().addToast('加粗', 'info')} className="text-xs font-bold">B</button>
                      <button type="button" onClick={() => useToastStore.getState().addToast('斜体', 'info')} className="text-xs italic">I</button>
                      <button type="button" onClick={() => useToastStore.getState().addToast('插入链接功能开发中', 'info')}><Icon name="link" size={12} /></button>
                      <button type="button" onClick={() => useToastStore.getState().addToast('提及他人功能开发中', 'info')}><Icon name="alternate_email" size={12} /></button>
                    </div>
                    <textarea
                      placeholder="在此更新任务进度… @提及他人"
                      value={progressNote}
                      onChange={(e) => setProgressNote(e.target.value)}
                      className="w-full text-xs text-text-secondary resize-none focus:outline-none min-h-[48px]"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => useToastStore.getState().addToast('插入图片功能开发中', 'info')} className="p-1 text-text-muted"><Icon name="image" size={14} /></button>
                        <button type="button" onClick={() => useToastStore.getState().addToast('添加附件功能开发中', 'info')} className="p-1 text-text-muted"><Icon name="attach_file" size={14} /></button>
                      </div>
                      <button type="button" onClick={() => { useToastStore.getState().addToast('进展已发布', 'success'); setProgressNote(''); }} className="px-3 py-1 text-[10px] font-medium text-white bg-primary rounded-md">
                        发布
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* AI Tips */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon name="auto_awesome" size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">待办小贴士</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  根据您的日历安排，今天下午 2:00 - 3:00 您有一段专注时间，适合进行代码审核工作。
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <button
                type="button"
                onClick={() => useToastStore.getState().addToast('已标记为完成', 'success')}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1.5"
              >
                <Icon name="check" size={16} /> 标记为已完成
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
            选择一个任务查看详情
          </div>
        )}
      </div>
    </div>
  );
}
