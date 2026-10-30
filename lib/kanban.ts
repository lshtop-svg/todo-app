import { keyBetween } from './fractionalIndex';
import { isPinned, sortColumn } from './utils';
import type { Todo, TodoStatus } from '@/types';

export const COLUMN_PREFIX = 'column:';

/**
 * 드래그 종료 시 카드의 새 status/order 를 계산한다.
 * overId 는 카드 id 또는 `column:<status>` (빈 영역 → 컬럼 끝).
 * High 우선순위는 상단 고정이므로 같은 그룹(고정/비고정) 안의 이웃 키 사이에 배치한다.
 * 위치 변화가 없으면 null.
 */
export function computeDrop(
  todos: Todo[],
  activeId: string,
  overId: string,
): { status: TodoStatus; order: string } | null {
  const active = todos.find((t) => t._id === activeId);
  if (!active) return null;

  let status: TodoStatus;
  let list: Todo[];

  if (overId.startsWith(COLUMN_PREFIX)) {
    status = overId.slice(COLUMN_PREFIX.length) as TodoStatus;
    list = [...sortColumn(todos.filter((t) => t.status === status && t._id !== activeId)), active];
  } else {
    const over = todos.find((t) => t._id === overId);
    if (!over) return null;
    status = over.status;
    const column = sortColumn(todos.filter((t) => t.status === status));
    list = column.filter((t) => t._id !== activeId);
    if (active.status === status) {
      // 같은 컬럼: over 카드 위치로 이동 (arrayMove)
      list.splice(column.findIndex((t) => t._id === overId), 0, active);
    } else {
      // 다른 컬럼: over 카드 앞에 삽입
      list.splice(list.findIndex((t) => t._id === overId), 0, active);
    }
  }

  if (active.status === status) {
    const before = sortColumn(todos.filter((t) => t.status === status)).map((t) => t._id);
    if (before.join() === list.map((t) => t._id).join()) return null;
  }

  const group = list.filter((t) => isPinned(t) === isPinned(active));
  const i = group.findIndex((t) => t._id === activeId);
  const order = keyBetween(group[i - 1]?.order ?? null, group[i + 1]?.order ?? null);
  return { status, order };
}
