import { LoaderIcon, SparklesIcon, Undo2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import type { ToastType } from '@/hooks/useToast';
import type { Mode } from '@/types/mode';
import { cn } from '@/lib/utils';
import { FooterModeMenu } from '@/components/footer/ModeMenu';
import { SavePresetDialog } from '@/components/footer/SavePresetDialog';
import { FooterReviewActionsBar } from '@/components/footer/ReviewActionsBar';
import { FooterSubmitControl } from '@/components/footer/SubmitControl';
import {
  TextModeInput,
  type SavePresetInputController,
  type SlashMenuInputController
} from '@/components/footer/inputs/TextModeInput';
import { AIReviewCard } from '@/components/review/AIReviewCard';
import { FloatingPreviewBar } from '@/components/shared/FloatingPreviewBar';
import type { FooterInputComponent } from '@/modes/contracts';
import type { AIChatSettings } from '@shared/ipc-types';

type FooterReviewKind = 'none' | 'ai-review' | 'smart-review' | 'plain-review';

interface SavePresetDialogController {
  isDialogOpen: boolean;
  presetName: string;
  setPresetName: (next: string) => void;
  cancel: () => void;
  confirm: () => void;
}

export function AppFooter({
  mode,
  effectiveMode,
  canSubmitToken,
  disableSubmitForReview,
  inputMinHeightClass,
  submitTitle,
  showHistoryDrawer,
  isSmartRegexPanel,
  CustomInput,
  smartDerivedRegex,
  onClearSmartDerivedRegex,
  onModeChange,
  error,
  isEmpty,
  isReviewMode,
  reviewKind,
  isProcessing,
  isApplying,
  isUndoing,
  canUndo,
  payload,
  onPayloadChange,
  onUndo,
  onDiscard,
  onApply,
  onStop,
  onPrimarySubmit,
  aiPreviewCount,
  smartPreviewCount,
  getAIConfig,
  showToast,
  history,
  instruction,
  inputRef,
  slashMenu,
  savePresetInput,
  savePresetDialog,
  onInstructionChange,
  onHistorySelect
}: {
  mode: Mode;
  effectiveMode: Mode;
  canSubmitToken: string;
  disableSubmitForReview: boolean;
  inputMinHeightClass: string;
  submitTitle: string;
  showHistoryDrawer: boolean;
  isSmartRegexPanel: boolean;
  CustomInput: FooterInputComponent | null;
  smartDerivedRegex: { find: string; replace: string } | null;
  onClearSmartDerivedRegex: () => void;
  onModeChange: (mode: Mode) => void;
  error: string | null;
  isEmpty: boolean;
  isReviewMode: boolean;
  reviewKind: FooterReviewKind;
  isProcessing: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  payload: unknown;
  onPayloadChange: (payload: unknown) => void;
  onUndo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  onStop: () => void;
  onPrimarySubmit: () => void;
  aiPreviewCount: number;
  smartPreviewCount: number;
  getAIConfig: () => Promise<AIChatSettings>;
  showToast: (message: string, type: ToastType) => void;
  history: string[];
  instruction: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  slashMenu: SlashMenuInputController;
  savePresetInput: SavePresetInputController;
  savePresetDialog: SavePresetDialogController;
  onInstructionChange: (next: string) => void;
  onHistorySelect: (text: string) => void;
}): React.JSX.Element {
  const isDisabled = isProcessing || isApplying || isUndoing;

  return (
    <>
      <SavePresetDialog
        open={savePresetDialog.isDialogOpen}
        presetName={savePresetDialog.presetName}
        onPresetNameChange={savePresetDialog.setPresetName}
        onCancel={savePresetDialog.cancel}
        onConfirm={savePresetDialog.confirm}
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
        {showHistoryDrawer && <HistoryDrawer history={history} onSelect={onHistorySelect} />}

        {error && (
          <div className="px-4 pt-3 pb-0">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {reviewKind === 'ai-review' && (
          <AIReviewCard
            count={aiPreviewCount}
            isApplying={isApplying}
            onDiscard={onDiscard}
            onApply={onApply}
          />
        )}

        {reviewKind === 'smart-review' && (
          <FloatingPreviewBar
            title="智能重命名预览"
            icon={<SparklesIcon className="h-3.5 w-3.5" />}
            content={
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                已根据指令生成 {smartPreviewCount} 个文件名
              </div>
            }
            isLoading={isApplying}
            onCancel={onDiscard}
            onConfirm={onApply}
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

        {isSmartRegexPanel && smartDerivedRegex && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center justify-between rounded-lg bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2">
              <span className="text-xs text-amber-700 dark:text-amber-300">
                AI 已生成正则规则，你仍在智能模式中
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onClearSmartDerivedRegex}
                disabled={isDisabled}
              >
                返回文本输入
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-stretch">
          <FooterModeMenu mode={mode} onModeChange={onModeChange} disabled={isDisabled} />

          <div
            className={cn(
              'flex-1 min-w-0 relative',
              'transition-all duration-300 ease-in-out',
              inputMinHeightClass
            )}
          >
            {CustomInput ? (
              <CustomInput
                modeId={effectiveMode}
                isDisabled={isDisabled}
                isEmpty={isEmpty}
                payload={payload}
                onPayloadChange={onPayloadChange}
                onSubmit={onPrimarySubmit}
                showToast={showToast}
                getAIConfig={getAIConfig}
              />
            ) : (
              <TextModeInput
                isReviewMode={isReviewMode}
                instruction={instruction}
                inputRef={inputRef}
                isEmpty={isEmpty}
                isDisabled={isDisabled}
                slashMenu={slashMenu}
                savePreset={savePresetInput}
                onInstructionChange={onInstructionChange}
                onGenerate={onPrimarySubmit}
              />
            )}
          </div>

          <FooterSubmitControl
            disableSubmitForReview={disableSubmitForReview}
            isProcessing={isProcessing}
            isApplying={isApplying}
            isEmpty={isEmpty}
            isDisabled={isDisabled}
            canSubmit={canSubmitToken}
            primaryTitle={submitTitle}
            onStop={onStop}
            onPrimary={onPrimarySubmit}
          />
        </div>
      </div>
    </>
  );
}
