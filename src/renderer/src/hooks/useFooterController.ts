import { useCallback, useMemo, useRef } from 'react';
import { usePresets } from '@/hooks/usePresets';
import { useSavePresetCommand } from '@/hooks/useSavePresetCommand';
import { useSlashPresetMenu } from '@/hooks/useSlashPresetMenu';
import { getModeById } from '@/modes/registry';
import type { FooterInputComponent } from '@/modes/contracts';
import type { Mode } from '@/types/mode';
import type {
  SavePresetInputController,
  SlashMenuInputController
} from '@/components/footer/inputs/TextModeInput';
import type { ToastType } from '@/hooks/useToast';

interface SavePresetDialogController {
  isDialogOpen: boolean;
  presetName: string;
  setPresetName: (next: string) => void;
  cancel: () => void;
  confirm: () => void;
}

function extractInstruction(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  if (!('instruction' in payload)) return '';
  const value = (payload as { instruction?: unknown }).instruction;
  return typeof value === 'string' ? value : '';
}

function buildRegexPresetPayload(content: string): unknown {
  const regexStrategy = getModeById('regex');
  return regexStrategy.hydratePresetContent
    ? regexStrategy.hydratePresetContent(content)
    : { findPattern: content, replacePattern: '' };
}

export function useFooterController({
  mode,
  effectiveMode,
  payload,
  onPayloadChange,
  onModeChange,
  onGenerate,
  showToast
}: {
  mode: Mode;
  effectiveMode: Mode;
  payload: unknown;
  onPayloadChange: (payload: unknown) => void;
  onModeChange: (mode: Mode) => void;
  onGenerate: (payload: unknown) => void;
  showToast: (message: string, type: ToastType) => void;
}): {
  CustomInput: FooterInputComponent | null;
  instruction: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  slashMenu: SlashMenuInputController;
  savePresetInput: SavePresetInputController;
  savePresetDialog: SavePresetDialogController;
  handleInstructionChange: (nextInstruction: string) => void;
  handlePrimarySubmit: () => void;
  handleHistorySelect: (text: string) => void;
} {
  const strategy = useMemo(() => getModeById(effectiveMode), [effectiveMode]);
  const CustomInput = strategy.FooterInputComponent ?? null;

  const instruction = extractInstruction(payload);
  const { presets, addPreset } = usePresets();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleInstructionChange = useCallback(
    (nextInstruction: string): void => {
      if (CustomInput) return;
      onPayloadChange({ instruction: nextInstruction });
    },
    [CustomInput, onPayloadChange]
  );

  const slashMenu = useSlashPresetMenu({
    instruction,
    presets,
    inputRef,
    onPresetSelect: (preset) => {
      if (preset.kind === 'regex') {
        onModeChange('regex');
        onPayloadChange(buildRegexPresetPayload(preset.content));
        return;
      }

      onPayloadChange({ instruction: preset.content });
    }
  });

  const savePreset = useSavePresetCommand({
    inputRef,
    addPreset,
    getPresetKind: () => (mode === 'regex' ? 'regex' : 'instruction'),
    showToast
  });
  const maybeOpenFromInstruction = savePreset.maybeOpenFromInstruction;

  const handlePrimarySubmit = useCallback((): void => {
    if (
      effectiveMode !== 'regex' &&
      maybeOpenFromInstruction(instruction, handleInstructionChange, {
        onBeforeBegin: slashMenu.close
      })
    ) {
      return;
    }
    onGenerate(payload);
  }, [
    effectiveMode,
    handleInstructionChange,
    instruction,
    maybeOpenFromInstruction,
    onGenerate,
    payload,
    slashMenu.close
  ]);

  const handleHistorySelect = useCallback(
    (text: string): void => {
      handleInstructionChange(text);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    },
    [handleInstructionChange]
  );

  const savePresetInput = useMemo<SavePresetInputController>(
    () => ({
      maybeOpenFromText: savePreset.maybeOpenFromText,
      maybeOpenFromInstruction: savePreset.maybeOpenFromInstruction
    }),
    [savePreset.maybeOpenFromInstruction, savePreset.maybeOpenFromText]
  );

  const savePresetDialog = useMemo<SavePresetDialogController>(
    () => ({
      isDialogOpen: savePreset.isDialogOpen,
      presetName: savePreset.presetName,
      setPresetName: savePreset.setPresetName,
      cancel: savePreset.cancel,
      confirm: savePreset.confirm
    }),
    [
      savePreset.cancel,
      savePreset.confirm,
      savePreset.isDialogOpen,
      savePreset.presetName,
      savePreset.setPresetName
    ]
  );

  return {
    CustomInput,
    instruction,
    inputRef,
    slashMenu,
    savePresetInput,
    savePresetDialog,
    handleInstructionChange,
    handlePrimarySubmit,
    handleHistorySelect
  };
}
