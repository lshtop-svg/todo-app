'use client';

import { useEffect, useState } from 'react';
import GoalCard from '@/components/goals/GoalCard';
import GoalForm from '@/components/goals/GoalForm';
import ErrorMessage from '@/components/shared/ErrorMessage';
import Modal from '@/components/shared/Modal';
import { errorMessage } from '@/lib/fetcher';
import { useStore } from '@/store';
import type { Goal } from '@/types';

export default function GoalsPage() {
  const { goals, goalsLoading, goalsError, fetchGoals, addGoal, updateGoal, deleteGoal, todos, fetchTodos } =
    useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchGoals();
    fetchTodos();
  }, [fetchGoals, fetchTodos]);

  const handleDelete = async (goal: Goal) => {
    if (!window.confirm(`"${goal.title}" 목표를 삭제할까요?\n연결된 할일과 주간 계획의 연결이 해제됩니다.`)) return;
    try {
      await deleteGoal(goal._id);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">1년 동안 이루고 싶은 목표를 관리하세요.</p>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          + 새 목표
        </button>
      </div>

      <ErrorMessage message={goalsError} onRetry={fetchGoals} />
      <ErrorMessage message={actionError} />

      {goalsLoading && goals.length === 0 ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : goals.length === 0 && !goalsError ? (
        <p className="card text-center text-sm text-gray-500">아직 목표가 없습니다. 첫 1년 목표를 만들어 보세요.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              todos={todos}
              onEdit={() => setEditing(goal)}
              onDelete={() => handleDelete(goal)}
            />
          ))}
        </div>
      )}

      <Modal open={creating} title="새 1년 목표" onClose={() => setCreating(false)}>
        <GoalForm
          submitLabel="생성"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            await addGoal(input);
            setCreating(false);
          }}
        />
      </Modal>

      <Modal open={!!editing} title="목표 수정" onClose={() => setEditing(null)}>
        {editing && (
          <GoalForm
            key={editing._id}
            initial={{ title: editing.title, description: editing.description }}
            submitLabel="저장"
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await updateGoal(editing._id, input);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
