import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mode } from '@/types/mode';
import { getModeList } from '@/modes/registry';

export function FooterModeMenu({
  mode,
  onModeChange,
  disabled
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled: boolean;
}): React.JSX.Element {
  const modeList = useMemo(() => getModeList(), []);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMode = useMemo(
    () => modeList.find((m) => m.id === mode) ?? modeList[0],
    [mode, modeList]
  );
  const CurrentModeIcon = currentMode.meta.icon;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'h-full px-4 py-3 flex items-center gap-2',
          'border-r border-zinc-200/50 dark:border-zinc-700/50',
          'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
          'transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <CurrentModeIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{currentMode.meta.label}</span>
        <ChevronDownIcon
          className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* 模式下拉菜单 */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-full left-0 mb-2 w-56',
            'z-50',
            'bg-white dark:bg-zinc-900 rounded-xl shadow-xl',
            'ring-1 ring-black/5 dark:ring-white/10',
            'py-1 overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
        >
          {modeList.map((m) => {
            const Icon = m.meta.icon;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onModeChange(m.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2.5 flex items-start gap-3 text-left',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
                  mode === m.id && 'bg-zinc-50 dark:bg-zinc-800'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5',
                    mode === m.id
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-400 dark:text-zinc-500'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div
                    className={cn(
                      'text-sm font-medium',
                      mode === m.id
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-700 dark:text-zinc-300'
                    )}
                  >
                    {m.meta.label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {m.meta.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
