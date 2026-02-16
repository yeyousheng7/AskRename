import { useEffect } from 'react';
import { AlertTriangleIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function BatchSuggestDialog({
  open,
  fileCount,
  threshold,
  onClose,
  onOpenPreferences,
  onContinue
}: {
  open: boolean;
  fileCount: number;
  threshold: number;
  onClose: () => void;
  onOpenPreferences: () => void;
  onContinue: () => void;
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="批处理建议"
        className={cn(
          'relative z-10 w-[min(500px,calc(100vw-2rem))] rounded-xl border',
          'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangleIcon className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              建议开启分批处理
            </span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7" title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            当前共有 <span className="font-semibold">{fileCount}</span> 个文件，已达到批处理阈值{' '}
            <span className="font-semibold">{threshold}</span>，但你目前关闭了分批处理。
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            继续单次请求可能更容易超时或失败。建议先到偏好设置开启分批处理。
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 bg-zinc-50 dark:bg-zinc-900/40">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="secondary" onClick={onOpenPreferences}>
            去开启分批
          </Button>
          <Button
            onClick={onContinue}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            继续本次执行
          </Button>
        </div>
      </div>
    </div>
  );
}
