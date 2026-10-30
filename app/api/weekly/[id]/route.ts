import { connectDB } from '@/lib/mongodb';
import { ApiError, handle, notFound, parseId, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { weekStartToUTC } from '@/lib/utils';
import { weeklyPatchSchema, weeklySchema } from '@/lib/validation';
import { Todo } from '@/models/Todo';
import { WeeklyPlan } from '@/models/WeeklyPlan';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const plan = await WeeklyPlan.findOne({ _id: id, userId }).lean();
  if (!plan) notFound('주간 계획');
  return Response.json(toJSON(plan));
});

export const PUT = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  const input = weeklySchema.parse(await req.json());
  const weekStart = weekStartToUTC(input.weekStart);
  await connectDB();
  if (await WeeklyPlan.exists({ weekStart, userId, _id: { $ne: id } })) {
    throw new ApiError(409, '해당 주의 주간 계획이 이미 존재합니다');
  }
  const plan = await WeeklyPlan.findOneAndUpdate(
    { _id: id, userId },
    { ...input, weekStart, goalId: input.goalId ?? null },
    { new: true, runValidators: true },
  ).lean();
  if (!plan) notFound('주간 계획');
  return Response.json(toJSON(plan));
});

// PATCH: goals[goalIndex].done 토글
export const PATCH = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  const { goalIndex, done } = weeklyPatchSchema.parse(await req.json());
  await connectDB();
  const existing = await WeeklyPlan.findOne({ _id: id, userId }, { goals: 1 }).lean();
  if (!existing) notFound('주간 계획');
  if (goalIndex >= existing.goals.length) throw new ApiError(400, '존재하지 않는 목표 인덱스입니다');
  const plan = await WeeklyPlan.findOneAndUpdate(
    { _id: id, userId },
    { $set: { [`goals.${goalIndex}.done`]: done } },
    { new: true },
  ).lean();
  if (!plan) notFound('주간 계획');
  return Response.json(toJSON(plan));
});

export const DELETE = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const plan = await WeeklyPlan.findOneAndDelete({ _id: id, userId }).lean();
  if (!plan) notFound('주간 계획');
  await Todo.updateMany({ weeklyPlanId: id }, { weeklyPlanId: null });
  return Response.json({ ok: true });
});
