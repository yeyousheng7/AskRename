import { Button } from '@/components/ui/button';
import type { Batch, BatchAIStatus } from '@/hooks/useBatchAI';
import { cn } from '@/lib/utils';

export function ProgressOverlay({
  open,
  status,
  completedFiles,
  totalFiles,
  progressPercent,
  batches,
  errorSummary,
  onCancel,
  onRetryFailed,
  onRetryBatch
}: {
  open: boolean;
  status: BatchAIStatus;
  completedFiles: number;
  totalFiles: number;
  progressPercent: number;
  batches: Batch[];
  errorSummary?: string;
  onCancel: () => void;
  onRetryFailed: () => void;
  onRetryBatch: (batchIndex: number) => void;
}): React.JSX.Element | null {
  if (!open) return null;

  const hasError = status === 'error';
  const failed = batches.filter((b) => b.status === 'error');

  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50',
        'bottom-28 w-[680px] max-w-[90vw]',
        'rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10',
        'bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl'
      )}
    >
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {hasError ? '智能重命名失败（可重试）' : '正在智能重命名...'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              ({completedFiles}/{totalFiles})
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasError && (
              <Button size="sm" variant="secondary" onClick={onRetryFailed}>
                重试失败批次
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {hasError ? '关闭' : '取消任务'}
            </Button>
          </div>
        </div>

        <div className="mt-3 h-2 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/60 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200',
              hasError ? 'bg-red-500' : 'bg-blue-500'
            )}
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>

        {hasError && (
          <div className="mt-3">
            {errorSummary && (
              <pre className="text-xs whitespace-pre-wrap rounded-lg bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2 text-zinc-700 dark:text-zinc-200 ring-1 ring-black/5 dark:ring-white/10">
                {errorSummary}
              </pre>
            )}

            {failed.length > 0 && (
              <div className="mt-3 space-y-2">
                {failed.slice(0, 5).map((b) => (
                  <div
                    key={b.batchId}
                    className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300"
                  >
                    <div className="min-w-0 truncate">
                      Batch {b.batchIndex + 1}（{b.items.length} 个）
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => onRetryBatch(b.batchIndex)}>
                      重试
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

