import { useState } from 'react';
import type { RenameStrategyInputProps } from '@renderer/types/types';
import type { RegexParams } from './core';

export function RegexInput({
  isDisabled,
  onCommit
}: RenameStrategyInputProps<RegexParams>): React.JSX.Element {
  const [findPattern, setFindPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="查找正则..."
        value={findPattern}
        onChange={(e) => setFindPattern(e.target.value)}
        disabled={isDisabled}
        className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="text"
        placeholder="替换为..."
        value={replacePattern}
        onChange={(e) => setReplacePattern(e.target.value)}
        disabled={isDisabled}
        className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        disabled={isDisabled || !findPattern.trim()}
        onClick={() => onCommit({ findPattern, replacePattern })}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        预览
      </button>
    </div>
  );
}
