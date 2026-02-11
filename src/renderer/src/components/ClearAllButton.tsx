import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmState = 'idle' | 'confirming';

export function ClearAllButton({
  onClear,
  disabled = false
}: {
  onClear: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const [state, setState] = useState<ConfirmState>('idle');
  const timerRef = useRef<number | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!disabled) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState('idle');
  }, [disabled]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (state === 'idle') {
      // Enter confirming state with 2s auto-reset
      setState('confirming');
      timerRef.current = window.setTimeout(() => {
        setState('idle');
        timerRef.current = null;
      }, 2000);
    } else {
      // Second click: execute clear
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onClear();
      setState('idle');
    }
  }, [disabled, state, onClear]);

  if (state === 'confirming') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold',
          'text-red-500 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors',
          disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
        )}
      >
        确定?
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'ml-1.5 p-0.5 rounded transition-colors',
        !disabled
          ? 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          : 'text-zinc-400 dark:text-zinc-500 opacity-30 cursor-not-allowed pointer-events-none'
      )}
      title={disabled ? '列表为空' : '清空列表'}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
