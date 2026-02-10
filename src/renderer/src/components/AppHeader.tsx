import { LoaderIcon, MoonIcon, SettingsIcon, SunIcon } from 'lucide-react';
import { ClearAllButton } from '@/components/ClearAllButton';
import { TargetModeSwitch } from '@/components/TargetModeSwitch';
import type { TargetMode } from '@/types/file';

export function AppHeader({
  filesLength,
  isEmpty,
  isRenaming,
  hasChanges,
  targetMode,
  resolvedTheme,
  onToggleTheme,
  onOpenSettings,
  onClear,
  onTargetModeChange
}: {
  filesLength: number;
  isEmpty: boolean;
  isRenaming: boolean;
  hasChanges: boolean;
  targetMode: TargetMode;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onClear: () => void;
  onTargetModeChange: (mode: TargetMode) => void;
}): React.JSX.Element {
  return (
    <div className="flex-shrink-0 grid grid-cols-[3rem_1fr_3rem_1fr_auto] border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="h-8 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800" />
      <div className="flex h-8 items-center border-r border-zinc-200 dark:border-zinc-800 px-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          原始文本
        </span>
        {!isEmpty && (
          <>
            <span className="ml-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              ({filesLength})
            </span>
            <ClearAllButton onClear={onClear} />
          </>
        )}
        <TargetModeSwitch value={targetMode} onChange={onTargetModeChange} />
      </div>
      <div className="h-8 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800" />
      <div className="flex h-8 items-center px-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          预览文本
        </span>
        {isRenaming ? (
          <span className="ml-2 font-mono text-xs text-blue-500 flex items-center gap-1">
            <LoaderIcon className="h-3 w-3 animate-spin" />
            AI 生成中...
          </span>
        ) : hasChanges ? (
          <span className="ml-2 font-mono text-xs text-emerald-500">(待审查)</span>
        ) : (
          <span className="ml-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
            (点击编辑)
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 px-2 bg-zinc-50 dark:bg-zinc-900">
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="设置"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title={resolvedTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {resolvedTheme === 'dark' ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
