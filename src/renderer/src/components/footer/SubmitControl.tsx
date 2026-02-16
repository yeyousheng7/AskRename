import { ArrowUpIcon, LoaderIcon, SquareIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FooterSubmitControl({
  disableSubmitForReview,
  isProcessing,
  isApplying,
  isEmpty,
  isDisabled,
  canSubmit,
  primaryTitle,
  onStop,
  onPrimary
}: {
  disableSubmitForReview: boolean;
  isProcessing: boolean;
  isApplying: boolean;
  isEmpty: boolean;
  isDisabled: boolean;
  canSubmit: string;
  primaryTitle: string;
  onStop: () => void;
  onPrimary: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center pr-3">
      {isProcessing ? (
        <button
          onClick={onStop}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'bg-red-500 text-white hover:bg-red-600',
            'transition-all duration-200 hover:scale-105'
          )}
          title="停止"
        >
          <SquareIcon className="h-3.5 w-3.5" />
        </button>
      ) : disableSubmitForReview ? (
        <button
          onClick={onPrimary}
          disabled
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'transition-all duration-200',
            'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          )}
          title="无可提交内容"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={onPrimary}
          disabled={isEmpty || !canSubmit || isDisabled}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'transition-all duration-200',
            canSubmit && !isEmpty && !isDisabled
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-105'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          )}
          title={primaryTitle}
        >
          {isApplying ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpIcon className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
