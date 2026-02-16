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
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const resetToIdle = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState('idle');
  }, []);

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
  }, [disabled]);

  useEffect(() => {
    if (state !== 'confirming') return;

    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      resetToIdle();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      resetToIdle();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state, resetToIdle]);

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
      onClear();
      resetToIdle();
    }
  }, [disabled, state, onClear, resetToIdle]);

  if (state === 'confirming' && !disabled) {
    return (
      <button
        ref={buttonRef}
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
      ref={buttonRef}
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
