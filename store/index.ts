import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createGoalSlice, type GoalSlice } from './goalSlice';
import { createTodoSlice, type TodoSlice } from './todoSlice';
import { createWeeklySlice, type WeeklySlice } from './weeklySlice';

export type StoreState = TodoSlice & WeeklySlice & GoalSlice;

export const useStore = create<StoreState>()(
  devtools(
    (...a) => ({
      ...createTodoSlice(...a),
      ...createWeeklySlice(...a),
      ...createGoalSlice(...a),
    }),
    { name: 'todo-app' },
  ),
);

/** 로그아웃 시 이전 사용자 데이터가 남지 않도록 스토어를 초기 상태로 되돌린다 */
export function resetStore(): void {
  useStore.setState(useStore.getInitialState(), true);
}
