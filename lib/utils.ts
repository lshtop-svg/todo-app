import { compareKeys } from './fractionalIndex';
import type { Priority, Todo, TodoStatus, WeeklyGoal, WeeklyPlan, WeeklyPlanInput } from '@/types';

export const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '완료',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

// 0(일)~6(토)
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
// 주는 월요일부터 시작
export const WEEK_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad = (n: number) => String(n).padStart(2, '0');

/** 로컬 날짜 기준 YYYY-MM-DD */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 해당 날짜가 속한 주의 월요일(로컬 기준)을 YYYY-MM-DD 로 반환 */
export function getWeekStart(date: Date = new Date()): string {
  const diff = (date.getDay() + 6) % 7; // 월=0 ... 일=6
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
  return toDateKey(monday);
}

/** YYYY-MM-DD 키를 UTC 자정 Date 로 변환 (DB 저장용) */
export function dateKeyToUTC(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** YYYY-MM-DD 키가 속한 주의 월요일을 UTC 자정 Date 로 반환 (서버 정규화용) */
export function weekStartToUTC(key: string): Date {
  const date = dateKeyToUTC(key);
  const diff = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

/** ISO 문자열 또는 YYYY-MM-DD 에서 날짜 키만 추출 */
export function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** YYYY-MM-DD 에 일수를 더한 키 */
export function addDaysToKey(key: string, days: number): string {
  const date = dateKeyToUTC(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(weekStartIso: string): string {
  const start = isoToDateKey(weekStartIso);
  const end = addDaysToKey(start, 6);
  return `${start.slice(5).replace('-', '/')} ~ ${end.slice(5).replace('-', '/')}`;
}

export function planToInput(plan: WeeklyPlan): WeeklyPlanInput {
  return {
    weekStart: isoToDateKey(plan.weekStart),
    goals: plan.goals,
    memo: plan.memo,
    retrospective: plan.retrospective,
    goalId: plan.goalId ?? null,
  };
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function weeklyProgress(goals: WeeklyGoal[]): number {
  return percent(goals.filter((g) => g.done).length, goals.length);
}

export function goalProgress(goalId: string, todos: Todo[]): number {
  const linked = todos.filter((t) => t.goalId === goalId);
  return percent(linked.filter((t) => t.status === 'done').length, linked.length);
}

export function isOverdue(todo: Pick<Todo, 'dueDate' | 'status'>, today: string = toDateKey(new Date())): boolean {
  return !!todo.dueDate && todo.status !== 'done' && isoToDateKey(todo.dueDate) < today;
}

/** 칸반 상단 고정 대상 (우선순위 높음) */
export function isPinned(todo: Pick<Todo, 'priority'>): boolean {
  return todo.priority === 'high';
}

/** 컬럼 표시 순서: 높음 우선순위 고정 → order 사전순 */
export function sortColumn(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const pin = Number(isPinned(b)) - Number(isPinned(a));
    return pin !== 0 ? pin : compareKeys(a.order, b.order);
  });
}
