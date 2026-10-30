import { PRIORITY_LABELS } from '@/lib/utils';
import type { Priority } from '@/types';
import Badge from './Badge';

const COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={COLORS[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
