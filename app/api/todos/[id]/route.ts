import type { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { handle, notFound, parseId, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { keyAfter } from '@/lib/fractionalIndex';
import { recalcGoalProgress } from '@/lib/goalProgress';
import { dateKeyToUTC } from '@/lib/utils';
import { todoPatchSchema, todoSchema } from '@/lib/validation';
import { Todo } from '@/models/Todo';

export const dynamic = 'force-dynamic';

type Params = { id: string };

async function lastOrderIn(status: string, excludeId: string, userId: Types.ObjectId): Promise<string | null> {
  const last = await Todo.findOne({ status, userId, _id: { $ne: excludeId } }, { order: 1 })
    .sort({ order: -1 })
    .lean();
  return last?.order ?? null;
}

export const GET = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const todo = await Todo.findOne({ _id: id, userId }).lean();
  if (!todo) notFound('할일');
  return Response.json(toJSON(todo));
});

export const PUT = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  const input = todoSchema.parse(await req.json());
  await connectDB();
  const before = await Todo.findOne({ _id: id, userId }).lean();
  if (!before) notFound('할일');
  const update: Record<string, unknown> = {
    ...input,
    dueDate: input.dueDate ? dateKeyToUTC(input.dueDate) : null,
    dayOfWeek: input.dayOfWeek ?? null,
    weeklyPlanId: input.weeklyPlanId ?? null,
    goalId: input.goalId ?? null,
  };
  // 상태가 바뀌면 새 컬럼의 마지막으로 이동
  if (input.status !== before.status) update.order = keyAfter(await lastOrderIn(input.status, id, userId));
  const todo = await Todo.findOneAndUpdate({ _id: id, userId }, update, { new: true, runValidators: true }).lean();
  if (!todo) notFound('할일');
  await recalcGoalProgress(before.goalId, todo.goalId);
  return Response.json(toJSON(todo));
});

// PATCH: 칸반 이동 (status / order) — 카드 1건만 갱신
export const PATCH = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  const input = todoPatchSchema.parse(await req.json());
  await connectDB();
  const update: { status?: string; order?: string } = { ...input };
  if (input.status && !input.order) update.order = keyAfter(await lastOrderIn(input.status, id, userId));
  const todo = await Todo.findOneAndUpdate({ _id: id, userId }, update, { new: true, runValidators: true }).lean();
  if (!todo) notFound('할일');
  if (input.status) await recalcGoalProgress(todo.goalId);
  return Response.json(toJSON(todo));
});

export const DELETE = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const todo = await Todo.findOneAndDelete({ _id: id, userId }).lean();
  if (!todo) notFound('할일');
  await recalcGoalProgress(todo.goalId);
  return Response.json({ ok: true });
});
