'use client';

import { useState } from 'react';
import Modal from '@/components/shared/Modal';
import { errorMessage } from '@/lib/fetcher';
import { useStore } from '@/store';
import type { Todo, TodoInput } from '@/types';
import TodoForm from './TodoForm';

interface TodoModalProps {
  open: boolean;
  onClose: () => void;
  /** 수정할 할일 (없으면 생성 모드) */
  todo?: Todo | null;
  /** 생성 모드 기본값 (예: WeekGrid 에서 요일/주간 계획 지정) */
  defaults?: Partial<TodoInput>;
}

export default function TodoModal({ open, onClose, todo, defaults }: TodoModalProps) {
  const addTodo = useStore((s) => s.addTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!todo || !window.confirm(`"${todo.title}" 할일을 삭제할까요?`)) return;
    try {
      await deleteTodo(todo._id);
      onClose();
    } catch (error) {
      setDeleteError(errorMessage(error));
    }
  };

  return (
    <Modal open={open} title={todo ? '할일 수정' : '새 할일'} onClose={onClose}>
      <TodoForm
        key={todo?._id ?? 'new'}
        initial={todo ?? { title: '', ...defaults }}
        submitLabel={todo ? '저장' : '추가'}
        onCancel={onClose}
        onSubmit={async (input) => {
          if (todo) await updateTodo(todo._id, input);
          else await addTodo(input);
          onClose();
        }}
      />
      {todo && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
          <button type="button" className="btn-danger w-full" onClick={handleDelete}>
            할일 삭제
          </button>
        </div>
      )}
    </Modal>
  );
}
