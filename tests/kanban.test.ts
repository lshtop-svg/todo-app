import { describe, expect, it } from 'vitest';
import { computeDrop } from '@/lib/kanban';
import { sortColumn } from '@/lib/utils';
import type { Todo } from '@/types';

const todo = (id: string, status: Todo['status'], order: string, priority: Todo['priority'] = 'medium'): Todo => ({
  _id: id,
  title: id,
  status,
  priority,
  order,
  createdAt: '',
  updatedAt: '',
});

/** computeDrop 결과를 적용한 뒤 해당 컬럼의 표시 순서 */
function applyDrop(todos: Todo[], activeId: string, overId: string) {
  const drop = computeDrop(todos, activeId, overId);
  if (!drop) return null;
  const next = todos.map((t) => (t._id === activeId ? { ...t, ...drop } : t));
  return sortColumn(next.filter((t) => t.status === drop.status)).map((t) => t._id);
}

const board = [
  todo('a', 'todo', 'a0'),
  todo('b', 'todo', 'a1'),
  todo('c', 'todo', 'a2'),
  todo('x', 'doing', 'a0'),
  todo('y', 'doing', 'a1'),
];

describe('computeDrop', () => {
  it('같은 컬럼 아래로 이동 (a → c 위치)', () => {
    expect(applyDrop(board, 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('같은 컬럼 위로 이동 (c → a 위치)', () => {
    expect(applyDrop(board, 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('다른 컬럼의 카드 위로 이동하면 그 앞에 삽입', () => {
    expect(applyDrop(board, 'b', 'y')).toEqual(['x', 'b', 'y']);
    expect(computeDrop(board, 'b', 'y')?.status).toBe('doing');
  });

  it('컬럼 빈 영역에 놓으면 마지막에 추가 (빈 컬럼 포함)', () => {
    expect(applyDrop(board, 'a', 'column:doing')).toEqual(['x', 'y', 'a']);
    const drop = computeDrop(board, 'a', 'column:done');
    expect(drop?.status).toBe('done');
    expect(drop?.order).toBe('a0');
  });

  it('위치 변화가 없으면 null (PATCH 생략)', () => {
    expect(computeDrop(board, 'a', 'a')).toBeNull();
    expect(computeDrop(board, 'c', 'column:todo')).toBeNull();
  });

  it('High 우선순위 고정: 일반 카드는 고정 카드 위로 올라가지 않는다', () => {
    const withPinned = [...board, todo('h', 'todo', 'a5', 'high')];
    // 표시 순서: h, a, b, c
    expect(sortColumn(withPinned.filter((t) => t.status === 'todo')).map((t) => t._id)).toEqual(['h', 'a', 'b', 'c']);
    expect(applyDrop(withPinned, 'c', 'h')).toEqual(['h', 'c', 'a', 'b']);
  });

  it('High 카드끼리 순서 변경', () => {
    const pinned = [todo('h1', 'todo', 'a0', 'high'), todo('h2', 'todo', 'a1', 'high'), todo('m', 'todo', 'Zz')];
    expect(applyDrop(pinned, 'h2', 'h1')).toEqual(['h2', 'h1', 'm']);
  });
});
