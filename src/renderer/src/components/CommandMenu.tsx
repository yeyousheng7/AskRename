import { useEffect, useRef } from 'react';
import { SlashIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Preset, PresetKind } from '@/types/preset';

interface CommandMenuProps {
  presets: Preset[];
  selectedIndex: number;
  onSelect: (preset: Preset) => void;
  query: string;
}

const PRESET_KIND_LABELS: Record<PresetKind, string> = {
  instruction: '指令',
  regex: '正则'
};

export function CommandMenu({
  presets,
  selectedIndex,
  onSelect,
  query
}: CommandMenuProps): React.JSX.Element | null {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (presets.length === 0) return null;

  return (
    <div
      className={cn(
        'absolute bottom-full left-0 right-0 mb-1',
        'z-50',
        'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl',
        'rounded-xl shadow-xl',
        'ring-1 ring-black/5 dark:ring-white/10',
        'py-1.5 overflow-hidden',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-150'
      )}
    >
      <div className="px-3 pb-1.5 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <SlashIcon className="h-3 w-3" />
        <span>预设</span>
        {query && (
          <span className="text-zinc-300 dark:text-zinc-600">— 搜索 &quot;{query}&quot;</span>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto">
        {presets.map((preset, index) => (
          <button
            key={preset.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            onClick={() => onSelect(preset)}
            className={cn(
              'w-full px-3 py-2 flex items-center gap-3 text-left',
              'transition-colors cursor-pointer',
              index === selectedIndex
                ? 'bg-zinc-100 dark:bg-zinc-800'
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'text-sm font-medium truncate',
                    index === selectedIndex
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  /{preset.name}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-md border',
                    'border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300'
                  )}
                >
                  {PRESET_KIND_LABELS[preset.kind]}
                </span>
              </div>

              <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                {preset.content}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
