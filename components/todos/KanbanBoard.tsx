'use client';

import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { computeDrop } from '@/lib/kanban';
import { sortColumn } from '@/lib/utils';
import { useStore } from '@/store';
import { TODO_STATUSES, type Todo } from '@/types';
import KanbanColumn from './KanbanColumn';
import { TodoCardView } from './TodoCard';

interface KanbanBoardProps {
  onCardClick: (todo: Todo) => void;
}

export default function KanbanBoard({ onCardClick }: KanbanBoardProps) {
  const todos = useStore((s) => s.todos);
  const goals = useStore((s) => s.goals);
  const moveTodo = useStore((s) => s.moveTodo);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = useMemo(
    () => Object.fromEntries(TODO_STATUSES.map((s) => [s, sortColumn(todos.filter((t) => t.status === s))])),
    [todos],
  );
  const goalTitles = useMemo(() => new Map(goals.map((g) => [g._id, g.title])), [goals]);
  const activeTodo = activeId ? todos.find((t) => t._id === activeId) : undefined;

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    if (!over) return;
    const drop = computeDrop(todos, String(active.id), String(over.id));
    // 카드 1건만 PATCH (낙관적 업데이트 + 실패 시 롤백)
    if (drop) moveTodo(String(active.id), drop.status, drop.order);
  };

  const handleCardClick = (todo: Todo) => {
    // 드래그 직후 발생하는 click 은 무시
    if (Date.now() - lastDragEnd.current > 250) onCardClick(todo);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {TODO_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            todos={columns[status]}
            goalTitles={goalTitles}
            onCardClick={handleCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTodo && (
          <TodoCardView
            todo={activeTodo}
            goalTitle={activeTodo.goalId ? goalTitles.get(activeTodo.goalId) : undefined}
            dragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
