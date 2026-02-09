import { useCallback, useState, type RefObject } from 'react';
import {
  CheckIcon,
  LoaderIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  WandIcon,
  XIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuickActionsMenu } from '@/components/QuickActionsMenu';

export function AppFooter({
  error,
  instruction,
  inputRef,
  isEmpty,
  isReviewMode,
  isRenaming,
  isApplying,
  isUndoing,
  canUndo,
  onInstructionChange,
  onUndo,
  onQuickRule,
  onQuickAI,
  onDiscard,
  onApply,
  onStop,
  onGenerate
}: {
  error: string | null;
  instruction: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isEmpty: boolean;
  isReviewMode: boolean;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  onInstructionChange: (next: string) => void;
  onUndo: () => void;
  onQuickRule: (handler: (name: string, index: number) => string) => void;
  onQuickAI: (prompt: string) => void;
  onDiscard: () => void;
  onApply: () => void;
  onStop: () => void;
  onGenerate: () => void;
}): React.JSX.Element {
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const handleSelectAI = useCallback(
    (prompt: string) => {
      onQuickAI(prompt);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    },
    [inputRef, onQuickAI]
  );

  return (
    <footer className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
      {error && (
        <div className="mb-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button
          onClick={onUndo}
          size="icon"
          variant="outline"
          disabled={!canUndo || isUndoing || isApplying || isRenaming}
          title={canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
        >
          {isUndoing ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <Undo2Icon className="h-4 w-4" />
          )}
        </Button>

        <div className="relative">
          <Button
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            size="icon"
            variant="ghost"
            className="text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            disabled={isEmpty || isRenaming || isApplying || isUndoing}
            title="快捷指令"
          >
            <WandIcon className="h-4 w-4" />
          </Button>
          <QuickActionsMenu
            isOpen={isQuickActionsOpen}
            onClose={() => setIsQuickActionsOpen(false)}
            onSelectRule={onQuickRule}
            onSelectAI={handleSelectAI}
          />
        </div>

        <Input
          ref={inputRef}
          type="text"
          placeholder={
            isReviewMode
              ? '不满意？修改指令后按回车重新生成...'
              : '输入重命名指令，例如：将所有图片按日期命名...'
          }
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onGenerate();
            }
          }}
          className="flex-1 font-mono bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          disabled={isEmpty || isRenaming || isApplying || isUndoing}
        />

        {isReviewMode ? (
          <>
            <Button
              onClick={onDiscard}
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              disabled={isApplying || isUndoing}
            >
              <XIcon className="mr-2 h-4 w-4" />
              放弃
            </Button>

            <Button
              onClick={onApply}
              className="px-5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              disabled={isApplying || isUndoing}
            >
              {isApplying ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  应用中...
                </>
              ) : (
                <>
                  <CheckIcon className="mr-2 h-4 w-4" />
                  确认应用
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {isRenaming ? (
              <Button onClick={onStop} variant="destructive" className="px-5">
                <SquareIcon className="mr-2 h-4 w-4" />
                停止
              </Button>
            ) : (
              <Button
                onClick={onGenerate}
                className="px-5"
                disabled={isEmpty || !instruction.trim() || isApplying || isUndoing}
              >
                <SparklesIcon className="mr-2 h-4 w-4" />
                生成
              </Button>
            )}
          </>
        )}
      </div>
    </footer>
  );
}
