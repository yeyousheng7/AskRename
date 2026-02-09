import { useCallback, useRef, useState, type RefObject } from 'react';
import type { ToastType } from '@/hooks/useToast';
import type { Preset } from '@/types/preset';

export function extractSaveCommandContent(text: string): string | null {
  const rightTrimmed = text.replace(/\s+$/, '');
  const lower = rightTrimmed.toLowerCase();
  if (!lower.endsWith('/save')) return null;

  const idx = lower.lastIndexOf('/save');
  if (idx < 0) return null;
  if (idx > 0 && !/\s/.test(lower[idx - 1] ?? '')) return null;

  return rightTrimmed.slice(0, idx).trimEnd();
}

export function useSavePresetCommand({
  inputRef,
  addPreset,
  showToast
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  addPreset: (preset: Omit<Preset, 'id'>) => void;
  showToast: (message: string, type: ToastType) => void;
}): {
  isDialogOpen: boolean;
  presetName: string;
  setPresetName: (next: string) => void;
  presetContent: string;
  cancel: () => void;
  confirm: () => void;
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
} {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetContent, setPresetContent] = useState('');
  const saveDetectedRef = useRef(false);

  const begin = useCallback(
    (content: string) => {
      if (!content.trim()) {
        showToast('没有可保存的内容', 'error');
        return;
      }
      setIsDialogOpen(true);
      setPresetName('');
      setPresetContent(content);
    },
    [showToast]
  );

  const cancel = useCallback(() => {
    setIsDialogOpen(false);
    setPresetName('');
    setPresetContent('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputRef]);

  const confirm = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    addPreset({ name, content: presetContent, type: 'prompt' });
    setIsDialogOpen(false);
    setPresetName('');
    setPresetContent('');
    showToast('✅ 预设已保存', 'success');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [addPreset, inputRef, presetContent, presetName, showToast]);

  const maybeBegin = useCallback(
    (
      saveContent: string,
      onInstructionChange: (next: string) => void,
      onBeforeBegin?: () => void
    ): void => {
      onBeforeBegin?.();
      onInstructionChange(saveContent);
      begin(saveContent);
    },
    [begin]
  );

  const maybeOpenFromText = useCallback(
    (
      text: string,
      onInstructionChange: (next: string) => void,
      opts?: { onBeforeBegin?: () => void }
    ): boolean => {
      const saveContent = extractSaveCommandContent(text);
      if (saveContent !== null && !isDialogOpen && !saveDetectedRef.current) {
        saveDetectedRef.current = true;
        maybeBegin(saveContent, onInstructionChange, opts?.onBeforeBegin);
        return true;
      }
      saveDetectedRef.current = saveContent !== null;
      return false;
    },
    [isDialogOpen, maybeBegin]
  );

  const maybeOpenFromInstruction = useCallback(
    (
      instruction: string,
      onInstructionChange: (next: string) => void,
      opts?: { onBeforeBegin?: () => void }
    ): boolean => {
      const saveContent = extractSaveCommandContent(instruction);
      if (saveContent === null) return false;
      maybeBegin(saveContent, onInstructionChange, opts?.onBeforeBegin);
      return true;
    },
    [maybeBegin]
  );

  return {
    isDialogOpen,
    presetName,
    setPresetName,
    presetContent,
    cancel,
    confirm,
    maybeOpenFromText,
    maybeOpenFromInstruction
  };
}
