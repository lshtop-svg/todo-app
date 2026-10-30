import type { StateCreator } from 'zustand';
import { errorMessage, request } from '@/lib/fetcher';
import type { WeeklyPlan, WeeklyPlanInput } from '@/types';
import type { StoreState } from './index';

export interface WeeklySlice {
  weeklyPlans: WeeklyPlan[];
  weeklyLoading: boolean;
  weeklyError: string | null;
  /** 최근 limit 주 조회 */
  fetchWeeklyPlans: (limit?: number) => Promise<void>;
  /** 특정 주(YYYY-MM-DD) 조회 — 없으면 null */
  fetchWeekByStart: (weekStart: string) => Promise<WeeklyPlan | null>;
  fetchWeeklyPlan: (id: string) => Promise<void>;
  addWeeklyPlan: (input: WeeklyPlanInput) => Promise<WeeklyPlan>;
  updateWeeklyPlan: (id: string, input: WeeklyPlanInput) => Promise<void>;
  deleteWeeklyPlan: (id: string) => Promise<void>;
  toggleGoal: (id: string, goalIndex: number, done: boolean) => Promise<void>;
}

function upsert(plans: WeeklyPlan[], plan: WeeklyPlan): WeeklyPlan[] {
  const rest = plans.filter((p) => p._id !== plan._id);
  return [...rest, plan].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

export const createWeeklySlice: StateCreator<StoreState, [['zustand/devtools', never]], [], WeeklySlice> = (
  set,
  get,
) => ({
  weeklyPlans: [],
  weeklyLoading: false,
  weeklyError: null,

  fetchWeeklyPlans: async (limit = 4) => {
    set({ weeklyLoading: true, weeklyError: null }, undefined, 'weekly/fetch');
    try {
      const plans = await request<WeeklyPlan[]>(`/api/weekly?limit=${limit}`);
      // 개별 조회한 오래된 계획이 사라지지 않도록 병합
      set({ weeklyPlans: plans.reduce(upsert, get().weeklyPlans), weeklyLoading: false }, undefined, 'weekly/fetched');
    } catch (error) {
      set({ weeklyLoading: false, weeklyError: errorMessage(error) }, undefined, 'weekly/error');
    }
  },

  fetchWeekByStart: async (weekStart) => {
    set({ weeklyLoading: true, weeklyError: null }, undefined, 'weekly/fetchWeek');
    try {
      const [plan] = await request<WeeklyPlan[]>(`/api/weekly?weekStart=${weekStart}`);
      set(
        { weeklyPlans: plan ? upsert(get().weeklyPlans, plan) : get().weeklyPlans, weeklyLoading: false },
        undefined,
        'weekly/fetchedWeek',
      );
      return plan ?? null;
    } catch (error) {
      set({ weeklyLoading: false, weeklyError: errorMessage(error) }, undefined, 'weekly/error');
      return null;
    }
  },

  fetchWeeklyPlan: async (id) => {
    set({ weeklyLoading: true, weeklyError: null }, undefined, 'weekly/fetchOne');
    try {
      const plan = await request<WeeklyPlan>(`/api/weekly/${id}`);
      set({ weeklyPlans: upsert(get().weeklyPlans, plan), weeklyLoading: false }, undefined, 'weekly/fetchedOne');
    } catch (error) {
      set({ weeklyLoading: false, weeklyError: errorMessage(error) }, undefined, 'weekly/error');
    }
  },

  addWeeklyPlan: async (input) => {
    const plan = await request<WeeklyPlan>('/api/weekly', 'POST', input);
    set({ weeklyPlans: upsert(get().weeklyPlans, plan) }, undefined, 'weekly/add');
    return plan;
  },

  updateWeeklyPlan: async (id, input) => {
    const plan = await request<WeeklyPlan>(`/api/weekly/${id}`, 'PUT', input);
    set({ weeklyPlans: upsert(get().weeklyPlans, plan) }, undefined, 'weekly/update');
  },

  deleteWeeklyPlan: async (id) => {
    await request(`/api/weekly/${id}`, 'DELETE');
    set(
      {
        weeklyPlans: get().weeklyPlans.filter((p) => p._id !== id),
        todos: get().todos.map((t) => (t.weeklyPlanId === id ? { ...t, weeklyPlanId: null } : t)),
      },
      undefined,
      'weekly/delete',
    );
  },

  // 즉시 반영 후 실패 시 롤백
  toggleGoal: async (id, goalIndex, done) => {
    const previous = get().weeklyPlans;
    set(
      {
        weeklyPlans: previous.map((p) =>
          p._id === id ? { ...p, goals: p.goals.map((g, i) => (i === goalIndex ? { ...g, done } : g)) } : p,
        ),
      },
      undefined,
      'weekly/toggleGoal',
    );
    try {
      const plan = await request<WeeklyPlan>(`/api/weekly/${id}`, 'PATCH', { goalIndex, done });
      set({ weeklyPlans: upsert(get().weeklyPlans, plan) }, undefined, 'weekly/toggledGoal');
    } catch (error) {
      set({ weeklyPlans: previous, weeklyError: errorMessage(error) }, undefined, 'weekly/toggleRollback');
    }
  },
});
