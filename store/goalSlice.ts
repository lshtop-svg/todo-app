import type { StateCreator } from 'zustand';
import { errorMessage, request } from '@/lib/fetcher';
import type { Goal, GoalInput } from '@/types';
import type { StoreState } from './index';

export interface GoalSlice {
  goals: Goal[];
  goalsLoading: boolean;
  goalsError: string | null;
  fetchGoals: () => Promise<void>;
  addGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (id: string, input: GoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export const createGoalSlice: StateCreator<StoreState, [['zustand/devtools', never]], [], GoalSlice> = (
  set,
  get,
) => ({
  goals: [],
  goalsLoading: false,
  goalsError: null,

  fetchGoals: async () => {
    set({ goalsLoading: true, goalsError: null }, undefined, 'goals/fetch');
    try {
      const goals = await request<Goal[]>('/api/goals');
      set({ goals, goalsLoading: false }, undefined, 'goals/fetched');
    } catch (error) {
      set({ goalsLoading: false, goalsError: errorMessage(error) }, undefined, 'goals/error');
    }
  },

  addGoal: async (input) => {
    const goal = await request<Goal>('/api/goals', 'POST', input);
    set({ goals: [goal, ...get().goals] }, undefined, 'goals/add');
  },

  updateGoal: async (id, input) => {
    const goal = await request<Goal>(`/api/goals/${id}`, 'PUT', input);
    set({ goals: get().goals.map((g) => (g._id === id ? goal : g)) }, undefined, 'goals/update');
  },

  deleteGoal: async (id) => {
    await request(`/api/goals/${id}`, 'DELETE');
    set(
      {
        goals: get().goals.filter((g) => g._id !== id),
        // 서버에서 해제된 연결을 로컬 상태에도 반영
        todos: get().todos.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
        weeklyPlans: get().weeklyPlans.map((p) => (p.goalId === id ? { ...p, goalId: null } : p)),
      },
      undefined,
      'goals/delete',
    );
  },
});
