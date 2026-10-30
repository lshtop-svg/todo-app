import { describe, expect, it } from 'vitest';
import { resetStore, useStore } from '@/store';
import type { Goal, Todo, WeeklyPlan } from '@/types';

describe('resetStore (로그아웃)', () => {
  it('이전 사용자의 할일/주간 계획/목표와 에러 상태를 비운다', () => {
    useStore.setState({
      todos: [{ _id: '1', title: 'prev user todo' } as Todo],
      weeklyPlans: [{ _id: '2' } as WeeklyPlan],
      goals: [{ _id: '3' } as Goal],
      todosError: 'err',
    });
    resetStore();
    const state = useStore.getState();
    expect(state.todos).toEqual([]);
    expect(state.weeklyPlans).toEqual([]);
    expect(state.goals).toEqual([]);
    expect(state.todosError).toBeNull();
    expect(typeof state.fetchTodos).toBe('function');
  });
});
