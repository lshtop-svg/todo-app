'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import ErrorMessage from '@/components/shared/ErrorMessage';
import TodoModal from '@/components/todos/TodoModal';
import { useStore } from '@/store';
import type { Todo } from '@/types';

// dnd-kit 은 SSR 시 hydration 불일치가 생기므로 클라이언트에서만 렌더링
const KanbanBoard = dynamic(() => import('@/components/todos/KanbanBoard'), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">보드를 불러오는 중…</p>,
});

export default function TodosPage() {
  const { todosError, todosLoading, todos, fetchTodos, fetchGoals, fetchWeeklyPlans, clearTodosError } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);

  useEffect(() => {
    fetchTodos();
    fetchGoals();
    fetchWeeklyPlans(8);
  }, [fetchTodos, fetchGoals, fetchWeeklyPlans]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">카드를 드래그해 상태와 순서를 바꾸세요. 우선순위 높음은 상단에 고정됩니다.</p>
        <button type="button" className="btn-primary shrink-0" onClick={openNew}>
          + 새 할일
        </button>
      </div>

      <ErrorMessage
        message={todosError}
        onRetry={() => {
          clearTodosError();
          fetchTodos();
        }}
      />

      {todosLoading && todos.length === 0 ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <KanbanBoard
          onCardClick={(todo) => {
            setEditing(todo);
            setModalOpen(true);
          }}
        />
      )}

      <TodoModal open={modalOpen} todo={editing} onClose={() => setModalOpen(false)} />
    </div>
  );
}
