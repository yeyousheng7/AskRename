import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

type ConfirmState = 'idle' | 'confirming';

export function ClearAllButton({ onClear }: { onClear: () => void }): React.JSX.Element {
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

  const handleClick = useCallback(() => {
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
  }, [state, onClear]);

  if (state === 'confirming') {
    return (
      <button
        onClick={handleClick}
        className="ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
      >
        确定?
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="ml-1.5 p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      title="清空列表"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
