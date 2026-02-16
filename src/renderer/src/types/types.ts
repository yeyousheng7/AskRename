import type { ComponentType } from 'react';
import type { FileItem } from '@/types/file';
import type { Mode } from '@/types/mode';

export type RenameStrategyId = Mode;

export interface RenameStrategyMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  ui?: {
    inputMinHeightClass: string;
    showHistoryDrawer: boolean;
    submitTitle: string;
  };
}

export interface RenameValidationResult {
  valid: boolean;
  error?: string;
}

export interface RegexHandoffIntent {
  type: 'regex-handoff';
  payload: {
    find: string;
    replace: string;
  };
}

export type StrategyResult = { type: 'list'; files: FileItem[] } | RegexHandoffIntent;

export interface SmartRegexDecision {
  type: 'regex';
  payload: {
    find: string;
    replace: string;
  };
}

export interface SmartListDecision {
  type: 'list';
  names: string[];
}

export type SmartDecision = SmartRegexDecision | SmartListDecision;
