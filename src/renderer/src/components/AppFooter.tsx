import type { RefObject } from 'react';
import {
  ArrowUpIcon,
  CheckIcon,
  LoaderIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  XIcon,
  Regex
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { CommandMenu } from '@/components/CommandMenu';
import { usePresets } from '@/hooks/usePresets';
import type { ToastType } from '@/hooks/useToast';
import type { AISessionState, PendingDecision } from '@/types/ai';
import type { Mode } from '@/types/mode';
import { cn } from '@/lib/utils';
import { FooterModeMenu } from '@/components/footer/ModeMenu';
import { SavePresetDialog } from '@/components/footer/SavePresetDialog';
import { useSavePresetCommand } from '@/hooks/useSavePresetCommand';
import { useSlashPresetMenu } from '@/hooks/useSlashPresetMenu';

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
  // AI Session 新增
  aiSession,
  pendingDecision,
  onConfirmDecision,
  onDiscardDecision,
  onUpdatePendingRegex,
  // 原有回调
  onInstructionChange,
  onFindPatternChange,
  onReplacePatternChange,
  onUndo,
  onDiscard,
  onApply,
  onStop,
  onGenerate,
  showToast,
  history,
  onSelectHistory
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
  // AI Session 新增
  aiSession: AISessionState;
  pendingDecision: PendingDecision;
  onConfirmDecision: () => void;
  onDiscardDecision: () => void;
  onUpdatePendingRegex: (find: string, replace: string) => void;
  // 原有回调
  onInstructionChange: (next: string) => void;
  onFindPatternChange: (next: string) => void;
  onReplacePatternChange: (next: string) => void;
  onUndo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  onStop: () => void;
  onGenerate: () => void;
  showToast: (message: string, type: ToastType) => void;
  // Session History
  history: string[];
  onSelectHistory: (text: string) => void;
}): React.JSX.Element {
  const { presets, addPreset } = usePresets();

  const slashMenu = useSlashPresetMenu({
    instruction,
    presets,
    inputRef,
    onModeChange,
    onInstructionChange,
    onFindPatternChange,
    onReplacePatternChange
  });

  const savePreset = useSavePresetCommand({ inputRef, addPreset, showToast });
  const isDisabled = isRenaming || isApplying || isUndoing;
  const canSubmit = mode === 'regex' ? findPattern.trim() : instruction.trim();

  return (
    <>
      <SavePresetDialog
        open={savePreset.isDialogOpen}
        presetName={savePreset.presetName}
        onPresetNameChange={savePreset.setPresetName}
        onCancel={savePreset.cancel}
        onConfirm={savePreset.confirm}
      />

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
        {aiSession === 'review' && mode === 'auto' && pendingDecision && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50/80 to-blue-50/80 dark:from-purple-950/40 dark:to-blue-950/40 ring-1 ring-purple-200/50 dark:ring-purple-800/30">
            {pendingDecision.type === 'regex' ? (
              <>
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                  <Regex className="h-3.5 w-3.5" />
                  AI 生成了正则规则，可编辑微调
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">
                      查找
                    </label>
                    <input
                      type="text"
                      value={pendingDecision.find}
                      onChange={(e) =>
                        onUpdatePendingRegex(e.target.value, pendingDecision.replace)
                      }
                      className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-600 outline-none transition-all"
                      placeholder="正则表达式"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">
                      替换
                    </label>
                    <input
                      type="text"
                      value={pendingDecision.replace}
                      onChange={(e) => onUpdatePendingRegex(pendingDecision.find, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-600 outline-none transition-all"
                      placeholder="替换内容 (支持 ${i} 序号)"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <SparklesIcon className="h-3.5 w-3.5" />
                AI 已生成新文件名，预览已就绪
              </div>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <Button
                onClick={onDiscardDecision}
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                disabled={isApplying}
              >
                <XIcon className="mr-1 h-3.5 w-3.5" />
                放弃
              </Button>
              <Button
                onClick={onConfirmDecision}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isApplying}
              >
                {isApplying ? (
                  <>
                    <LoaderIcon className="mr-1 h-3.5 w-3.5 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckIcon className="mr-1 h-3.5 w-3.5" />
                    确认应用
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 非智能模式的审查模式操作栏 */}
        {isReviewMode && (mode !== 'auto' || aiSession !== 'review') && (
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
          <FooterModeMenu mode={mode} onModeChange={onModeChange} disabled={isDisabled} />

          {/* 中间：输入区域 */}
          <div
            className={cn(
              'flex-1 relative',
              'transition-all duration-300 ease-in-out',
              mode === 'regex' ? 'min-h-[88px]' : 'min-h-[44px]'
            )}
          >
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
              // Auto/AI 模式：单行输入框 + Slash Command Menu
              <>
                {/* Slash Command 悬浮菜单 */}
                {slashMenu.isOpen && (
                  <CommandMenu
                    presets={slashMenu.filteredPresets}
                    selectedIndex={slashMenu.safeSelectedIndex}
                    onSelect={slashMenu.handleSelect}
                    query={instruction.startsWith('/') ? instruction.slice(1) : ''}
                  />
                )}
                <input
                  ref={inputRef as RefObject<HTMLInputElement>}
                  type="text"
                  placeholder={
                    isReviewMode
                      ? '不满意？修改指令后按回车重新生成...'
                      : '输入自然语言指令... 或 / 选择预设'
                  }
                  value={instruction}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (
                      savePreset.maybeOpenFromText(val, onInstructionChange, {
                        onBeforeBegin: slashMenu.close
                      })
                    ) {
                      return;
                    }
                    onInstructionChange(val);
                    slashMenu.setOpenForText(val);
                  }}
                  onKeyDown={(e) => {
                    if (slashMenu.handleKeyDown(e)) return;

                    // ===== 原有键盘逻辑 =====
                    // Enter: 发送指令（如果有文本）
                    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      if (
                        savePreset.maybeOpenFromInstruction(instruction, onInstructionChange, {
                          onBeforeBegin: slashMenu.close
                        })
                      ) {
                        return;
                      }
                      if (instruction.trim()) onGenerate();
                    }
                    // Cmd/Ctrl + Enter: review 状态下确认应用
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (aiSession === 'review') {
                        onConfirmDecision();
                      }
                    }
                    // Esc: 放弃当前 AI 建议
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      if (aiSession === 'review') {
                        onDiscardDecision();
                      }
                    }
                  }}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'w-full h-full pl-4 pr-4 py-3 bg-transparent border-0 outline-none',
                    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                    'text-sm'
                  )}
                />
              </>
            )}
          </div>

          {/* 右侧：Submit 按钮 */}
          <div className="flex items-center pr-3">
            {isRenaming || aiSession === 'loading' ? (
              // Loading 或 Renaming 状态：显示停止按钮或 Spinner
              aiSession === 'loading' ? (
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center',
                    'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500'
                  )}
                  title="生成中..."
                >
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                </div>
              ) : (
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
              )
            ) : aiSession === 'review' && mode === 'auto' && !instruction.trim() ? (
              // Review 状态且无文本：显示确认按钮
              <button
                onClick={onConfirmDecision}
                disabled={isApplying}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'transition-all duration-200',
                  !isApplying
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                )}
                title="确认应用 (Ctrl+Enter)"
              >
                {isApplying ? (
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
              </button>
            ) : (
              // 其他状态：显示发送按钮
              <button
                onClick={() => {
                  if (mode === 'regex' && isReviewMode) {
                    onApply();
                    return;
                  }
                  if (
                    savePreset.maybeOpenFromInstruction(instruction, onInstructionChange, {
                      onBeforeBegin: slashMenu.close
                    })
                  ) {
                    return;
                  }
                  onGenerate();
                }}
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
