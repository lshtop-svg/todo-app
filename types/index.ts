export type TodoStatus = 'todo' | 'doing' | 'done';
export type Priority = 'high' | 'medium' | 'low';

export const TODO_STATUSES: TodoStatus[] = ['todo', 'doing', 'done'];
export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
export const MAX_WEEKLY_GOALS = 5;

export interface Goal {
  _id: string;
  title: string;
  description: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyGoal {
  text: string;
  done: boolean;
}

export interface WeeklyPlan {
  _id: string;
  weekStart: string;
  goals: WeeklyGoal[];
  memo: string;
  retrospective: string;
  goalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: Priority;
  dueDate?: string | null;
  dayOfWeek?: number | null;
  order: string;
  weeklyPlanId?: string | null;
  goalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  description?: string;
}

export interface WeeklyPlanInput {
  weekStart: string; // YYYY-MM-DD
  goals: WeeklyGoal[];
  memo?: string;
  retrospective?: string;
  goalId?: string | null;
}

export interface TodoInput {
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: Priority;
  dueDate?: string | null; // YYYY-MM-DD
  dayOfWeek?: number | null;
  weeklyPlanId?: string | null;
  goalId?: string | null;
}
