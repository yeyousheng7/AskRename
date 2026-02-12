import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderIcon, Undo2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from '@/components/HistoryDrawer';
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
import { RegexModeInput } from '@/components/footer/inputs/RegexModeInput';
import { TextModeInput } from '@/components/footer/inputs/TextModeInput';
import { useSavePresetCommand } from '@/hooks/useSavePresetCommand';
import { useSlashPresetMenu } from '@/hooks/useSlashPresetMenu';
import type { RegexSubmitParams, TextSubmitParams } from '@renderer/types/types';
import {
  getFooterInputVariant,
  getModeSubmitInput,
  MODES,
  resolveFooterReviewKind,
  shouldDisableSubmitForReview
} from '@/modes/registry';

export function AppFooter({
  stableOriginalNamesKey,
  mode,
  onModeChange,
  error,
  isEmpty,
  isReviewMode,
  isRenaming,
  isApplying,
  isUndoing,
  canUndo,
  aiSession,
  pendingDecision,
  onConfirmDecision,
  onDiscardDecision,
  onUpdatePendingRegex,
  onGenerateRegexAssist,
  onRegexPreviewChange,
  onUndo,
  onDiscard,
  onApply,
  onStop,
  onGenerate,
  showToast,
  history
}: {
  stableOriginalNamesKey: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  error: string | null;
  isEmpty: boolean;
  isReviewMode: boolean;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  aiSession: AISessionState;
  pendingDecision: PendingDecision;
  onConfirmDecision: () => void;
  onDiscardDecision: () => void;
  onUpdatePendingRegex: (find: string, replace: string) => void;
  onGenerateRegexAssist: (requirement: string) => Promise<{ find: string; replace: string }>;
  onRegexPreviewChange: (params: RegexSubmitParams) => void;
  onUndo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  onStop: () => void;
  onGenerate: (params: RegexSubmitParams | TextSubmitParams) => void;
  showToast: (message: string, type: ToastType) => void;
  history: string[];
}): React.JSX.Element {
  const { presets, addPreset } = usePresets();
  const [instruction, setInstruction] = useState('');
  const [findPattern, setFindPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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

        setFindPattern(result.find);
        setReplacePattern(result.replace);
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
  }, [aiAssistText, isAIAssistLoading, onGenerateRegexAssist, showToast]);

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
    onInstructionChange: setInstruction,
    onFindPatternChange: setFindPattern,
    onReplacePatternChange: setReplacePattern
  });

  const savePreset = useSavePresetCommand({ inputRef, addPreset, showToast });
  const isDisabled = isRenaming || isApplying || isUndoing;
  const strategyUi = MODES[mode].meta.ui;
  const inputVariant = getFooterInputVariant(mode);
  const canSubmit = getModeSubmitInput(mode, { instruction, findPattern });
  const reviewKind = resolveFooterReviewKind({ mode, aiSession, isReviewMode, pendingDecision });
  const disableSubmitForReview = shouldDisableSubmitForReview(mode, {
    instruction,
    isReviewMode
  });

  useEffect(() => {
    setInstruction('');
    setFindPattern('');
    setReplacePattern('');
  }, [mode]);

  useEffect(() => {
    if (mode !== 'regex') return;
    onRegexPreviewChange({ findPattern, replacePattern });
  }, [mode, findPattern, replacePattern, onRegexPreviewChange, stableOriginalNamesKey]);

  const handlePrimarySubmit = (): void => {
    if (
      savePreset.maybeOpenFromInstruction(instruction, setInstruction, {
        onBeforeBegin: slashMenu.close
      })
    ) {
      return;
    }
    if (mode === 'regex') {
      onGenerate({ findPattern, replacePattern });
      return;
    }
    onGenerate({ instruction });
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
        {strategyUi?.showHistoryDrawer && (
          <HistoryDrawer
            history={history}
            onSelect={(text) => {
              setInstruction(text);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          />
        )}

        {error && (
          <div className="px-4 pt-3 pb-0">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {reviewKind === 'smart-decision' && pendingDecision && (
          <FooterPendingDecisionCard
            pendingDecision={pendingDecision}
            isApplying={isApplying}
            onUpdatePendingRegex={onUpdatePendingRegex}
            onDiscardDecision={onDiscardDecision}
            onConfirmDecision={onConfirmDecision}
          />
        )}

        {reviewKind === 'ai-review' && (
          <FooterPendingDecisionCard
            pendingDecision={{ type: 'list', names: [] }}
            isApplying={isApplying}
            onUpdatePendingRegex={() => undefined}
            onDiscardDecision={onDiscard}
            onConfirmDecision={onApply}
          />
        )}

        {reviewKind === 'plain-review' && (
          <FooterReviewActionsBar
            isApplying={isApplying}
            isUndoing={isUndoing}
            onDiscard={onDiscard}
            onApply={onApply}
          />
        )}

        <div className="flex items-stretch">
          <FooterModeMenu mode={mode} onModeChange={onModeChange} disabled={isDisabled} />

          <div
            className={cn(
              'flex-1 min-w-0 relative',
              'transition-all duration-300 ease-in-out',
              strategyUi?.inputMinHeightClass ?? 'min-h-[44px]'
            )}
          >
            {inputVariant === 'regex' ? (
              <RegexModeInput
                isAIAssistMode={isAIAssistMode}
                aiAssistText={aiAssistText}
                isAIAssistLoading={isAIAssistLoading}
                isDisabled={isDisabled}
                isEmpty={isEmpty}
                findPattern={findPattern}
                replacePattern={replacePattern}
                aiAssistInputRef={aiAssistInputRef}
                findInputRef={findInputRef}
                onAiAssistTextChange={setAiAssistText}
                onFindPatternChange={setFindPattern}
                onReplacePatternChange={setReplacePattern}
                onSubmitAIAssist={submitAIAssist}
                onOpenAIAssist={() => {
                  setIsAIAssistMode(true);
                  setAiAssistText('');
                }}
                onEscapeAIAssist={() => {
                  aiAssistRequestIdRef.current += 1;
                  setIsAIAssistLoading(false);
                  setIsAIAssistMode(false);
                  setAiAssistText('');
                }}
              />
            ) : (
              <TextModeInput
                isReviewMode={isReviewMode}
                instruction={instruction}
                inputRef={inputRef}
                isEmpty={isEmpty}
                isDisabled={isDisabled}
                aiSession={aiSession}
                slashMenu={slashMenu}
                savePreset={savePreset}
                onInstructionChange={setInstruction}
                onGenerate={() => onGenerate({ instruction })}
                onConfirmDecision={onConfirmDecision}
                onDiscardDecision={onDiscardDecision}
              />
            )}
          </div>

          <FooterSubmitControl
            aiSession={aiSession}
            disableSubmitForReview={disableSubmitForReview}
            isRenaming={isRenaming}
            isApplying={isApplying}
            isEmpty={isEmpty}
            isDisabled={isDisabled}
            canSubmit={canSubmit}
            primaryTitle={strategyUi?.submitTitle ?? '生成'}
            onStop={onStop}
            onPrimary={handlePrimarySubmit}
          />
        </div>
      </div>
    </>
  );
}
