import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function PaginationBar({
  total,
  pageIndex,
  pageCount,
  pageSize,
  onPageIndexChange,
  onPageSizeChange
}: {
  total: number;
  pageIndex: number; // 0-based
  pageCount: number;
  pageSize: number; // Infinity means "all"
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
}): React.JSX.Element {
  const isAll = !Number.isFinite(pageSize);
  const effectiveSize = isAll ? total : pageSize;
  const start = total === 0 ? 0 : pageIndex * effectiveSize + 1;
  const end = total === 0 ? 0 : Math.min(total, pageIndex * effectiveSize + effectiveSize);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2',
        'border-b border-zinc-100 dark:border-zinc-800',
        'bg-white/70 dark:bg-zinc-950/50 backdrop-blur-sm'
      )}
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
        显示 {start}–{end} / {total}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          每页
          <select
            className={cn(
              'ml-2 h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700',
              'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/40'
            )}
            value={isAll ? 'all' : String(pageSize)}
            onChange={(e) => {
              const v = e.target.value;
              onPageSizeChange(v === 'all' ? Number.POSITIVE_INFINITY : Number(v));
            }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={String(s)}>
                {s}
              </option>
            ))}
            <option value="all">全部</option>
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onPageIndexChange(0)}
            disabled={!canPrev}
            title="首页"
          >
            <ChevronsLeft />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onPageIndexChange(pageIndex - 1)}
            disabled={!canPrev}
            title="上一页"
          >
            <ChevronLeft />
          </Button>
          <div className="px-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {pageCount === 0 ? 0 : pageIndex + 1} / {Math.max(1, pageCount)}
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canNext}
            title="下一页"
          >
            <ChevronRight />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onPageIndexChange(pageCount - 1)}
            disabled={!canNext}
            title="末页"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
