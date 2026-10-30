import { connectDB } from '@/lib/mongodb';
import { handle, searchParams, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { keyAfter } from '@/lib/fractionalIndex';
import { recalcGoalProgress } from '@/lib/goalProgress';
import { dateKeyToUTC } from '@/lib/utils';
import { todoQuerySchema, todoSchema } from '@/lib/validation';
import { Todo } from '@/models/Todo';

export const dynamic = 'force-dynamic';

// GET /api/todos?status=&weeklyPlanId=&goalId=
export const GET = handle(async (req) => {
  const userId = await requireUser(req);
  const filter = todoQuerySchema.parse(searchParams(req));
  await connectDB();
  const todos = await Todo.find({ ...filter, userId }).sort({ status: 1, order: 1 }).lean();
  return Response.json(toJSON(todos));
});

export const POST = handle(async (req) => {
  const userId = await requireUser(req);
  const input = todoSchema.parse(await req.json());
  await connectDB();
  // 해당 상태 컬럼의 마지막에 추가
  const last = await Todo.findOne({ status: input.status, userId }, { order: 1 }).sort({ order: -1 }).lean();
  const todo = await Todo.create({
    ...input,
    userId,
    dueDate: input.dueDate ? dateKeyToUTC(input.dueDate) : null,
    order: keyAfter(last?.order ?? null),
  });
  await recalcGoalProgress(todo.goalId);
  return Response.json(toJSON(todo.toObject()), { status: 201 });
});
