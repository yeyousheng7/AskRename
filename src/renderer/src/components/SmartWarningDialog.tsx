import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Mode } from '@/types/mode';

export function SmartWarningDialog({
  open,
  onClose,
  onContinue,
  onSwitchMode
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onSwitchMode: (mode: Mode) => void;
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
          aria-label="Large AI warning"
        >
          <div className="px-5 pt-5 pb-4">
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              文件较多，AI 处理可能较慢
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-6">
              建议切换到「智能模式」（往往更精准，速度更快），或者使用「正则模式」。
              <br />
              是否继续使用 AI 模式处理当前文件列表？
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  onSwitchMode('regex');
                  onClose();
                }}
              >
                切换到正则模式
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onSwitchMode('smart');
                  onClose();
                }}
              >
                切换到智能模式
              </Button>
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                onClick={() => {
                  onContinue();
                }}
              >
                继续
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
