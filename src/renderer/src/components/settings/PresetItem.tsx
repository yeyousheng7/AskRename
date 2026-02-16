import { PencilIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Preset, PresetKind } from '@/types/preset';

const PRESET_KIND_LABELS: Record<PresetKind, string> = {
  instruction: '指令',
  regex: '正则'
};

export function PresetItem({
  preset,
  onEdit,
  onDelete
}: {
  preset: Preset;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const isSystem = preset.id.startsWith('sys-');
  const truncatedContent =
    preset.content.length > 40 ? `${preset.content.slice(0, 40)}...` : preset.content;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
        'border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {preset.name}
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
            {PRESET_KIND_LABELS[preset.kind]}
          </span>
          {isSystem && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              系统
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
          {truncatedContent}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          title="编辑"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
        {!isSystem && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
            title="删除"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
