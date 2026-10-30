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
import { keyBetween } from '@/lib/fractionalIndex';
import { authenticate, call, loginAs } from './helpers';

let mongo: MongoMemoryServer;
const MISSING_ID = '507f1f77bcf86cd799439011';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('todo-test');
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  authenticate((await loginAs('tester')).cookie);
});

const createGoal = (title = '1년 목표') =>
  call(goalsRoute.POST, { method: 'POST', body: { title, description: '설명' } });
const createTodo = (body: Record<string, unknown>) => call(todosRoute.POST, { method: 'POST', body });

describe('goals API', () => {
  it('CRUD', async () => {
    const created = await createGoal();
    expect(created.status).toBe(201);
    expect(typeof created.body._id).toBe('string');
    expect(created.body.progress).toBe(0);
    expect(created.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.body.__v).toBeUndefined();

    const list = await call(goalsRoute.GET);
    expect(list.body).toHaveLength(1);

    const id = created.body._id;
    const got = await call(goalRoute.GET, { params: { id } });
    expect(got.body.title).toBe('1년 목표');

    const put = await call(goalRoute.PUT, { method: 'PUT', params: { id }, body: { title: '수정', description: '' } });
    expect(put.status).toBe(200);
    expect(put.body.title).toBe('수정');

    const del = await call(goalRoute.DELETE, { method: 'DELETE', params: { id } });
    expect(del.status).toBe(200);
    expect((await call(goalRoute.GET, { params: { id } })).status).toBe(404);
  });

  it('400: 잘못된 ObjectId / 빈 제목 / 잘못된 JSON', async () => {
    expect((await call(goalRoute.GET, { params: { id: 'not-an-id' } })).status).toBe(400);
    expect((await call(goalsRoute.POST, { method: 'POST', body: { title: '  ' } })).status).toBe(400);
    expect((await call(goalsRoute.POST, { method: 'POST', body: '{bad json' })).status).toBe(400);
  });

  it('404: 존재하지 않는 목표', async () => {
    expect((await call(goalRoute.GET, { params: { id: MISSING_ID } })).status).toBe(404);
    expect(
      (await call(goalRoute.PUT, { method: 'PUT', params: { id: MISSING_ID }, body: { title: 'x' } })).status,
    ).toBe(404);
    expect((await call(goalRoute.DELETE, { method: 'DELETE', params: { id: MISSING_ID } })).status).toBe(404);
  });

  it('progress 는 연결된 할일 완료율로 자동 계산되고, 삭제 시 연결이 해제된다', async () => {
    const goalId = (await createGoal()).body._id;
    const a = await createTodo({ title: 'a', goalId });
    await createTodo({ title: 'b', goalId });
    await call(todoRoute.PATCH, { method: 'PATCH', params: { id: a.body._id }, body: { status: 'done' } });
    expect((await call(goalRoute.GET, { params: { id: goalId } })).body.progress).toBe(50);

    await call(goalRoute.DELETE, { method: 'DELETE', params: { id: goalId } });
    const todo = await call(todoRoute.GET, { params: { id: a.body._id } });
    expect(todo.body.goalId).toBeNull();
  });
});

describe('weekly API', () => {
  const plan = { weekStart: '2024-09-04', goals: [{ text: '운동 3회', done: false }], memo: '메모' };

  it('CRUD + weekStart 를 월요일로 정규화', async () => {
    const created = await call(weeklyRoute.POST, { method: 'POST', body: plan });
    expect(created.status).toBe(201);
    expect(created.body.weekStart).toBe('2024-09-02T00:00:00.000Z');
    const id = created.body._id;

    const byWeek = await call(weeklyRoute.GET, { url: 'http://localhost/api/weekly?weekStart=2024-09-08' });
    expect(byWeek.body).toHaveLength(1);
    expect(byWeek.body[0]._id).toBe(id);

    const put = await call(weeklyItemRoute.PUT, {
      method: 'PUT',
      params: { id },
      body: { ...plan, memo: '수정된 메모', retrospective: '회고' },
    });
    expect(put.body.memo).toBe('수정된 메모');
    expect(put.body.retrospective).toBe('회고');

    expect((await call(weeklyItemRoute.GET, { params: { id } })).status).toBe(200);
    expect((await call(weeklyItemRoute.DELETE, { method: 'DELETE', params: { id } })).status).toBe(200);
    expect((await call(weeklyItemRoute.GET, { params: { id } })).status).toBe(404);
  });

  it('GET limit 은 최근 주 순으로 반환', async () => {
    for (const weekStart of ['2024-09-02', '2024-09-09', '2024-09-16']) {
      await call(weeklyRoute.POST, { method: 'POST', body: { weekStart } });
    }
    const res = await call(weeklyRoute.GET, { url: 'http://localhost/api/weekly?limit=2' });
    expect(res.body.map((p: { weekStart: string }) => p.weekStart.slice(0, 10))).toEqual(['2024-09-16', '2024-09-09']);
  });

  it('409: 같은 주 중복 생성/수정 불가', async () => {
    await call(weeklyRoute.POST, { method: 'POST', body: plan });
    const dup = await call(weeklyRoute.POST, { method: 'POST', body: { ...plan, weekStart: '2024-09-06' } });
    expect(dup.status).toBe(409);

    const other = await call(weeklyRoute.POST, { method: 'POST', body: { weekStart: '2024-09-10' } });
    const conflict = await call(weeklyItemRoute.PUT, {
      method: 'PUT',
      params: { id: other.body._id },
      body: { weekStart: '2024-09-03' },
    });
    expect(conflict.status).toBe(409);
  });

  it('400: 주간 목표는 최대 5개', async () => {
    const goals = Array.from({ length: 6 }, (_, i) => ({ text: `목표${i}`, done: false }));
    const res = await call(weeklyRoute.POST, { method: 'POST', body: { weekStart: '2024-09-02', goals } });
    expect(res.status).toBe(400);
    const ok = await call(weeklyRoute.POST, {
      method: 'POST',
      body: { weekStart: '2024-09-02', goals: goals.slice(0, 5) },
    });
    expect(ok.status).toBe(201);
  });

  it('PATCH goals[n].done 토글 후 응답에 반영', async () => {
    const created = await call(weeklyRoute.POST, {
      method: 'POST',
      body: { weekStart: '2024-09-02', goals: [{ text: 'a' }, { text: 'b' }] },
    });
    const id = created.body._id;
    const res = await call(weeklyItemRoute.PATCH, { method: 'PATCH', params: { id }, body: { goalIndex: 1, done: true } });
    expect(res.status).toBe(200);
    expect(res.body.goals).toEqual([
      { text: 'a', done: false },
      { text: 'b', done: true },
    ]);
    const outOfRange = await call(weeklyItemRoute.PATCH, {
      method: 'PATCH',
      params: { id },
      body: { goalIndex: 5, done: true },
    });
    expect(outOfRange.status).toBe(400);
  });

  it('400 / 404', async () => {
    expect((await call(weeklyItemRoute.GET, { params: { id: '123' } })).status).toBe(400);
    expect((await call(weeklyItemRoute.GET, { params: { id: MISSING_ID } })).status).toBe(404);
    expect(
      (await call(weeklyItemRoute.PATCH, { method: 'PATCH', params: { id: MISSING_ID }, body: { goalIndex: 0, done: true } }))
        .status,
    ).toBe(404);
    expect((await call(weeklyRoute.POST, { method: 'POST', body: { weekStart: '2024/09/02' } })).status).toBe(400);
  });
});

describe('todos API', () => {
  it('CRUD + 필터', async () => {
    const weekly = await call(weeklyRoute.POST, { method: 'POST', body: { weekStart: '2024-09-02' } });
    const created = await createTodo({
      title: '할일',
      priority: 'high',
      dueDate: '2024-09-05',
      dayOfWeek: 3,
      weeklyPlanId: weekly.body._id,
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('todo');
    expect(created.body.order).toBe('a0');
    expect(created.body.dueDate).toBe('2024-09-05T00:00:00.000Z');
    expect(created.body.weeklyPlanId).toBe(weekly.body._id);
    const id = created.body._id;

    await createTodo({ title: '다른 할일', status: 'doing' });
    const filtered = await call(todosRoute.GET, {
      url: `http://localhost/api/todos?weeklyPlanId=${weekly.body._id}`,
    });
    expect(filtered.body).toHaveLength(1);
    const doing = await call(todosRoute.GET, { url: 'http://localhost/api/todos?status=doing' });
    expect(doing.body).toHaveLength(1);
    expect((await call(todosRoute.GET, { url: 'http://localhost/api/todos?status=bad' })).status).toBe(400);

    const put = await call(todoRoute.PUT, {
      method: 'PUT',
      params: { id },
      body: { title: '수정됨', priority: 'low', dueDate: null },
    });
    expect(put.body.title).toBe('수정됨');
    expect(put.body.dueDate).toBeNull();
    expect(put.body.weeklyPlanId).toBeNull();

    expect((await call(todoRoute.DELETE, { method: 'DELETE', params: { id } })).status).toBe(200);
    expect((await call(todoRoute.GET, { params: { id } })).status).toBe(404);
  });

  it('새 할일은 컬럼 마지막 order 를 받는다', async () => {
    const a = await createTodo({ title: 'a' });
    const b = await createTodo({ title: 'b' });
    expect(b.body.order > a.body.order).toBe(true);
  });

  it('PATCH status/order: 카드 1건만 변경되고 order 문자열이 저장된다', async () => {
    const a = await createTodo({ title: 'a' });
    const b = await createTodo({ title: 'b' });
    const c = await createTodo({ title: 'c' });
    // c 를 a 와 b 사이로 이동
    const order = keyBetween(a.body.order, b.body.order);
    const res = await call(todoRoute.PATCH, {
      method: 'PATCH',
      params: { id: c.body._id },
      body: { status: 'doing', order },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('doing');
    expect(res.body.order).toBe(order);

    const all = await call(todosRoute.GET);
    const byId = Object.fromEntries(all.body.map((t: { _id: string }) => [t._id, t]));
    expect(byId[a.body._id].order).toBe(a.body.order);
    expect(byId[b.body._id].order).toBe(b.body.order);

    // status 만 보내면 대상 컬럼 마지막으로 이동
    const moved = await call(todoRoute.PATCH, { method: 'PATCH', params: { id: a.body._id }, body: { status: 'doing' } });
    expect(moved.body.order > order).toBe(true);
  });

  it('PATCH 400 / 404', async () => {
    const a = await createTodo({ title: 'a' });
    expect((await call(todoRoute.PATCH, { method: 'PATCH', params: { id: a.body._id }, body: {} })).status).toBe(400);
    expect(
      (await call(todoRoute.PATCH, { method: 'PATCH', params: { id: a.body._id }, body: { status: 'nope' } })).status,
    ).toBe(400);
    expect((await call(todoRoute.PATCH, { method: 'PATCH', params: { id: 'xyz' }, body: { status: 'done' } })).status).toBe(400);
    expect(
      (await call(todoRoute.PATCH, { method: 'PATCH', params: { id: MISSING_ID }, body: { status: 'done' } })).status,
    ).toBe(404);
    expect((await createTodo({ title: '' })).status).toBe(400);
    expect((await createTodo({ title: 'x', goalId: 'bad' })).status).toBe(400);
    expect((await createTodo({ title: 'x', dayOfWeek: 7 })).status).toBe(400);
  });
});
