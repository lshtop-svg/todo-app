'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ErrorMessage from '@/components/shared/ErrorMessage';
import Modal from '@/components/shared/Modal';
import WeeklyPlanCard from '@/components/weekly/WeeklyPlanCard';
import WeeklyPlanForm from '@/components/weekly/WeeklyPlanForm';
import { useStore } from '@/store';

export default function WeeklyPage() {
  const router = useRouter();
  const { weeklyPlans, weeklyLoading, weeklyError, fetchWeeklyPlans, addWeeklyPlan, goals, fetchGoals } = useStore();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWeeklyPlans(4);
    fetchGoals();
  }, [fetchWeeklyPlans, fetchGoals]);

  const goalTitle = (id?: string | null) => goals.find((g) => g._id === id)?.title;
  const recent = weeklyPlans.slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">최근 4주의 주간 계획</p>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          + 주간 계획
        </button>
      </div>

      <ErrorMessage message={weeklyError} onRetry={() => fetchWeeklyPlans(4)} />

      {weeklyLoading && recent.length === 0 ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : recent.length === 0 && !weeklyError ? (
        <p className="card text-center text-sm text-gray-500">주간 계획이 없습니다. 1년 목표를 바탕으로 이번 주 계획을 세워 보세요.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recent.map((plan) => (
            <WeeklyPlanCard key={plan._id} plan={plan} goalTitle={goalTitle(plan.goalId)} />
          ))}
        </div>
      )}

      <Modal open={creating} title="새 주간 계획" onClose={() => setCreating(false)}>
        <WeeklyPlanForm
          submitLabel="생성"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const plan = await addWeeklyPlan(input);
            setCreating(false);
            router.push(`/weekly/${plan._id}`);
          }}
        />
      </Modal>
    </div>
  );
}
