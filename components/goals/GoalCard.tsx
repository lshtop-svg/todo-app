'use client';

import { percent } from '@/lib/utils';
import type { Goal, Todo } from '@/types';
import GoalProgress from './GoalProgress';

interface GoalCardProps {
  goal: Goal;
  todos: Todo[];
  onEdit: () => void;
  onDelete: () => void;
}

export default function GoalCard({ goal, todos, onEdit, onDelete }: GoalCardProps) {
  const linked = todos.filter((t) => t.goalId === goal._id);
  const done = linked.filter((t) => t.status === 'done').length;

  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{goal.title}</h3>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs text-red-600" onClick={onDelete}>
            삭제
          </button>
        </div>
      </div>
      {goal.description ? (
        <p className="whitespace-pre-wrap text-sm text-gray-600">{goal.description}</p>
      ) : (
        <p className="text-sm text-gray-400">설명이 없습니다</p>
      )}
      <GoalProgress progress={percent(done, linked.length)} done={done} total={linked.length} />
    </article>
  );
}
