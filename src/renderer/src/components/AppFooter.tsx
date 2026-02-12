import { useMemo } from 'react';
import { LoaderIcon, Undo2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import type { AISessionState, PendingDecision } from '@/types/ai';
import type { Mode } from '@/types/mode';
import { cn } from '@/lib/utils';
import { FooterModeMenu } from '@/components/footer/ModeMenu';
import { FooterPendingDecisionCard } from '@/components/footer/PendingDecisionCard';
import { FooterReviewActionsBar } from '@/components/footer/ReviewActionsBar';
import { MODES } from '@/modes/registry';
import type { FileItem } from '@/types/file';

export function AppFooter({
  mode,
  onModeChange,
  error,
  files,
  isEmpty,
  isReviewMode,
  isRenaming,
  isApplying,
  isUndoing,
  canUndo,
  // AI Session 新增
  aiSession,
  pendingDecision,
  onConfirmDecision,
  onDiscardDecision,
  onUpdatePendingRegex,
  onStrategyCommit,
  onUndo,
  onDiscard,
  onApply,
  history,
  onSelectHistory
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  error: string | null;
  files: FileItem[];
  isEmpty: boolean;
  isReviewMode: boolean;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  // AI Session 新增
  aiSession: AISessionState;
  pendingDecision: PendingDecision;
  onConfirmDecision: () => void;
  onDiscardDecision: () => void;
  onUpdatePendingRegex: (find: string, replace: string) => void;
  onStrategyCommit: (params: unknown) => void;
  onUndo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  // Session History
  history: string[];
  onSelectHistory: (text: string) => void;
}): React.JSX.Element {
  const strategy = useMemo(() => MODES[mode], [mode]);
  const StrategyInput = strategy.InputComponent;
  const isDisabled = isRenaming || isApplying || isUndoing;

  return (
    <>
      {/* 独立撤销按钮 - 悬浮在左侧 */}
      <Button
        onClick={onUndo}
        size="icon"
        variant="ghost"
        disabled={(!canUndo && !isReviewMode) || isDisabled}
        className={cn(
          'fixed bottom-6 left-6 z-50 h-10 w-10 rounded-full',
          'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl',
          'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
          'hover:bg-white dark:hover:bg-zinc-800',
          'transition-all duration-200',
          ((!canUndo && !isReviewMode) || isDisabled) && 'opacity-40'
        )}
        title={canUndo ? '撤销上一步操作' : isReviewMode ? '撤回预览更改' : '没有可撤销的操作'}
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
        {/* Session History 抽屉 - 仅在非正则模式下显示 */}
        {mode !== 'regex' && <HistoryDrawer history={history} onSelect={onSelectHistory} />}

        {/* 错误提示 */}
        {error && (
          <div className="px-4 pt-3 pb-0">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {/* Action Card - 智能模式下的 AI 决策预览卡片 */}
        {aiSession === 'review' && mode === 'smart' && pendingDecision && (
          <FooterPendingDecisionCard
            pendingDecision={pendingDecision}
            isApplying={isApplying}
            onUpdatePendingRegex={onUpdatePendingRegex}
            onDiscardDecision={onDiscardDecision}
            onConfirmDecision={onConfirmDecision}
          />
        )}

        {/* 非智能模式的审查模式操作栏 */}
        {isReviewMode && mode === 'ai' && (
          <FooterPendingDecisionCard
            pendingDecision={{ type: 'list', names: [] }}
            isApplying={isApplying}
            onUpdatePendingRegex={() => undefined}
            onDiscardDecision={onDiscard}
            onConfirmDecision={onApply}
          />
        )}

        {isReviewMode && (mode === 'regex' || (mode === 'smart' && aiSession !== 'review')) && (
          <FooterReviewActionsBar
            isApplying={isApplying}
            isUndoing={isUndoing}
            onDiscard={onDiscard}
            onApply={onApply}
          />
        )}

        {/* 主内容区 - 可变形 */}
        <div className="flex items-stretch">
          {/* 左侧：Mode Trigger */}
          <FooterModeMenu mode={mode} onModeChange={onModeChange} disabled={isDisabled} />

          {/* 中间：输入区域 */}
          <div
            className={cn(
              'flex-1 min-w-0 relative',
              'transition-all duration-300 ease-in-out',
              mode === 'regex' ? 'min-h-[88px]' : 'min-h-[44px]'
            )}
          >
            <div className="h-full flex items-center px-4">
              <StrategyInput
                files={files}
                isDisabled={isEmpty || isDisabled}
                onCommit={onStrategyCommit}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
