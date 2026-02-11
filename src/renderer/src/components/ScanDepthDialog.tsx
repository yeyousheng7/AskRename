import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            'w-[520px] max-w-[95vw] rounded-2xl',
            'bg-white dark:bg-zinc-950',
            'shadow-2xl ring-1 ring-black/10 dark:ring-white/10'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Scan depth dialog"
        >
          <div className="px-5 pt-5 pb-4">
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              检测到子文件夹，是否递归扫描？
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-6">
              当前拖入的 {folderCount} 个文件夹中包含子文件夹。
              <br />
              你可以只读取当前层文件，或递归读取全部子目录文件。
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button variant="secondary" onClick={onRootOnly}>
                仅当前层
              </Button>
              <Button onClick={onRecursive}>递归全部</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

