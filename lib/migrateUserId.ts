import { Goal } from '../models/Goal';
import { Todo } from '../models/Todo';
import { User } from '../models/User';
import { WeeklyPlan } from '../models/WeeklyPlan';

export type MigrationResult = {
  todos: number;
  goals: number;
  weeklyPlans: number;
  droppedLegacyIndex: boolean;
};

export class MigrationError extends Error {}

export type MigrationTarget = { githubUsername: string } | { githubId: number };

/**
 * userId 가 없는 기존 Todo / Goal / WeeklyPlan 을 지정한 GitHub 사용자 소유로 지정하고,
 * weekStart 단독 unique 인덱스를 (userId, weekStart) unique 인덱스로 교체한다. 여러 번 실행해도 안전하다.
 * 사용자명은 중복될 수 있어 여러 명과 일치하면 실패하며, 이때는 githubId 로 지정한다.
 * 호출 전에 mongoose 연결이 되어 있어야 한다.
 */
export async function migrateUserId(target: string | MigrationTarget): Promise<MigrationResult> {
  const byId = typeof target === 'object' && 'githubId' in target;
  const username = typeof target === 'string' ? target : 'githubUsername' in target ? target.githubUsername : '';
  const users = await User.find(byId ? { githubId: target.githubId } : { username }, { _id: 1, githubId: 1 }).lean();
  const label = byId ? `GitHub ID ${target.githubId}` : `GitHub 사용자 '${username}'`;
  if (users.length === 0) {
    throw new MigrationError(`${label} 를 찾을 수 없습니다. 먼저 해당 계정으로 앱에 한 번 로그인하세요.`);
  }
  if (users.length > 1) {
    const ids = users.map((u) => u.githubId).join(', ');
    throw new MigrationError(
      `사용자명 '${username}' 와 일치하는 사용자가 ${users.length}명입니다 (githubId: ${ids}). ` +
        `--github-id <숫자 ID> 로 지정하세요. / Multiple users match; pass --github-id <numeric id>.`,
    );
  }
  const user = users[0];

  // updatedAt 이 바뀌지 않도록 컬렉션 드라이버로 직접 갱신
  const legacy = { $or: [{ userId: { $exists: false } }, { userId: null }] };
  const set = { $set: { userId: user._id } };
  const [todos, goals, weeklyPlans] = await Promise.all(
    [Todo, Goal, WeeklyPlan].map((model) => model.collection.updateMany(legacy, set)),
  );

  let droppedLegacyIndex = false;
  const indexes = await WeeklyPlan.collection.indexes().catch(() => []);
  for (const index of indexes) {
    const keys = Object.keys(index.key);
    if (index.name && keys.length === 1 && keys[0] === 'weekStart' && index.unique) {
      await WeeklyPlan.collection.dropIndex(index.name);
      droppedLegacyIndex = true;
    }
  }
  // 스키마에 정의된 인덱스 생성 (userId 인덱스, (userId, weekStart) unique)
  await Promise.all([Todo.createIndexes(), Goal.createIndexes(), WeeklyPlan.createIndexes()]);

  return {
    todos: todos.modifiedCount,
    goals: goals.modifiedCount,
    weeklyPlans: weeklyPlans.modifiedCount,
    droppedLegacyIndex,
  };
}
