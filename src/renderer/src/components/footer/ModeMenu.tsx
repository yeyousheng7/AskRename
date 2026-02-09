import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, Regex, SparklesIcon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mode } from '@/types/mode';

interface ModeConfig {
  id: Mode;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'auto',
    icon: <Zap className="h-4 w-4" />,
    label: '智能',
    description: 'AI 自动判断使用正则或完整生成'
  },
  {
    id: 'ai',
    icon: <SparklesIcon className="h-4 w-4" />,
    label: 'AI',
    description: '始终使用 AI 生成文件名'
  },
  {
    id: 'regex',
    icon: <Regex className="h-4 w-4" />,
    label: '正则',
    description: '手动输入正则表达式'
  }
];

export function FooterModeMenu({
  mode,
  onModeChange,
  disabled
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled: boolean;
}): React.JSX.Element {
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

  const currentMode = useMemo(() => MODES.find((m) => m.id === mode) ?? MODES[0], [mode]);

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
        {currentMode.icon}
        <span className="text-sm font-medium">{currentMode.label}</span>
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
          {MODES.map((m) => (
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
                {m.icon}
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
                  {m.label}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{m.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
