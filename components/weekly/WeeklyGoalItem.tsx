'use client';

import type { WeeklyGoal } from '@/types';

interface WeeklyGoalItemProps {
  goal: WeeklyGoal;
  onToggle: (done: boolean) => void;
}

export default function WeeklyGoalItem({ goal, onToggle }: WeeklyGoalItemProps) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          checked={goal.done}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className={`text-sm ${goal.done ? 'text-gray-400 line-through' : ''}`}>{goal.text}</span>
      </label>
    </li>
  );
}
