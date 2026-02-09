import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClockIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryDrawerProps {
  history: string[];
  onSelect: (text: string) => void;
}

export function HistoryDrawer({ history, onSelect }: HistoryDrawerProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = useCallback(
    (text: string) => {
      onSelect(text);
      setIsExpanded(false);
    },
    [onSelect]
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 无历史记录时不渲染
  if (history.length === 0) return null;

  return (
    <div className="border-b border-zinc-200/30 dark:border-zinc-700/30">
      {/* 收起状态：把手区域 — 始终显示 */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          'w-full h-7 px-4 flex items-center gap-2',
          'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300',
          'transition-colors cursor-pointer select-none'
        )}
      >
        <ClockIcon className="h-3 w-3 shrink-0" />
        {!isExpanded && <span className="text-xs truncate flex-1 text-left">{history[0]}</span>}
        {isExpanded && <span className="text-xs flex-1 text-left font-medium">历史记录</span>}
        <ChevronUpIcon
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* 展开状态：历史列表 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="history-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'max-h-48 overflow-y-auto',
                'bg-white/40 dark:bg-zinc-800/40 backdrop-blur-sm',
                'py-1'
              )}
            >
              {history.map((entry, index) => (
                <button
                  key={`${index}-${entry}`}
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className={cn(
                    'w-full px-4 py-1.5 text-left text-sm truncate',
                    'text-zinc-600 dark:text-zinc-400',
                    'hover:bg-zinc-100/60 dark:hover:bg-zinc-700/40',
                    'transition-colors cursor-pointer',
                    index === 0 && 'text-zinc-800 dark:text-zinc-200'
                  )}
                  title={entry}
                >
                  {entry}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
