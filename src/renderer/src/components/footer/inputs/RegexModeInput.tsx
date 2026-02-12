import { LoaderIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RegexModeInput({
  isAIAssistMode,
  aiAssistText,
  isAIAssistLoading,
  isDisabled,
  isEmpty,
  findPattern,
  replacePattern,
  aiAssistInputRef,
  findInputRef,
  onAiAssistTextChange,
  onFindPatternChange,
  onReplacePatternChange,
  onSubmitAIAssist,
  onOpenAIAssist,
  onEscapeAIAssist
}: {
  isAIAssistMode: boolean;
  aiAssistText: string;
  isAIAssistLoading: boolean;
  isDisabled: boolean;
  isEmpty: boolean;
  findPattern: string;
  replacePattern: string;
  aiAssistInputRef: React.RefObject<HTMLInputElement | null>;
  findInputRef: React.RefObject<HTMLInputElement | null>;
  onAiAssistTextChange: (next: string) => void;
  onFindPatternChange: (next: string) => void;
  onReplacePatternChange: (next: string) => void;
  onSubmitAIAssist: () => void;
  onOpenAIAssist: () => void;
  onEscapeAIAssist: () => void;
}): React.JSX.Element {
  return (
    <div className="h-full flex flex-col">
      {isAIAssistMode ? (
        <div className="h-full flex items-center px-4">
          <div className="relative flex-1">
            <input
              ref={aiAssistInputRef}
              type="text"
              placeholder="请描述您的正则需求 (例如: 删除所有括号内的内容)..."
              value={aiAssistText}
              onChange={(e) => onAiAssistTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onEscapeAIAssist();
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmitAIAssist();
                }
              }}
              disabled={isEmpty || isDisabled || isAIAssistLoading}
              className={cn(
                'w-full px-0 pr-12 py-3 bg-transparent border-0 outline-none',
                'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                'font-mono text-sm'
              )}
            />

            <button
              type="button"
              onClick={onSubmitAIAssist}
              disabled={isEmpty || isDisabled || isAIAssistLoading}
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2',
                'p-1 rounded-md',
                'text-zinc-400 hover:text-amber-500 hover:bg-amber-50',
                'dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/30',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              title={isAIAssistLoading ? 'AI 生成中...' : '生成正则'}
            >
              {isAIAssistLoading ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1">
            <input
              ref={findInputRef}
              type="text"
              placeholder="查找正则..."
              value={findPattern}
              onChange={(e) => onFindPatternChange(e.target.value)}
              disabled={isEmpty || isDisabled}
              className={cn(
                'w-full h-full px-4 pr-12 py-2.5 bg-transparent border-0 outline-none',
                'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                'font-mono text-sm'
              )}
            />
            <button
              type="button"
              onClick={onOpenAIAssist}
              disabled={isEmpty || isDisabled || isAIAssistLoading}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'p-1 rounded-md',
                'text-zinc-400 hover:text-amber-500 hover:bg-amber-50',
                'dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/30',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              title="AI 辅助生成正则"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 mx-4" />
          <input
            type="text"
            placeholder="替换为... (支持 ${i} ${i0} 序号)"
            value={replacePattern}
            onChange={(e) => onReplacePatternChange(e.target.value)}
            disabled={isEmpty || isDisabled}
            className={cn(
              'flex-1 px-4 py-2.5 bg-transparent border-0 outline-none',
              'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'font-mono text-sm'
            )}
          />
        </>
      )}
    </div>
  );
}
