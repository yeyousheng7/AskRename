import { useCallback, useMemo, useState, type RefObject } from 'react';
import type { Preset } from '@/types/preset';
import type { Mode } from '@/types/mode';

export function useSlashPresetMenu({
  instruction,
  presets,
  inputRef,
  onModeChange,
  onInstructionChange,
  onFindPatternChange,
  onReplacePatternChange
}: {
  instruction: string;
  presets: Preset[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onModeChange: (mode: Mode) => void;
  onInstructionChange: (next: string) => void;
  onFindPatternChange: (next: string) => void;
  onReplacePatternChange: (next: string) => void;
}): {
  isOpen: boolean;
  filteredPresets: Preset[];
  selectedIndex: number;
  safeSelectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setOpenForText: (text: string) => void;
  close: () => void;
  handleSelect: (preset: Preset) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredPresets = useMemo(() => {
    if (!isOpen) return [];
    if (!instruction.startsWith('/')) return [];
    const query = instruction.slice(1).trim().toLowerCase();
    if (!query) return presets;
    return presets.filter(
      (p) =>
        p.id.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
    );
  }, [isOpen, instruction, presets]);

  const safeSelectedIndex =
    filteredPresets.length === 0 ? 0 : Math.min(selectedIndex, filteredPresets.length - 1);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(0);
  }, []);

  const setOpenForText = useCallback((text: string) => {
    const shouldOpen = text.startsWith('/');
    setIsOpen(shouldOpen);
    if (!shouldOpen) setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (preset: Preset) => {
      if (preset.type === 'regex') {
        onModeChange('regex');
        onFindPatternChange(preset.content);
        onReplacePatternChange('');
        onInstructionChange('');
      } else {
        onInstructionChange(preset.content);
      }
      close();
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [
      close,
      inputRef,
      onFindPatternChange,
      onInstructionChange,
      onModeChange,
      onReplacePatternChange
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || filteredPresets.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPresets.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredPresets.length) % filteredPresets.length);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredPresets[safeSelectedIndex];
        if (selected) handleSelect(selected);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return true;
      }

      return false;
    },
    [close, filteredPresets, handleSelect, isOpen, safeSelectedIndex]
  );

  return {
    isOpen,
    filteredPresets,
    selectedIndex,
    safeSelectedIndex,
    setSelectedIndex,
    setOpenForText,
    close,
    handleSelect,
    handleKeyDown
  };
}
