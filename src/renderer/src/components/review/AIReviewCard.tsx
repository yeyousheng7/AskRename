import { SparklesIcon } from 'lucide-react';
import { FloatingPreviewBar } from '@/components/shared/FloatingPreviewBar';

export function AIReviewCard({
  count,
  isApplying,
  onDiscard,
  onApply
}: {
  count: number;
  isApplying: boolean;
  onDiscard: () => void;
  onApply: () => void;
}): React.JSX.Element {
  return (
    <FloatingPreviewBar
      title="AI 重命名预览"
      icon={<SparklesIcon className="h-3.5 w-3.5" />}
      content={
        <div className="text-xs text-zinc-600 dark:text-zinc-300">已生成 {count} 个文件名</div>
      }
      isLoading={isApplying}
      onCancel={onDiscard}
      onConfirm={onApply}
    />
  );
}
