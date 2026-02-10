import type { TargetMode } from '@/types/file';
import { FileIcon, FolderIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const options: { value: TargetMode; label: string; icon: typeof FileIcon }[] = [
  { value: 'file', label: '文件', icon: FileIcon },
  { value: 'folder', label: '文件夹', icon: FolderIcon }
];

export function TargetModeSwitch({
  value,
  onChange
}: {
  value: TargetMode;
  onChange: (mode: TargetMode) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all duration-150',
              isActive && opt.value === 'file' && 'bg-blue-500 text-white shadow-sm',
              isActive && opt.value === 'folder' && 'bg-amber-500 text-white shadow-sm',
              !isActive &&
              'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            )}
          >
            <Icon className="h-3 w-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
