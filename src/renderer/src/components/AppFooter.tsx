import { useCallback, useState, useRef, useEffect, type RefObject } from 'react';
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
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
import { QuickActionsMenu } from '@/components/QuickActionsMenu';
import { cn } from '@/lib/utils';

export type Mode = 'auto' | 'ai' | 'regex';

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
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭模式菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAI = useCallback(
    (prompt: string) => {
      onQuickAI(prompt);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    },
    [inputRef, onQuickAI]
  );

  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];
  const isDisabled = isRenaming || isApplying || isUndoing;
  const canSubmit = mode === 'regex' ? findPattern.trim() : instruction.trim();

  return (
    <>
      {/* 独立撤销按钮 - 悬浮在左侧 */}
      <Button
        onClick={onUndo}
        size="icon"
        variant="ghost"
        disabled={!canUndo || isDisabled}
        className={cn(
          'fixed bottom-6 left-6 z-50 h-10 w-10 rounded-full',
          'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl',
          'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
          'hover:bg-white dark:hover:bg-zinc-800',
          'transition-all duration-200',
          (!canUndo || isDisabled) && 'opacity-40'
        )}
        title={canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
      >
        {isUndoing ? (
          <LoaderIcon className="h-4 w-4 animate-spin" />
        ) : (
          <Undo2Icon className="h-4 w-4" />
        )}
      </Button>

      {/* 悬浮指令舱 - MorphingBar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'w-[680px] max-w-[90vw]',
          'bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl',
          'rounded-[20px] shadow-2xl',
          'ring-1 ring-black/5 dark:ring-white/10',
          'transition-all duration-300 ease-in-out',
          'overflow-visible'
        )}
      >
        {/* 错误提示 */}
        {error && (
          <div className="px-4 pt-3 pb-0">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {/* 审查模式操作栏 */}
        {isReviewMode && (
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              预览已就绪，确认应用更改？
            </span>
            <div className="flex gap-2">
              <Button
                onClick={onDiscard}
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                disabled={isApplying || isUndoing}
              >
                <XIcon className="mr-1.5 h-3.5 w-3.5" />
                放弃
              </Button>
              <Button
                onClick={onApply}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isApplying || isUndoing}
              >
                {isApplying ? (
                  <>
                    <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
                    确认应用
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 主内容区 - 可变形 */}
        <div className="flex items-stretch">
          {/* 左侧：Mode Trigger */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              disabled={isDisabled}
              className={cn(
                'h-full px-4 py-3 flex items-center gap-2',
                'border-r border-zinc-200/50 dark:border-zinc-700/50',
                'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                'transition-colors',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {currentMode.icon}
              <span className="text-sm font-medium">{currentMode.label}</span>
              <ChevronDownIcon
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  isModeMenuOpen && 'rotate-180'
                )}
              />
            </button>

            {/* 模式下拉菜单 */}
            {isModeMenuOpen && (
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
                      setIsModeMenuOpen(false);
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
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {m.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 中间：输入区域 */}
          <div
            className={cn(
              'flex-1 relative',
              'transition-all duration-300 ease-in-out',
              mode === 'regex' ? 'min-h-[88px]' : 'min-h-[44px]'
            )}
          >
            {/* 魔法棒按钮 */}
            {(mode === 'auto' || mode === 'ai') && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    'text-purple-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30',
                    (isEmpty || isDisabled) && 'opacity-50 cursor-not-allowed'
                  )}
                  title="快捷指令"
                >
                  <WandIcon className="h-4 w-4" />
                </button>
                <QuickActionsMenu
                  isOpen={isQuickActionsOpen}
                  onClose={() => setIsQuickActionsOpen(false)}
                  onSelectRule={onQuickRule}
                  onSelectAI={handleSelectAI}
                />
              </div>
            )}

            {mode === 'regex' ? (
              // 正则模式：双行输入框
              <div className="h-full flex flex-col">
                <input
                  type="text"
                  placeholder="查找正则..."
                  value={findPattern}
                  onChange={(e) => onFindPatternChange(e.target.value)}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'flex-1 px-4 py-2.5 bg-transparent border-0 outline-none',
                    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                    'font-mono text-sm'
                  )}
                />
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
              </div>
            ) : (
              // Auto/AI 模式：单行输入框
              <input
                ref={inputRef as RefObject<HTMLInputElement>}
                type="text"
                placeholder={
                  isReviewMode ? '不满意？修改指令后按回车重新生成...' : '输入自然语言指令...'
                }
                value={instruction}
                onChange={(e) => onInstructionChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onGenerate();
                  }
                }}
                disabled={isEmpty || isDisabled}
                className={cn(
                  'w-full h-full pl-10 pr-4 py-3 bg-transparent border-0 outline-none',
                  'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                  'text-sm'
                )}
              />
            )}
          </div>

          {/* 右侧：Submit 按钮 */}
          <div className="flex items-center pr-3">
            {isRenaming ? (
              <button
                onClick={onStop}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'bg-red-500 text-white hover:bg-red-600',
                  'transition-all duration-200 hover:scale-105'
                )}
                title="停止生成"
              >
                <SquareIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={mode === 'regex' && isReviewMode ? onApply : onGenerate}
                disabled={isEmpty || !canSubmit || isDisabled}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'transition-all duration-200',
                  canSubmit && !isEmpty && !isDisabled
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-105'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                )}
                title={mode === 'regex' ? '应用正则替换' : '生成'}
              >
                {isApplying ? (
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpIcon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
