import { useEffect, useRef } from 'react';
import { SlashIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// 预设指令数据
// ============================================================================

export interface Preset {
  id: string;
  label: string;
  value: string;
}

export const PRESETS: Preset[] = [
  { id: 'remove-spaces', label: '去除空格', value: '去除文件名中的所有空格' },
  { id: 'lowercase', label: '转为小写', value: '将文件名全部转为小写' },
  { id: 'snake-case', label: '蛇形命名', value: '转为 snake_case 格式' },
  { id: 'kebab-case', label: '短横线命名', value: '转为 kebab-case 格式' },
  { id: 'translate-cn', label: '翻译中文', value: '将文件名翻译为简洁的中文' },
  { id: 'translate-en', label: '翻译英文', value: '将文件名翻译为简洁的英文' },
  { id: 'add-date', label: '添加日期前缀', value: '在文件名前添加今天的日期 (YYYY-MM-DD)' },
  { id: 'normalize-date', label: '规范日期', value: '从文件名中提取日期并格式化为 YYYY-MM-DD 格式' }
  // TODO: /save — 将当前输入框内容保存为自定义预设
];

/** 根据 "/" 后面的查询词过滤预设列表 */
export function filterPresets(inputValue: string): Preset[] {
  if (!inputValue.startsWith('/')) return [];
  const query = inputValue.slice(1).toLowerCase();
  if (!query) return PRESETS;
  return PRESETS.filter((p) => p.label.toLowerCase().includes(query) || p.id.includes(query));
}

// ============================================================================
// CommandMenu 组件（纯展示，所有状态由父组件控制）
// ============================================================================

interface CommandMenuProps {
  /** 过滤后的预设列表 */
  presets: Preset[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 选中某条预设 */
  onSelect: (preset: Preset) => void;
  /** "/" 后面的搜索词，用于显示 */
  query: string;
}

export function CommandMenu({
  presets,
  selectedIndex,
  onSelect,
  query
}: CommandMenuProps): React.JSX.Element | null {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 确保选中项在视野内
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
        <span>预设指令</span>
        {query && (
          <span className="text-zinc-300 dark:text-zinc-600">
            — 搜索 &quot;{query}&quot;
          </span>
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
              <span
                className={cn(
                  'text-sm font-medium truncate',
                  index === selectedIndex
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300'
                )}
              >
                /{preset.label}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                {preset.value}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
