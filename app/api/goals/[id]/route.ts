import { connectDB } from '@/lib/mongodb';
import { handle, notFound, parseId, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { goalSchema } from '@/lib/validation';
import { Goal } from '@/models/Goal';
import { Todo } from '@/models/Todo';
import { WeeklyPlan } from '@/models/WeeklyPlan';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const goal = await Goal.findOne({ _id: id, userId }).lean();
  if (!goal) notFound('목표');
  return Response.json(toJSON(goal));
});

export const PUT = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  const input = goalSchema.parse(await req.json());
  await connectDB();
  const goal = await Goal.findOneAndUpdate({ _id: id, userId }, input, { new: true, runValidators: true }).lean();
  if (!goal) notFound('목표');
  return Response.json(toJSON(goal));
});

export const DELETE = handle<Params>(async (req, { params }) => {
  const userId = await requireUser(req);
  const id = parseId(params.id);
  await connectDB();
  const goal = await Goal.findOneAndDelete({ _id: id, userId }).lean();
  if (!goal) notFound('목표');
  // 연결된 할일/주간 계획의 참조 해제
  await Promise.all([
    Todo.updateMany({ goalId: id }, { goalId: null }),
    WeeklyPlan.updateMany({ goalId: id }, { goalId: null }),
  ]);
  return Response.json({ ok: true });
});
