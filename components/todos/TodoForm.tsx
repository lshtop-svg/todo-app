'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/fetcher';
import {
  DAY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WEEK_DAY_ORDER,
  formatWeekRange,
  isoToDateKey,
  toDateKey,
} from '@/lib/utils';
import { useStore } from '@/store';
import { PRIORITIES, TODO_STATUSES, type Priority, type TodoInput, type TodoStatus } from '@/types';

interface TodoFormProps {
  initial?: TodoInput;
  submitLabel: string;
  onSubmit: (input: TodoInput) => Promise<void>;
  onCancel: () => void;
}

export default function TodoForm({ initial, submitLabel, onSubmit, onCancel }: TodoFormProps) {
  const goals = useStore((s) => s.goals);
  const weeklyPlans = useStore((s) => s.weeklyPlans);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<TodoStatus>(initial?.status ?? 'todo');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(initial?.dueDate ? isoToDateKey(initial.dueDate) : '');
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? null);
  const [weeklyPlanId, setWeeklyPlanId] = useState(initial?.weeklyPlanId ?? '');
  const [goalId, setGoalId] = useState(initial?.goalId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isPastDue = !!dueDate && dueDate < toDateKey(new Date());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('제목을 입력하세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description,
        status,
        priority,
        dueDate: dueDate || null,
        dayOfWeek,
        weeklyPlanId: weeklyPlanId || null,
        goalId: goalId || null,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        제목 <span className="text-red-500">*</span>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
      </label>
      <label className="block text-sm font-medium">
        설명
        <textarea className="input mt-1 min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          상태
          <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value as TodoStatus)}>
            {TODO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          우선순위
          <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          마감일
          <input type="date" className="input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {isPastDue && <span className="mt-1 block text-xs text-red-600">⚠ 오늘 이전 날짜입니다</span>}
        </label>
        <label className="block text-sm font-medium">
          요일
          <select
            className="input mt-1"
            value={dayOfWeek ?? ''}
            onChange={(e) => setDayOfWeek(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">지정 안 함</option>
            {WEEK_DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}요일
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        주간 계획
        <select className="input mt-1" value={weeklyPlanId} onChange={(e) => setWeeklyPlanId(e.target.value)}>
          <option value="">연결 안 함</option>
          {weeklyPlans.map((p) => (
            <option key={p._id} value={p._id}>
              {formatWeekRange(p.weekStart)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        1년 목표
        <select className="input mt-1" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">연결 안 함</option>
          {goals.map((g) => (
            <option key={g._id} value={g._id}>
              {g.title}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '저장 중…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
