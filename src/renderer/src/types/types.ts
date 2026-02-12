import type { ComponentType } from 'react';
import type { FileItem } from '@/types/file';
import type { AISessionState, PendingDecision } from '@/types/ai';

export type RenameStrategyId = 'smart' | 'ai' | 'regex';

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

export interface RenameStrategyInputProps<TParams = unknown> {
  files: FileItem[];
  isDisabled: boolean;
  onCommit: (params: TParams) => void;
}

export interface RenameValidationResult {
  valid: boolean;
  error?: string;
}

export interface RegexSubmitParams {
  findPattern: string;
  replacePattern: string;
}

export interface TextSubmitParams {
  instruction: string;
}

export interface StrategySubmitParamsById {
  smart: TextSubmitParams;
  ai: TextSubmitParams;
  regex: RegexSubmitParams;
}

export type StrategySubmitParams = StrategySubmitParamsById[RenameStrategyId];

export type FooterReviewKind = 'smart-decision' | 'ai-review' | 'plain-review' | 'none';

export interface FooterReviewResolverContext {
  mode: RenameStrategyId;
  aiSession: AISessionState;
  isReviewMode: boolean;
  pendingDecision: PendingDecision;
}

export interface RenameStrategy<TParams = unknown> {
  id: RenameStrategyId;
  meta: RenameStrategyMeta;
  InputComponent: ComponentType<RenameStrategyInputProps<TParams>>;
  execute: (files: FileItem[], params: TParams) => Promise<FileItem[]>;
  validate?: (params: TParams) => RenameValidationResult;
}

export type AnyRenameStrategy = RenameStrategy<unknown>;
