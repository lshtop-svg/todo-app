import Link from 'next/link';
import { formatWeekRange, getWeekStart, isoToDateKey, weeklyProgress } from '@/lib/utils';
import type { WeeklyPlan } from '@/types';
import Badge from '@/components/shared/Badge';
import ProgressBar from './ProgressBar';

interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
  goalTitle?: string;
}

export default function WeeklyPlanCard({ plan, goalTitle }: WeeklyPlanCardProps) {
  const isThisWeek = isoToDateKey(plan.weekStart) === getWeekStart();
  const done = plan.goals.filter((g) => g.done).length;

  return (
    <Link href={`/weekly/${plan._id}`} className="card block space-y-3 hover:border-indigo-300">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{formatWeekRange(plan.weekStart)}</h3>
        {isThisWeek && <Badge className="bg-indigo-100 text-indigo-700">이번 주</Badge>}
      </div>
      {goalTitle && <p className="text-xs text-indigo-700">🎯 {goalTitle}</p>}
      <ProgressBar value={weeklyProgress(plan.goals)} label={`목표 ${done}/${plan.goals.length} 완료`} />
      {plan.memo && <p className="line-clamp-2 text-sm text-gray-600">{plan.memo}</p>}
    </Link>
  );
}
