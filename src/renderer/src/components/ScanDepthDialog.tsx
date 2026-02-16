import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FolderTreeIcon, XIcon } from 'lucide-react';

export function ScanDepthDialog({
  open,
  folderCount,
  onClose,
  onRootOnly,
  onRecursive
}: {
  open: boolean;
  folderCount: number;
  onClose: () => void;
  onRootOnly: () => void;
  onRecursive: () => void;
}): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Card */}
      <div
        className={cn(
          'relative z-10 w-[min(480px,calc(100vw-2rem))]',
          'rounded-xl border border-zinc-200 dark:border-zinc-800',
          'bg-white dark:bg-zinc-950',
          'shadow-xl',
          'overflow-hidden'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Scan depth dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <FolderTreeIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            </div>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              检测到子文件夹
            </span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7" title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            当前拖入的{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {folderCount}
            </span>{' '}
            个文件夹中包含子文件夹。
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            你可以只读取当前层文件，或递归读取全部子目录文件。
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 bg-zinc-50 dark:bg-zinc-900/40">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="secondary" onClick={onRootOnly}>
            仅当前层
          </Button>
          <Button
            onClick={onRecursive}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            递归全部
          </Button>
        </div>
      </div>
    </div>
  );
}
