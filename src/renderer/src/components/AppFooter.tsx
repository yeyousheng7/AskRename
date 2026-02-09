import { useCallback, useState, type RefObject } from 'react';
import {
  CheckIcon,
  LoaderIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  WandIcon,
  XIcon,
  Regex,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuickActionsMenu } from '@/components/QuickActionsMenu';
import { cn } from '@/lib/utils';

export type Mode = 'auto' | 'ai' | 'regex';

export function AppFooter({
  mode,
  onModeChange,
  error,
  instruction,
  findPattern,
  replacePattern,
  inputRef,
  isEmpty,
  isReviewMode,
  isRenaming,
  isApplying,
  isUndoing,
  canUndo,
  onInstructionChange,
  onFindPatternChange,
  onReplacePatternChange,
  onUndo,
  onQuickRule,
  onQuickAI,
  onDiscard,
  onApply,
  onStop,
  onGenerate
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  error: string | null;
  instruction: string;
  findPattern: string;
  replacePattern: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isEmpty: boolean;
  isReviewMode: boolean;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  onInstructionChange: (next: string) => void;
  onFindPatternChange: (next: string) => void;
  onReplacePatternChange: (next: string) => void;
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

  // 模式切换按钮样式
  const modeButtonBase =
    'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5';
  const modeButtonActive = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm';
  const modeButtonInactive =
    'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800';

  return (
    <footer className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
      {error && (
        <div className="mb-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        {/* 撤销按钮 */}
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

        {/* 模式切换 */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-800">
          <button
            onClick={() => onModeChange('auto')}
            className={cn(modeButtonBase, mode === 'auto' ? modeButtonActive : modeButtonInactive)}
            disabled={isRenaming || isApplying || isUndoing}
            title="智能模式：AI 自动判断使用正则还是完整 AI"
          >
            <Zap className="h-3.5 w-3.5" />
            智能
          </button>
          <button
            onClick={() => onModeChange('ai')}
            className={cn(modeButtonBase, mode === 'ai' ? modeButtonActive : modeButtonInactive)}
            disabled={isRenaming || isApplying || isUndoing}
            title="AI 模式：始终使用 AI 生成文件名"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            AI
          </button>
          <button
            onClick={() => onModeChange('regex')}
            className={cn(modeButtonBase, mode === 'regex' ? modeButtonActive : modeButtonInactive)}
            disabled={isRenaming || isApplying || isUndoing}
            title="正则模式：手动输入正则表达式"
          >
            <Regex className="h-3.5 w-3.5" />
            正则
          </button>
        </div>

        {/* auto/ai 模式：快捷指令按钮 */}
        {(mode === 'auto' || mode === 'ai') && (
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
        )}

        {/* 输入区域 - 根据模式动态渲染 */}
        {mode === 'regex' ? (
          // 正则模式：查找/替换双输入框
          <div className="flex flex-1 gap-2">
            <Input
              type="text"
              placeholder="查找 (正则)..."
              value={findPattern}
              onChange={(e) => onFindPatternChange(e.target.value)}
              className="flex-1 font-mono bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              disabled={isEmpty || isApplying || isUndoing}
            />
            <span className="flex items-center text-zinc-400 dark:text-zinc-500">→</span>
            <Input
              type="text"
              placeholder="替换为..."
              value={replacePattern}
              onChange={(e) => onReplacePatternChange(e.target.value)}
              className="flex-1 font-mono bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              disabled={isEmpty || isApplying || isUndoing}
            />
          </div>
        ) : (
          // auto/ai 模式：单输入框
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
        )}

        {/* 审查模式：放弃和应用按钮 */}
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
          // 非审查模式
          <>
            {mode === 'ai' && (
              // AI 模式：生成/停止按钮
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
            {/* 正则模式：不显示生成按钮（实时预览） */}
          </>
        )}
      </div>
    </footer>
  );
}
