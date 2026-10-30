'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/fetcher';
import type { GoalInput } from '@/types';

interface GoalFormProps {
  initial?: GoalInput;
  submitLabel: string;
  onSubmit: (input: GoalInput) => Promise<void>;
  onCancel: () => void;
}

export default function GoalForm({ initial, submitLabel, onSubmit, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('제목을 입력하세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), description });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        제목 <span className="text-red-500">*</span>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} autoFocus />
      </label>
      <label className="block text-sm font-medium">
        설명
        <textarea
          className="input mt-1 min-h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder="이 목표를 왜 이루고 싶은지 적어보세요"
        />
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
