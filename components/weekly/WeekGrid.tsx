'use client';

import PriorityBadge from '@/components/shared/PriorityBadge';
import { DAY_LABELS, STATUS_LABELS, WEEK_DAY_ORDER, addDaysToKey, isOverdue, isoToDateKey } from '@/lib/utils';
import type { Todo } from '@/types';

interface WeekGridProps {
  weekStart: string; // ISO
  todos: Todo[]; // 이 주간 계획에 연결된 할일
  onCellClick: (dayOfWeek: number) => void;
  onTodoClick: (todo: Todo) => void;
}

function TodoChip({ todo, onClick }: { todo: Todo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-gray-200 bg-white p-1.5 text-left text-xs hover:border-indigo-300"
    >
      <span className={`block font-medium ${todo.status === 'done' ? 'text-gray-400 line-through' : ''} ${isOverdue(todo) ? 'text-red-600' : ''}`}>
        {todo.title}
      </span>
      <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
        {STATUS_LABELS[todo.status]} <PriorityBadge priority={todo.priority} />
      </span>
    </button>
  );
}

export default function WeekGrid({ weekStart, todos, onCellClick, onTodoClick }: WeekGridProps) {
  const startKey = isoToDateKey(weekStart);
  const unassigned = todos.filter((t) => t.dayOfWeek == null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {WEEK_DAY_ORDER.map((day, i) => {
          const dateKey = addDaysToKey(startKey, i);
          const dayTodos = todos.filter((t) => t.dayOfWeek === day);
          return (
            <div key={day} className="flex min-h-32 flex-col rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className={`mb-2 text-xs font-semibold ${day === 0 ? 'text-red-500' : day === 6 ? 'text-blue-500' : ''}`}>
                {DAY_LABELS[day]} <span className="font-normal text-gray-500">{dateKey.slice(5).replace('-', '/')}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {dayTodos.map((todo) => (
                  <TodoChip key={todo._id} todo={todo} onClick={() => onTodoClick(todo)} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => onCellClick(day)}
                className="mt-2 rounded border border-dashed border-gray-300 py-1 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
              >
                + 할일 배치
              </button>
            </div>
          );
        })}
      </div>
      {unassigned.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-gray-500">요일 미지정</h4>
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {unassigned.map((todo) => (
              <TodoChip key={todo._id} todo={todo} onClick={() => onTodoClick(todo)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
