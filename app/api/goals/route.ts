import { connectDB } from '@/lib/mongodb';
import { handle, toJSON } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { goalSchema } from '@/lib/validation';
import { Goal } from '@/models/Goal';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const userId = await requireUser(req);
  await connectDB();
  const goals = await Goal.find({ userId }).sort({ createdAt: -1 }).lean();
  return Response.json(toJSON(goals));
});

export const POST = handle(async (req) => {
  const userId = await requireUser(req);
  const input = goalSchema.parse(await req.json());
  await connectDB();
  const goal = await Goal.create({ ...input, userId });
  return Response.json(toJSON(goal.toObject()), { status: 201 });
});
