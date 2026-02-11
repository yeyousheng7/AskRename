import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { LoaderIcon, Sparkles, Undo2Icon } from 'lucide-react';
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
import { FooterPendingDecisionCard } from '@/components/footer/PendingDecisionCard';
import { FooterReviewActionsBar } from '@/components/footer/ReviewActionsBar';
import { FooterSubmitControl } from '@/components/footer/SubmitControl';
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
  onGenerateRegexAssist,
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
  onGenerateRegexAssist: (requirement: string) => Promise<{ find: string; replace: string }>;
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
  const [isAIAssistMode, setIsAIAssistMode] = useState(false);
  const [aiAssistText, setAiAssistText] = useState('');
  const aiAssistInputRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const aiAssistRequestIdRef = useRef(0);
  const [isAIAssistLoading, setIsAIAssistLoading] = useState(false);

  const submitAIAssist = useCallback((): void => {
    if (isAIAssistLoading) return;

    const requirement = aiAssistText.trim();
    if (!requirement) {
      showToast('请先描述你的正则表达式需求', 'error');
      return;
    }

    const requestId = (aiAssistRequestIdRef.current += 1);
    setIsAIAssistLoading(true);

    void (async () => {
      try {
        const result = await onGenerateRegexAssist(requirement);
        if (aiAssistRequestIdRef.current !== requestId) return;

        onFindPatternChange(result.find);
        onReplacePatternChange(result.replace);
        setIsAIAssistMode(false);
        setAiAssistText('');
        window.setTimeout(() => findInputRef.current?.focus(), 0);
      } catch (err) {
        if (aiAssistRequestIdRef.current !== requestId) return;
        const message = err instanceof Error ? err.message : 'AI 生成正则失败，请重试';
        showToast(message, 'error');
      } finally {
        if (aiAssistRequestIdRef.current === requestId) {
          setIsAIAssistLoading(false);
        }
      }
    })();
  }, [
    aiAssistText,
    isAIAssistLoading,
    onFindPatternChange,
    onGenerateRegexAssist,
    onReplacePatternChange,
    showToast
  ]);

  useEffect(() => {
    if (mode !== 'regex') {
      setIsAIAssistMode(false);
      setAiAssistText('');
      setIsAIAssistLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!isAIAssistMode) return;
    const t = window.setTimeout(() => aiAssistInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isAIAssistMode]);

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
  const handlePrimarySubmit = (): void => {
    if (
      savePreset.maybeOpenFromInstruction(instruction, onInstructionChange, {
        onBeforeBegin: slashMenu.close
      })
    ) {
      return;
    }
    onGenerate();
  };

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
        {aiSession === 'review' && mode === 'auto' && pendingDecision && (
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

        {isReviewMode && (mode === 'regex' || (mode === 'auto' && aiSession !== 'review')) && (
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
              'flex-1 relative',
              'transition-all duration-300 ease-in-out',
              mode === 'regex' ? 'min-h-[88px]' : 'min-h-[44px]'
            )}
          >
            {mode === 'regex' ? (
              // 正则模式：双行输入框
              <div className="h-full flex flex-col">
                {isAIAssistMode ? (
                  <div className="h-full flex items-center px-4">
                    <div className="relative flex-1">
                      <input
                        ref={aiAssistInputRef}
                        type="text"
                        placeholder="请描述您的正则需求 (例如: 删除所有括号内的内容)..."
                        value={aiAssistText}
                        onChange={(e) => setAiAssistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            aiAssistRequestIdRef.current += 1;
                            setIsAIAssistLoading(false);
                            setIsAIAssistMode(false);
                            setAiAssistText('');
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitAIAssist();
                            return;
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
                        onClick={submitAIAssist}
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
                        onClick={() => {
                          setIsAIAssistMode(true);
                          setAiAssistText('');
                        }}
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
          <FooterSubmitControl
            mode={mode}
            aiSession={aiSession}
            instruction={instruction}
            isReviewMode={isReviewMode}
            isRenaming={isRenaming}
            isApplying={isApplying}
            isEmpty={isEmpty}
            isDisabled={isDisabled}
            canSubmit={canSubmit}
            onStop={onStop}
            onPrimary={handlePrimarySubmit}
          />
        </div>
      </div>
    </>
  );
}
