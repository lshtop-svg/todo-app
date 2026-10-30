'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ErrorMessage from '@/components/shared/ErrorMessage';
import Modal from '@/components/shared/Modal';
import TodoModal from '@/components/todos/TodoModal';
import ProgressBar from '@/components/weekly/ProgressBar';
import WeekGrid from '@/components/weekly/WeekGrid';
import WeeklyGoalItem from '@/components/weekly/WeeklyGoalItem';
import WeeklyPlanForm from '@/components/weekly/WeeklyPlanForm';
import { errorMessage } from '@/lib/fetcher';
import { formatWeekRange, planToInput, weeklyProgress } from '@/lib/utils';
import { useStore } from '@/store';
import type { Todo, TodoInput, WeeklyPlan } from '@/types';

function NotesEditor({ plan }: { plan: WeeklyPlan }) {
  const updateWeeklyPlan = useStore((s) => s.updateWeeklyPlan);
  const [memo, setMemo] = useState(plan.memo);
  const [retrospective, setRetrospective] = useState(plan.retrospective);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = memo !== plan.memo || retrospective !== plan.retrospective;

  const save = async () => {
    setStatus('저장 중…');
    try {
      await updateWeeklyPlan(plan._id, { ...planToInput(plan), memo, retrospective });
      setStatus('저장되었습니다');
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <section className="card space-y-3">
      <label className="block text-sm font-semibold">
        주간 메모
        <textarea className="input mt-1 min-h-24 font-normal" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={5000} />
      </label>
      <label className="block text-sm font-semibold">
        주간 회고
        <textarea
          className="input mt-1 min-h-32 font-normal"
          value={retrospective}
          onChange={(e) => setRetrospective(e.target.value)}
          maxLength={5000}
          placeholder="이번 주 잘한 점, 아쉬운 점, 다음 주에 바꿀 점을 적어보세요"
        />
      </label>
      <div className="flex items-center justify-end gap-3">
        {status && <span className="text-xs text-gray-500">{status}</span>}
        <button type="button" className="btn-primary" disabled={!dirty} onClick={save}>
          메모·회고 저장
        </button>
      </div>
    </section>
  );
}

export default function WeeklyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    weeklyPlans,
    weeklyLoading,
    weeklyError,
    fetchWeeklyPlan,
    fetchWeeklyPlans,
    updateWeeklyPlan,
    deleteWeeklyPlan,
    toggleGoal,
    todos,
    fetchTodos,
    goals,
    fetchGoals,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [todoModal, setTodoModal] = useState<{ todo: Todo | null; defaults?: Partial<TodoInput> } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyPlan(id);
    fetchWeeklyPlans(8);
    fetchTodos();
    fetchGoals();
  }, [id, fetchWeeklyPlan, fetchWeeklyPlans, fetchTodos, fetchGoals]);

  const plan = weeklyPlans.find((p) => p._id === id);

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorMessage message={weeklyError} onRetry={() => fetchWeeklyPlan(id)} />
        {weeklyLoading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : (
          <p className="text-sm text-gray-500">
            주간 계획을 찾을 수 없습니다.{' '}
            <Link href="/weekly" className="text-indigo-600 underline">
              목록으로
            </Link>
          </p>
        )}
      </div>
    );
  }

  const planTodos = todos.filter((t) => t.weeklyPlanId === plan._id);
  const linkedGoal = goals.find((g) => g._id === plan.goalId);
  const doneGoals = plan.goals.filter((g) => g.done).length;

  const handleDelete = async () => {
    if (!window.confirm('이 주간 계획을 삭제할까요? 연결된 할일은 유지되고 연결만 해제됩니다.')) return;
    try {
      await deleteWeeklyPlan(plan._id);
      router.push('/weekly');
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/weekly" className="text-xs text-gray-500 hover:underline">
            ← 주간 목록
          </Link>
          <h2 className="text-xl font-bold">{formatWeekRange(plan.weekStart)} 주간 계획</h2>
          {linkedGoal && <p className="text-sm text-indigo-700">🎯 {linkedGoal.title}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
            수정
          </button>
          <button type="button" className="btn-secondary text-red-600" onClick={handleDelete}>
            삭제
          </button>
        </div>
      </div>

      <ErrorMessage message={weeklyError ?? actionError} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h3 className="font-semibold">이번 주 목표</h3>
          <ProgressBar value={weeklyProgress(plan.goals)} label={`${doneGoals}/${plan.goals.length} 완료`} />
          {plan.goals.length === 0 ? (
            <p className="text-sm text-gray-500">목표가 없습니다. 수정 버튼으로 추가하세요.</p>
          ) : (
            <ul>
              {plan.goals.map((goal, index) => (
                <WeeklyGoalItem key={index} goal={goal} onToggle={(done) => toggleGoal(plan._id, index, done)} />
              ))}
            </ul>
          )}
        </section>
        <NotesEditor key={plan._id} plan={plan} />
      </div>

      <section className="card">
        <h3 className="mb-3 font-semibold">요일별 할일</h3>
        <WeekGrid
          weekStart={plan.weekStart}
          todos={planTodos}
          onCellClick={(dayOfWeek) =>
            setTodoModal({ todo: null, defaults: { dayOfWeek, weeklyPlanId: plan._id, goalId: plan.goalId ?? null } })
          }
          onTodoClick={(todo) => setTodoModal({ todo })}
        />
      </section>

      <Modal open={editing} title="주간 계획 수정" onClose={() => setEditing(false)}>
        <WeeklyPlanForm
          key={plan.updatedAt}
          initial={planToInput(plan)}
          submitLabel="저장"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await updateWeeklyPlan(plan._id, input);
            setEditing(false);
          }}
        />
      </Modal>

      <TodoModal
        open={!!todoModal}
        todo={todoModal?.todo}
        defaults={todoModal?.defaults}
        onClose={() => setTodoModal(null)}
      />
    </div>
  );
}
