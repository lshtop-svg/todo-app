'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/fetcher';
import { getWeekStart } from '@/lib/utils';
import { useStore } from '@/store';
import { MAX_WEEKLY_GOALS, type WeeklyGoal, type WeeklyPlanInput } from '@/types';

interface WeeklyPlanFormProps {
  initial?: WeeklyPlanInput;
  submitLabel: string;
  onSubmit: (input: WeeklyPlanInput) => Promise<void>;
  onCancel: () => void;
}

export default function WeeklyPlanForm({ initial, submitLabel, onSubmit, onCancel }: WeeklyPlanFormProps) {
  const goalsOptions = useStore((s) => s.goals);
  const [weekDate, setWeekDate] = useState(initial?.weekStart ?? getWeekStart());
  const [goals, setGoals] = useState<WeeklyGoal[]>(initial?.goals.length ? initial.goals : [{ text: '', done: false }]);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [goalId, setGoalId] = useState(initial?.goalId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mondayKey = weekDate ? getWeekStart(new Date(`${weekDate}T00:00:00`)) : '';

  const updateGoalText = (index: number, text: string) =>
    setGoals(goals.map((g, i) => (i === index ? { ...g, text } : g)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mondayKey) {
      setError('주차를 선택하세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        // 선택한 날짜가 속한 주의 월요일로 맞춘다
        weekStart: mondayKey,
        goals: goals.map((g) => ({ ...g, text: g.text.trim() })).filter((g) => g.text),
        memo,
        retrospective: initial?.retrospective ?? '',
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
        주차 (해당 주의 아무 날짜)
        <input type="date" className="input mt-1" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} />
        {mondayKey && <span className="mt-1 block text-xs text-gray-500">월요일 기준 {mondayKey} 주</span>}
      </label>

      <fieldset>
        <legend className="text-sm font-medium">
          이번 주 목표 ({goals.length}/{MAX_WEEKLY_GOALS})
        </legend>
        <ul className="mt-1 space-y-2">
          {goals.map((goal, index) => (
            <li key={index} className="flex gap-2">
              <input
                className="input"
                value={goal.text}
                onChange={(e) => updateGoalText(index, e.target.value)}
                placeholder={`목표 ${index + 1}`}
                maxLength={200}
              />
              <button
                type="button"
                className="btn-secondary px-3"
                onClick={() => setGoals(goals.filter((_, i) => i !== index))}
                aria-label={`목표 ${index + 1} 삭제`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {goals.length < MAX_WEEKLY_GOALS && (
          <button
            type="button"
            className="mt-2 text-sm font-medium text-indigo-600"
            onClick={() => setGoals([...goals, { text: '', done: false }])}
          >
            + 목표 추가
          </button>
        )}
      </fieldset>

      <label className="block text-sm font-medium">
        연결할 1년 목표
        <select className="input mt-1" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">연결 안 함</option>
          {goalsOptions.map((g) => (
            <option key={g._id} value={g._id}>
              {g.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        주간 메모
        <textarea className="input mt-1 min-h-20" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={5000} />
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
