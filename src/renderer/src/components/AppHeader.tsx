import { LoaderIcon, MoonIcon, SettingsIcon, SunIcon } from 'lucide-react';
import { ClearAllButton } from '@/components/ClearAllButton';
import { TargetModeSwitch } from '@/components/TargetModeSwitch';
import type { TargetMode } from '@/types/file';

function Divider(): React.JSX.Element {
  return <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />;
}

export function AppHeader({
  filesLength,
  isProcessing,
  hasChanges,
  targetMode,
  resolvedTheme,
  onToggleTheme,
  onOpenSettings,
  onClear,
  onTargetModeChange
}: {
  filesLength: number;
  isProcessing: boolean;
  hasChanges: boolean;
  targetMode: TargetMode;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onClear: () => void;
  onTargetModeChange: (mode: TargetMode) => void;
}): React.JSX.Element {
  return (
    <div className="flex-shrink-0 flex items-center h-10 px-3 gap-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      {/* 左侧：原始文本标题 + 文件数 + 清空 + 模式切换 */}
      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        原始文本
      </span>
      <span className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
        ({filesLength})
      </span>
      <div className="w-2" />
      <ClearAllButton onClear={onClear} disabled={filesLength === 0} />

      <Divider />

      <TargetModeSwitch value={targetMode} onChange={onTargetModeChange} />

      {/* 弹性间距 */}
      <div className="flex-1" />

      {/* 右侧：预览状态 + 工具按钮 */}
      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        预览文本
      </span>
      {isProcessing ? (
        <span className="font-mono text-xs text-blue-500 flex items-center gap-1">
          <LoaderIcon className="h-3 w-3 animate-spin" />
          AI 生成中...
        </span>
      ) : hasChanges ? (
        <span className="font-mono text-xs text-emerald-500">(待审查)</span>
      ) : (
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">(点击编辑)</span>
      )}

      <Divider />

      <div className="flex items-center gap-0.5">
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
