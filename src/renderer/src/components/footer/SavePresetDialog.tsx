import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XIcon } from 'lucide-react';

export function SavePresetDialog({
  open,
  presetName,
  onPresetNameChange,
  onCancel,
  onConfirm
}: {
  open: boolean;
  presetName: string;
  onPresetNameChange: (next: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">保存为预设</span>
          <Button size="icon" variant="ghost" onClick={onCancel} className="h-7 w-7" title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-4 space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">预设名称</label>
          <Input
            value={presetName}
            onChange={(e) => onPresetNameChange(e.target.value)}
            placeholder="例如：批量转小写"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            将保存当前输入内容为一个新的预设（AI 提示词）。
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!presetName.trim()}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
