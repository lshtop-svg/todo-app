import { Goal } from '@/models/Goal';
import { Todo } from '@/models/Todo';
import { percent } from './utils';

type Ref = { toString(): string } | string | null | undefined;

/** 연결된 할일 완료율로 목표 progress 를 다시 계산해 저장한다 */
export async function recalcGoalProgress(...goalIds: Ref[]): Promise<void> {
  const ids = Array.from(new Set(goalIds.filter((id): id is NonNullable<Ref> => !!id).map(String)));
  await Promise.all(
    ids.map(async (goalId) => {
      // 목표 소유자의 할일만 집계 (다른 사용자가 같은 goalId 를 참조해도 영향 없음)
      const goal = await Goal.findById(goalId, { userId: 1 }).lean();
      if (!goal) return;
      const [total, done] = await Promise.all([
        Todo.countDocuments({ goalId, userId: goal.userId }),
        Todo.countDocuments({ goalId, userId: goal.userId, status: 'done' }),
      ]);
      await Goal.updateOne({ _id: goalId }, { progress: percent(done, total) });
    }),
  );
}
