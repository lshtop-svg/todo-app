import ProgressBar from '@/components/weekly/ProgressBar';

interface GoalProgressProps {
  progress: number;
  done: number;
  total: number;
}

export default function GoalProgress({ progress, done, total }: GoalProgressProps) {
  return (
    <div className="space-y-1">
      <ProgressBar value={progress} label="진행률" />
      <p className="text-xs text-gray-500">
        연결된 할일 {total}개 중 {done}개 완료
      </p>
    </div>
  );
}
