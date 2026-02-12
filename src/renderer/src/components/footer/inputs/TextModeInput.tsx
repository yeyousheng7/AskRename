import TextareaAutosize from 'react-textarea-autosize';
import { CommandMenu } from '@/components/CommandMenu';
import { cn } from '@/lib/utils';
import type { useSavePresetCommand } from '@/hooks/useSavePresetCommand';
import type { useSlashPresetMenu } from '@/hooks/useSlashPresetMenu';
import type { AISessionState } from '@/types/ai';

type SavePresetController = ReturnType<typeof useSavePresetCommand>;
type SlashMenuController = ReturnType<typeof useSlashPresetMenu>;

export function TextModeInput({
  isReviewMode,
  instruction,
  inputRef,
  isEmpty,
  isDisabled,
  aiSession,
  slashMenu,
  savePreset,
  onInstructionChange,
  onGenerate,
  onConfirmDecision,
  onDiscardDecision
}: {
  isReviewMode: boolean;
  instruction: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isEmpty: boolean;
  isDisabled: boolean;
  aiSession: AISessionState;
  slashMenu: SlashMenuController;
  savePreset: SavePresetController;
  onInstructionChange: (next: string) => void;
  onGenerate: () => void;
  onConfirmDecision: () => void;
  onDiscardDecision: () => void;
}): React.JSX.Element {
  return (
    <>
      {slashMenu.isOpen && (
        <CommandMenu
          presets={slashMenu.filteredPresets}
          selectedIndex={slashMenu.safeSelectedIndex}
          onSelect={slashMenu.handleSelect}
          query={instruction.startsWith('/') ? instruction.slice(1) : ''}
        />
      )}
      <div className="h-full flex items-center">
        <TextareaAutosize
          ref={inputRef}
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
            if (e.nativeEvent.isComposing) return;

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
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (aiSession === 'review') onConfirmDecision();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              if (aiSession === 'review') onDiscardDecision();
            }
          }}
          disabled={isEmpty || isDisabled}
          className={cn(
            'flex-1 min-w-0 pl-4 pr-4 py-2.5 leading-6 bg-transparent border-0 outline-none',
            'resize-none overflow-y-auto overflow-x-hidden break-words',
            'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'text-sm'
          )}
          minRows={1}
          maxRows={6}
        />
      </div>
    </>
  );
}
