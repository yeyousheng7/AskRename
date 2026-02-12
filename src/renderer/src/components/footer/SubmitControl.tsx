import { ArrowUpIcon, LoaderIcon, SquareIcon } from 'lucide-react';
import type { AISessionState } from '@/types/ai';
import { cn } from '@/lib/utils';

export function FooterSubmitControl({
  aiSession,
  disableSubmitForReview,
  isRenaming,
  isApplying,
  isEmpty,
  isDisabled,
  canSubmit,
  primaryTitle,
  onStop,
  onPrimary
}: {
  aiSession: AISessionState;
  disableSubmitForReview: boolean;
  isRenaming: boolean;
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
      {isRenaming || aiSession === 'loading' ? (
        // Loading 或 Renaming 状态：显示停止按钮或 Spinner
        aiSession === 'loading' ? (
          <button
            onClick={onStop}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center',
              'bg-red-500 text-white hover:bg-red-600',
              'transition-all duration-200 hover:scale-105'
            )}
            title="生成中..."
          >
            <SquareIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onStop}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center',
              'bg-red-500 text-white hover:bg-red-600',
              'transition-all duration-200 hover:scale-105'
            )}
            title="停止生成"
          >
            <SquareIcon className="h-3.5 w-3.5" />
          </button>
        )
      ) : disableSubmitForReview ? (
        // Review 状态且无文本：显示确认按钮
        <button
          onClick={onPrimary}
          disabled
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'transition-all duration-200',
            'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          )}
          title="无消息"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      ) : (
        // 其他状态：显示发送按钮
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
