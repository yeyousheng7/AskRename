import TextareaAutosize from 'react-textarea-autosize';
import { CommandMenu } from '@/components/CommandMenu';
import { cn } from '@/lib/utils';
import type { Preset } from '@/types/preset';

export interface SavePresetInputController {
  maybeOpenFromText: (
    text: string,
    onInstructionChange: (next: string) => void,
    opts?: { onBeforeBegin?: () => void }
  ) => boolean;
  maybeOpenFromInstruction: (
    instruction: string,
    onInstructionChange: (next: string) => void,
    opts?: { onBeforeBegin?: () => void }
  ) => boolean;
}

export interface SlashMenuInputController {
  isOpen: boolean;
  filteredPresets: Preset[];
  safeSelectedIndex: number;
  setOpenForText: (text: string) => void;
  close: () => void;
  handleSelect: (preset: Preset) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

export function TextModeInput({
  isReviewMode,
  instruction,
  inputRef,
  isEmpty,
  isDisabled,
  slashMenu,
  savePreset,
  onInstructionChange,
  onGenerate
}: {
  isReviewMode: boolean;
  instruction: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isEmpty: boolean;
  isDisabled: boolean;
  slashMenu: SlashMenuInputController;
  savePreset: SavePresetInputController;
  onInstructionChange: (next: string) => void;
  onGenerate: () => void;
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

            if (e.key === 'Escape') {
              e.preventDefault();
              slashMenu.close();
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
