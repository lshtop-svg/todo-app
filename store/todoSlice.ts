import type { StateCreator } from 'zustand';
import { errorMessage, request } from '@/lib/fetcher';
import { needsRebalance, rebalancedKeys } from '@/lib/fractionalIndex';
import { sortColumn } from '@/lib/utils';
import type { Todo, TodoInput, TodoStatus } from '@/types';
import type { StoreState } from './index';

export interface TodoSlice {
  todos: Todo[];
  todosLoading: boolean;
  todosError: string | null;
  fetchTodos: () => Promise<void>;
  addTodo: (input: TodoInput) => Promise<void>;
  updateTodo: (id: string, input: TodoInput) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  /** 칸반 이동: 낙관적 업데이트 + PATCH 1회, 실패 시 롤백 */
  moveTodo: (id: string, status: TodoStatus, order: string) => Promise<void>;
  /** 키 길이가 임계값을 넘은 컬럼의 order 를 재정규화 */
  rebalanceColumn: (status: TodoStatus) => Promise<void>;
  clearTodosError: () => void;
}

export const createTodoSlice: StateCreator<StoreState, [['zustand/devtools', never]], [], TodoSlice> = (
  set,
  get,
) => ({
  todos: [],
  todosLoading: false,
  todosError: null,

  fetchTodos: async () => {
    set({ todosLoading: true, todosError: null }, undefined, 'todos/fetch');
    try {
      const todos = await request<Todo[]>('/api/todos');
      set({ todos, todosLoading: false }, undefined, 'todos/fetched');
    } catch (error) {
      set({ todosLoading: false, todosError: errorMessage(error) }, undefined, 'todos/error');
    }
  },

  addTodo: async (input) => {
    const todo = await request<Todo>('/api/todos', 'POST', input);
    set({ todos: [...get().todos, todo] }, undefined, 'todos/add');
  },

  updateTodo: async (id, input) => {
    const todo = await request<Todo>(`/api/todos/${id}`, 'PUT', input);
    set({ todos: get().todos.map((t) => (t._id === id ? todo : t)) }, undefined, 'todos/update');
  },

  deleteTodo: async (id) => {
    await request(`/api/todos/${id}`, 'DELETE');
    set({ todos: get().todos.filter((t) => t._id !== id) }, undefined, 'todos/delete');
  },

  moveTodo: async (id, status, order) => {
    const previous = get().todos;
    set(
      { todos: previous.map((t) => (t._id === id ? { ...t, status, order } : t)), todosError: null },
      undefined,
      'todos/move',
    );
    try {
      const todo = await request<Todo>(`/api/todos/${id}`, 'PATCH', { status, order });
      set({ todos: get().todos.map((t) => (t._id === id ? todo : t)) }, undefined, 'todos/moved');
    } catch (error) {
      set({ todos: previous, todosError: `이동 실패: ${errorMessage(error)}` }, undefined, 'todos/moveRollback');
      return;
    }
    if (needsRebalance(order)) await get().rebalanceColumn(status);
  },

  rebalanceColumn: async (status) => {
    const previous = get().todos;
    const column = sortColumn(previous.filter((t) => t.status === status));
    const keys = rebalancedKeys(column.length);
    const orderById = new Map(column.map((t, i) => [t._id, keys[i]]));
    set(
      { todos: previous.map((t) => (orderById.has(t._id) ? { ...t, order: orderById.get(t._id)! } : t)) },
      undefined,
      'todos/rebalance',
    );
    try {
      await Promise.all(
        column.map((t) => request(`/api/todos/${t._id}`, 'PATCH', { order: orderById.get(t._id) })),
      );
    } catch (error) {
      // 일부만 반영됐을 수 있으므로 서버 상태로 다시 동기화
      set({ todosError: `순서 재정렬 실패: ${errorMessage(error)}` }, undefined, 'todos/rebalanceError');
      await get().fetchTodos();
    }
  },

  clearTodosError: () => set({ todosError: null }, undefined, 'todos/clearError'),
});
