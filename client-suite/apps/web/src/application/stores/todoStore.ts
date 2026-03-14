import { create } from 'zustand';
import type { TodoList } from '../../domain/todo/TodoList';
import type { TodoProps } from '../../domain/todo/Todo';
import { Todo } from '../../domain/todo/Todo';
import { TodoList as TodoListClass } from '../../domain/todo/TodoList';
import { MOCK_TODO_LISTS } from '../../data/mockTodos';
import { taskApi } from '../../infrastructure/api/dcfApiClient';

interface TodoState {
  lists: TodoList[];
  selectedListId: string | null;
  selectedTodoId: string | null;

  reset(): void;
  selectList(listId: string): void;
  selectTodo(todoId: string | null): void;
  toggleTodo(listId: string, todoId: string): void;
  toggleSubtask(listId: string, todoId: string, subtaskId: string): void;
  addTodo(listId: string, props: Omit<TodoProps, 'listId'>): void;
  deleteTodo(listId: string, todoId: string): void;
  fetchFromBackend(): Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  lists: MOCK_TODO_LISTS,
  selectedListId: MOCK_TODO_LISTS[0]?.id ?? null,
  selectedTodoId: null,

  reset() {
    set({
      lists: MOCK_TODO_LISTS,
      selectedListId: MOCK_TODO_LISTS[0]?.id ?? null,
      selectedTodoId: null,
    });
  },

  selectList(listId) {
    set({ selectedListId: listId, selectedTodoId: null });
  },

  selectTodo(todoId) {
    set({ selectedTodoId: todoId });
  },

  /*
   * addTodo / toggleTodo / deleteTodo are local-only operations.
   * The backend task endpoints (GET /api/admin/tasks) are read-only,
   * derived from running instances — there is no write API.
   * Local CRUD against mock data is intentional design.
   */

  toggleTodo(listId, todoId) {
    set({
      lists: get().lists.map((l) =>
        l.id === listId ? l.toggleTodo(todoId) : l,
      ),
    });
  },

  toggleSubtask(listId, todoId, subtaskId) {
    set({
      lists: get().lists.map((l) =>
        l.id === listId ? l.toggleSubtask(todoId, subtaskId) : l,
      ),
    });
  },

  addTodo(listId, props) {
    set({
      lists: get().lists.map((l) =>
        l.id === listId ? l.addTodo(props) : l,
      ),
    });
  },

  deleteTodo(listId, todoId) {
    set({
      lists: get().lists.map((l) =>
        l.id === listId ? l.removeTodo(todoId) : l,
      ),
      selectedTodoId: get().selectedTodoId === todoId ? null : get().selectedTodoId,
    });
  },

  async fetchFromBackend() {
    try {
      const res = await taskApi.list();
      const tasks = Array.isArray(res) ? res : [];
      if (tasks.length > 0) {
        // Map backend tasks into a TodoList
        const todos = tasks.map((t: Record<string, unknown>, i: number) =>
          Todo.create({
            id: String(t.id ?? `backend-${i}`),
            title: String(t.goal ?? t.employeeName ?? '未命名任务'),
            completed: t.status === 'completed' || t.status === 'done',
            priority: 'medium' as const,
            listId: 'backend',
          }),
        );
        const backendList = TodoListClass.create({
          id: 'backend',
          name: '后端任务',
          icon: 'cloud',
          items: todos,
        });
        // Merge: put backend list first, keep local mock lists
        const existing = get().lists.filter((l) => l.id !== 'backend');
        set({ lists: [backendList, ...existing] });
      }
    } catch {
      // Backend unreachable — keep mock data
    }
  },
}));
