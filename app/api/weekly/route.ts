import { connectDB } from '@/lib/mongodb';
import { ApiError, handle, searchParams, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { weekStartToUTC } from '@/lib/utils';
import { weeklyQuerySchema, weeklySchema } from '@/lib/validation';
import { WeeklyPlan } from '@/models/WeeklyPlan';

export const dynamic = 'force-dynamic';

// GET /api/weekly?weekStart=YYYY-MM-DD&limit=4
export const GET = handle(async (req) => {
  const userId = await requireUser(req);
  const query = weeklyQuerySchema.parse(searchParams(req));
  await connectDB();
  const filter = query.weekStart ? { weekStart: weekStartToUTC(query.weekStart) } : {};
  const plans = await WeeklyPlan.find({ ...filter, userId })
    .sort({ weekStart: -1 })
    .limit(query.limit ?? 0)
    .lean();
  return Response.json(toJSON(plans));
});

export const POST = handle(async (req) => {
  const userId = await requireUser(req);
  const input = weeklySchema.parse(await req.json());
  const weekStart = weekStartToUTC(input.weekStart);
  await connectDB();
  if (await WeeklyPlan.exists({ weekStart, userId })) throw new ApiError(409, '해당 주의 주간 계획이 이미 존재합니다');
  const plan = await WeeklyPlan.create({ ...input, weekStart, userId });
  return Response.json(toJSON(plan.toObject()), { status: 201 });
});
