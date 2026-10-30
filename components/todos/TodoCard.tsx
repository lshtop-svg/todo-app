'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PriorityBadge from '@/components/shared/PriorityBadge';
import Badge from '@/components/shared/Badge';
import { DAY_LABELS, isOverdue, isoToDateKey } from '@/lib/utils';
import type { Todo } from '@/types';

interface TodoCardViewProps {
  todo: Todo;
  goalTitle?: string;
  dragging?: boolean;
}

/** 카드 표시 (DragOverlay 에서도 재사용) */
export function TodoCardView({ todo, goalTitle, dragging }: TodoCardViewProps) {
  const overdue = isOverdue(todo);
  return (
    <div
      className={`rounded-md border bg-white p-3 text-left shadow-sm ${
        dragging ? 'rotate-1 shadow-lg ring-2 ring-indigo-400' : 'border-gray-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${todo.status === 'done' ? 'text-gray-400 line-through' : ''}`}>{todo.title}</p>
        <PriorityBadge priority={todo.priority} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {todo.dueDate && (
          <span className={overdue ? 'font-semibold text-red-600' : 'text-gray-500'}>
            {overdue ? '⚠ 마감 지남 ' : '마감 '}
            {isoToDateKey(todo.dueDate)}
          </span>
        )}
        {todo.dayOfWeek != null && <Badge>{DAY_LABELS[todo.dayOfWeek]}</Badge>}
        {goalTitle && <Badge className="bg-indigo-50 text-indigo-700">🎯 {goalTitle}</Badge>}
      </div>
    </div>
  );
}

interface TodoCardProps {
  todo: Todo;
  goalTitle?: string;
  onClick: () => void;
}

export default function TodoCard({ todo, goalTitle, onClick }: TodoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo._id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-manipulation ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <TodoCardView todo={todo} goalTitle={goalTitle} />
    </li>
  );
}
