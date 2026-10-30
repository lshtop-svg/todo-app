import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDB } from '@/lib/mongodb';
import { MigrationError, migrateUserId } from '@/lib/migrateUserId';
import { Goal } from '@/models/Goal';
import { Todo } from '@/models/Todo';
import { User } from '@/models/User';
import { WeeklyPlan } from '@/models/WeeklyPlan';

const run = promisify(execFile);
let mongo: MongoMemoryServer;
let uri: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  uri = mongo.getUri('migration-test');
  process.env.MONGODB_URI = uri;
  await connectDB();
  // 자동 인덱스 생성이 끝난 뒤 레거시 상태를 만들도록 대기
  await Promise.all([User.init(), Todo.init(), Goal.init(), WeeklyPlan.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/** 로그인 기능 도입 전 상태: userId 없는 문서 + weekStart 단독 unique 인덱스 */
async function seedLegacy() {
  await mongoose.connection.db!.dropDatabase();
  const now = new Date('2024-01-01T00:00:00Z');
  await WeeklyPlan.collection.createIndex({ weekStart: 1 }, { unique: true });
  await WeeklyPlan.collection.insertMany([
    { weekStart: new Date('2024-09-02T00:00:00Z'), goals: [], memo: '', retrospective: '', goalId: null, createdAt: now, updatedAt: now },
    { weekStart: new Date('2024-09-09T00:00:00Z'), goals: [], memo: '', retrospective: '', goalId: null, createdAt: now, updatedAt: now },
  ]);
  await Goal.collection.insertOne({ title: 'legacy goal', description: '', progress: 0, createdAt: now, updatedAt: now });
  await Todo.collection.insertMany(
    ['a', 'b', 'c'].map((title, i) => ({ title, status: 'todo', priority: 'medium', order: `a${i}`, createdAt: now, updatedAt: now })),
  );
}

beforeEach(seedLegacy);

describe('migrateUserId', () => {
  it('userId 없는 문서를 지정 사용자에게 할당하고, 두 번째 실행은 0건', async () => {
    const owner = await User.create({ githubId: 1, username: 'owner', avatarUrl: '' });
    // 이미 다른 사용자 소유인 문서는 건드리지 않는다
    const other = await User.create({ githubId: 2, username: 'other', avatarUrl: '' });
    await Todo.create({ userId: other._id, title: 'other todo', order: 'a0' });

    const first = await migrateUserId('owner');
    expect(first).toEqual({ todos: 3, goals: 1, weeklyPlans: 2, droppedLegacyIndex: true });

    expect(await Todo.countDocuments({ userId: owner._id })).toBe(3);
    expect(await Todo.countDocuments({ userId: other._id })).toBe(1);
    expect(await Goal.countDocuments({ userId: owner._id })).toBe(1);
    expect(await WeeklyPlan.countDocuments({ userId: owner._id })).toBe(2);
    expect(await Todo.countDocuments({ userId: { $exists: false } })).toBe(0);
    // updatedAt 은 유지
    const legacyTodo = await Todo.collection.findOne({ title: 'a' });
    expect(legacyTodo!.updatedAt).toEqual(new Date('2024-01-01T00:00:00Z'));

    const second = await migrateUserId('owner');
    expect(second).toEqual({ todos: 0, goals: 0, weeklyPlans: 0, droppedLegacyIndex: false });
  });

  it('weekStart 단독 unique 인덱스를 제거하고 (userId, weekStart) unique 인덱스를 보장', async () => {
    await User.create({ githubId: 1, username: 'owner', avatarUrl: '' });
    await migrateUserId('owner');

    const indexes = await WeeklyPlan.collection.indexes();
    expect(indexes.find((i) => JSON.stringify(i.key) === '{"weekStart":1}')).toBeUndefined();
    const compound = indexes.find((i) => JSON.stringify(i.key) === '{"userId":1,"weekStart":1}');
    expect(compound?.unique).toBe(true);

    // 다른 사용자는 같은 주를 가질 수 있지만, 같은 사용자는 불가
    const second = new Types.ObjectId();
    const weekStart = new Date('2024-09-02T00:00:00Z');
    await expect(WeeklyPlan.create({ userId: second, weekStart })).resolves.toBeTruthy();
    await expect(WeeklyPlan.create({ userId: second, weekStart })).rejects.toMatchObject({ code: 11000 });
  });

  it('사용자가 없으면 MigrationError 이고 아무 것도 바꾸지 않음', async () => {
    await expect(migrateUserId('nobody')).rejects.toBeInstanceOf(MigrationError);
    expect(await Todo.countDocuments({ userId: { $exists: false } })).toBe(3);
    const indexes = await WeeklyPlan.collection.indexes();
    expect(indexes.some((i) => JSON.stringify(i.key) === '{"weekStart":1}')).toBe(true);
  });

  it('같은 사용자명의 User 가 둘이면 실패하고 아무 문서도 바꾸지 않음', async () => {
    await User.create({ githubId: 11, username: 'dup', avatarUrl: '' });
    await User.create({ githubId: 12, username: 'dup', avatarUrl: '' });
    const error = await migrateUserId('dup').catch((e) => e);
    expect(error).toBeInstanceOf(MigrationError);
    expect(error.message).toContain('11');
    expect(error.message).toContain('12');
    expect(error.message).toContain('--github-id');
    expect(await Todo.countDocuments({ userId: { $exists: false } })).toBe(3);
    expect(await Goal.countDocuments({ userId: { $exists: false } })).toBe(1);
    expect(await WeeklyPlan.countDocuments({ userId: { $exists: false } })).toBe(2);
  });

  it('githubId 로 올바른 User 를 선택하고 재실행은 0건', async () => {
    await User.create({ githubId: 11, username: 'dup', avatarUrl: '' });
    const chosen = await User.create({ githubId: 12, username: 'dup', avatarUrl: '' });
    const first = await migrateUserId({ githubId: 12 });
    expect(first).toEqual({ todos: 3, goals: 1, weeklyPlans: 2, droppedLegacyIndex: true });
    expect(await Todo.countDocuments({ userId: chosen._id })).toBe(3);
    expect(await migrateUserId({ githubId: 12 })).toEqual({ todos: 0, goals: 0, weeklyPlans: 0, droppedLegacyIndex: false });
    await expect(migrateUserId({ githubId: 999 })).rejects.toBeInstanceOf(MigrationError);
  });
});

describe('npm run migrate:user-id CLI', () => {
  it('사용자명이 중복이면 종료 코드 1 + githubId 안내, --github-id 로 성공', async () => {
    await User.create({ githubId: 21, username: 'dup', avatarUrl: '' });
    const chosen = await User.create({ githubId: 22, username: 'dup', avatarUrl: '' });
    const error = await cli('--github-username', 'dup').catch((e) => e);
    expect(error.code).toBe(1);
    expect(error.stderr).toContain('21');
    expect(error.stderr).toContain('22');
    expect(error.stderr).toContain('--github-id');
    expect(await Todo.countDocuments({ userId: { $exists: false } })).toBe(3);

    const ok = await cli('--github-id', '22');
    expect(ok.stdout).toContain('todos: 3건');
    expect(await Todo.countDocuments({ userId: chosen._id })).toBe(3);
  });

  // 메모리 DB 의 URI 를 명시적으로 전달 (실제 DB 에는 접속하지 않음)
  const cli = (...args: string[]) =>
    run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate-user-id.ts', ...args], {
      env: { ...process.env, MONGODB_URI: uri },
    });

  it('존재하지 않는 사용자면 0 이 아닌 코드로 종료', async () => {
    const error = await cli('--github-username', 'nobody').catch((e) => e);
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("'nobody'");
  });

  it('인자가 없으면 사용법을 출력하고 실패', async () => {
    const error = await cli().catch((e) => e);
    expect(error.code).toBe(1);
    expect(error.stderr).toContain('--github-username');
  });

  it('정상 실행 후 재실행은 0건', async () => {
    await User.create({ githubId: 1, username: 'owner', avatarUrl: '' });
    const first = await cli('--github-username', 'owner');
    expect(first.stdout).toContain('todos: 3건');
    const second = await cli('--github-username=owner');
    expect(second.stdout).toContain('todos: 0건');
    expect(second.stdout).toContain('goals: 0건');
    expect(second.stdout).toContain('weeklyPlans: 0건');
  });
});
