import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as goalsRoute from '@/app/api/goals/route';
import * as goalRoute from '@/app/api/goals/[id]/route';
import * as weeklyRoute from '@/app/api/weekly/route';
import * as weeklyItemRoute from '@/app/api/weekly/[id]/route';
import * as todosRoute from '@/app/api/todos/route';
import * as todoRoute from '@/app/api/todos/[id]/route';
import { connectDB } from '@/lib/mongodb';
import { Goal } from '@/models/Goal';
import { Todo } from '@/models/Todo';
import { WeeklyPlan } from '@/models/WeeklyPlan';
import { authenticate, call, loginAs } from './helpers';

let mongo: MongoMemoryServer;
let a: { userId: string; cookie: string };
let b: { userId: string; cookie: string };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('ownership-test');
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await WeeklyPlan.createIndexes();
  authenticate(undefined);
  a = await loginAs('alice');
  b = await loginAs('bob');
});

/** 사용자 A 의 목표/주간 계획/할일 생성 */
async function seedA() {
  const goal = await call(goalsRoute.POST, { method: 'POST', cookie: a.cookie, body: { title: 'A 목표' } });
  const plan = await call(weeklyRoute.POST, {
    method: 'POST',
    cookie: a.cookie,
    body: { weekStart: '2024-09-02', goals: [{ text: 'A 주간 목표' }] },
  });
  const todo = await call(todosRoute.POST, {
    method: 'POST',
    cookie: a.cookie,
    body: { title: 'A 할일', goalId: goal.body._id, weeklyPlanId: plan.body._id },
  });
  return { goalId: goal.body._id as string, planId: plan.body._id as string, todoId: todo.body._id as string };
}

describe('사용자별 데이터 격리', () => {
  it('B 의 목록에는 A 의 데이터가 없다', async () => {
    await seedA();
    for (const handler of [todosRoute.GET, goalsRoute.GET, weeklyRoute.GET]) {
      expect((await call(handler, { cookie: b.cookie })).body).toEqual([]);
      expect((await call(handler, { cookie: a.cookie })).body).toHaveLength(1);
    }
    const byWeek = await call(weeklyRoute.GET, { cookie: b.cookie, url: 'http://localhost/api/weekly?weekStart=2024-09-02' });
    expect(byWeek.body).toEqual([]);
  });

  it('B 가 A 의 할일을 id 로 조회/수정/이동/삭제하면 404', async () => {
    const { todoId } = await seedA();
    const params = { id: todoId };
    const opts = { cookie: b.cookie, params };
    expect((await call(todoRoute.GET, opts)).status).toBe(404);
    expect((await call(todoRoute.PUT, { ...opts, method: 'PUT', body: { title: '해킹' } })).status).toBe(404);
    expect((await call(todoRoute.PATCH, { ...opts, method: 'PATCH', body: { status: 'done' } })).status).toBe(404);
    expect((await call(todoRoute.DELETE, { ...opts, method: 'DELETE' })).status).toBe(404);

    const own = await call(todoRoute.GET, { cookie: a.cookie, params });
    expect(own.status).toBe(200);
    expect(own.body.title).toBe('A 할일');
    expect(own.body.status).toBe('todo');
  });

  it('B 가 A 의 목표를 id 로 조회/수정/삭제하면 404', async () => {
    const { goalId, todoId } = await seedA();
    const opts = { cookie: b.cookie, params: { id: goalId } };
    expect((await call(goalRoute.GET, opts)).status).toBe(404);
    expect((await call(goalRoute.PUT, { ...opts, method: 'PUT', body: { title: '해킹' } })).status).toBe(404);
    expect((await call(goalRoute.DELETE, { ...opts, method: 'DELETE' })).status).toBe(404);

    expect((await call(goalRoute.GET, { cookie: a.cookie, params: { id: goalId } })).body.title).toBe('A 목표');
    expect((await call(todoRoute.GET, { cookie: a.cookie, params: { id: todoId } })).body.goalId).toBe(goalId);
  });

  it('B 가 A 의 주간 계획을 id 로 조회/수정/토글/삭제하면 404', async () => {
    const { planId, todoId } = await seedA();
    const opts = { cookie: b.cookie, params: { id: planId } };
    expect((await call(weeklyItemRoute.GET, opts)).status).toBe(404);
    expect((await call(weeklyItemRoute.PUT, { ...opts, method: 'PUT', body: { weekStart: '2024-09-09' } })).status).toBe(404);
    expect((await call(weeklyItemRoute.PATCH, { ...opts, method: 'PATCH', body: { goalIndex: 0, done: true } })).status).toBe(404);
    expect((await call(weeklyItemRoute.DELETE, { ...opts, method: 'DELETE' })).status).toBe(404);

    const own = await call(weeklyItemRoute.GET, { cookie: a.cookie, params: { id: planId } });
    expect(own.body.goals).toEqual([{ text: 'A 주간 목표', done: false }]);
    expect((await call(todoRoute.GET, { cookie: a.cookie, params: { id: todoId } })).body.weeklyPlanId).toBe(planId);
  });

  it('두 사용자가 같은 주의 주간 계획을 각각 만들 수 있다 (사용자 내에서는 여전히 409)', async () => {
    const body = { weekStart: '2024-09-04' };
    expect((await call(weeklyRoute.POST, { method: 'POST', cookie: a.cookie, body })).status).toBe(201);
    expect((await call(weeklyRoute.POST, { method: 'POST', cookie: b.cookie, body })).status).toBe(201);
    expect((await call(weeklyRoute.POST, { method: 'POST', cookie: b.cookie, body })).status).toBe(409);
  });

  it('할일 order 는 사용자별 컬럼 기준으로 매겨진다', async () => {
    await seedA();
    const first = await call(todosRoute.POST, { method: 'POST', cookie: b.cookie, body: { title: 'B 첫 할일' } });
    expect(first.body.order).toBe('a0');
  });

  it('다른 사용자의 할일이 같은 goalId 를 참조해도 목표 progress 에 영향 없음', async () => {
    const { goalId } = await seedA();
    await call(todosRoute.POST, { method: 'POST', cookie: b.cookie, body: { title: 'B', goalId, status: 'done' } });
    expect((await call(goalRoute.GET, { cookie: a.cookie, params: { id: goalId } })).body.progress).toBe(0);
  });
});

describe('userId 는 요청 본문으로 바꿀 수 없다', () => {
  it('POST 본문의 userId 는 무시되고 세션 사용자로 저장', async () => {
    const opts = { method: 'POST', cookie: a.cookie };
    const todo = await call(todosRoute.POST, { ...opts, body: { title: 't', userId: b.userId } });
    const goal = await call(goalsRoute.POST, { ...opts, body: { title: 'g', userId: b.userId } });
    const plan = await call(weeklyRoute.POST, { ...opts, body: { weekStart: '2024-09-02', userId: b.userId } });
    expect([todo.status, goal.status, plan.status]).toEqual([201, 201, 201]);
    expect(todo.body.userId).toBe(a.userId);
    expect(goal.body.userId).toBe(a.userId);
    expect(plan.body.userId).toBe(a.userId);
    expect(String((await Todo.findById(todo.body._id).lean())!.userId)).toBe(a.userId);
    expect(String((await Goal.findById(goal.body._id).lean())!.userId)).toBe(a.userId);
    expect(String((await WeeklyPlan.findById(plan.body._id).lean())!.userId)).toBe(a.userId);
  });

  it('PUT 본문의 userId 로 소유자를 바꿀 수 없다', async () => {
    const { todoId, goalId, planId } = await seedA();
    const opts = { method: 'PUT', cookie: a.cookie };
    await call(todoRoute.PUT, { ...opts, params: { id: todoId }, body: { title: 't', userId: b.userId } });
    await call(goalRoute.PUT, { ...opts, params: { id: goalId }, body: { title: 'g', userId: b.userId } });
    await call(weeklyItemRoute.PUT, { ...opts, params: { id: planId }, body: { weekStart: '2024-09-02', userId: b.userId } });
    expect(String((await Todo.findById(todoId).lean())!.userId)).toBe(a.userId);
    expect(String((await Goal.findById(goalId).lean())!.userId)).toBe(a.userId);
    expect(String((await WeeklyPlan.findById(planId).lean())!.userId)).toBe(a.userId);
  });
});
