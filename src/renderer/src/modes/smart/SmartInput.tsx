import { useState } from 'react';
import type { RenameStrategyInputProps } from '@renderer/types/types';

export interface SmartParams {
  instruction: string;
}

export function SmartInput({
  isDisabled,
  onCommit
}: RenameStrategyInputProps<SmartParams>): React.JSX.Element {
  const [instruction, setInstruction] = useState('');

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={instruction}
        placeholder="输入智能指令..."
        onChange={(e) => setInstruction(e.target.value)}
        disabled={isDisabled}
        className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        disabled={isDisabled || !instruction.trim()}
        onClick={() => onCommit({ instruction })}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        分析
      </button>
    </div>
  );
}
