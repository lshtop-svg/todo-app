'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { COLUMN_PREFIX } from '@/lib/kanban';
import { STATUS_LABELS } from '@/lib/utils';
import type { Todo, TodoStatus } from '@/types';
import TodoCard from './TodoCard';

const HEADER_COLORS: Record<TodoStatus, string> = {
  todo: 'bg-gray-400',
  doing: 'bg-blue-500',
  done: 'bg-green-500',
};

const columnId = (status: TodoStatus) => `${COLUMN_PREFIX}${status}`;

interface KanbanColumnProps {
  status: TodoStatus;
  todos: Todo[]; // 이미 표시 순서로 정렬됨
  goalTitles: Map<string, string>;
  onCardClick: (todo: Todo) => void;
}

export default function KanbanColumn({ status, todos, goalTitles, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

  return (
    <section className={`flex flex-col rounded-lg bg-gray-100 p-3 ${isOver ? 'ring-2 ring-indigo-300' : ''}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${HEADER_COLORS[status]}`} />
        {STATUS_LABELS[status]}
        <span className="text-gray-500">{todos.length}</span>
      </h2>
      <SortableContext items={todos.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {todos.map((todo) => (
            <TodoCard
              key={todo._id}
              todo={todo}
              goalTitle={todo.goalId ? goalTitles.get(todo.goalId) : undefined}
              onClick={() => onCardClick(todo)}
            />
          ))}
          {todos.length === 0 && <li className="py-6 text-center text-xs text-gray-400">여기로 드래그하세요</li>}
        </ul>
      </SortableContext>
    </section>
  );
}
