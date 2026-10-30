'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ErrorMessage from '@/components/shared/ErrorMessage';
import ProgressBar from '@/components/weekly/ProgressBar';
import WeeklyGoalItem from '@/components/weekly/WeeklyGoalItem';
import { STATUS_LABELS, getWeekStart, goalProgress, isoToDateKey, percent, weeklyProgress } from '@/lib/utils';
import { useStore } from '@/store';
import { TODO_STATUSES } from '@/types';

const STATUS_COLORS = {
  todo: 'text-gray-700',
  doing: 'text-blue-600',
  done: 'text-green-600',
};

export default function DashboardPage() {
  const {
    weeklyPlans,
    weeklyError,
    fetchWeekByStart,
    toggleGoal,
    todos,
    todosError,
    fetchTodos,
    goals,
    goalsError,
    fetchGoals,
  } = useStore();
  const [weekStart] = useState(() => getWeekStart());
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    Promise.all([fetchWeekByStart(weekStart), fetchTodos(), fetchGoals()]).then(() => setLoaded(true));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = weeklyPlans.find((p) => isoToDateKey(p.weekStart) === weekStart);
  const weekTodos = plan ? todos.filter((t) => t.weeklyPlanId === plan._id) : [];
  const weekTodosDone = weekTodos.filter((t) => t.status === 'done').length;
  const error = weeklyError ?? todosError ?? goalsError;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ErrorMessage message={error} onRetry={load} />

      {!loaded && !error && <p className="text-sm text-gray-500">불러오는 중…</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">이번 주 계획</h2>
            {plan && (
              <Link href={`/weekly/${plan._id}`} className="text-sm text-indigo-600 hover:underline">
                상세 보기 →
              </Link>
            )}
          </div>
          {plan ? (
            <>
              <ProgressBar value={weeklyProgress(plan.goals)} label="주간 목표 진행률" />
              <ProgressBar value={percent(weekTodosDone, weekTodos.length)} label={`이번 주 할일 완료 (${weekTodosDone}/${weekTodos.length})`} />
              {plan.goals.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 주간 목표가 없습니다.</p>
              ) : (
                <ul>
                  {plan.goals.map((goal, index) => (
                    <WeeklyGoalItem key={index} goal={goal} onToggle={(done) => toggleGoal(plan._id, index, done)} />
                  ))}
                </ul>
              )}
            </>
          ) : (
            loaded && (
              <p className="text-sm text-gray-500">
                이번 주 계획이 아직 없습니다.{' '}
                <Link href="/weekly" className="font-medium text-indigo-600 underline">
                  주간 계획 만들기
                </Link>
              </p>
            )
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">할일 현황</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {TODO_STATUSES.map((status) => (
              <div key={status} className="rounded-md bg-gray-50 py-3">
                <div className={`text-2xl font-bold ${STATUS_COLORS[status]}`}>
                  {todos.filter((t) => t.status === status).length}
                </div>
                <div className="text-xs text-gray-500">{STATUS_LABELS[status]}</div>
              </div>
            ))}
          </div>
          <Link href="/todos" className="block text-right text-sm text-indigo-600 hover:underline">
            할일 보드 →
          </Link>
        </section>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">1년 목표</h2>
        {goals.length === 0 ? (
          loaded && (
            <p className="text-sm text-gray-500">
              1년 목표가 없습니다.{' '}
              <Link href="/goals" className="font-medium text-indigo-600 underline">
                목표 만들기
              </Link>
            </p>
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <li key={goal._id} className="space-y-2 rounded-md border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{goal.title}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    이번 주 할일 {weekTodos.filter((t) => t.goalId === goal._id).length}개
                  </span>
                </div>
                <ProgressBar value={goalProgress(goal._id, todos)} label="진행률" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
