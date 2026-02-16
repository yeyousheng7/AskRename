import type { ComponentType } from 'react';
import type { ToastType } from '@/hooks/useToast';
import type { FileItem } from '@/types/file';
import type {
  RenameStrategyId,
  RenameStrategyMeta,
  RenameValidationResult,
  StrategyResult
} from '@/types/types';
import type { AIChatSettings } from '@shared/ipc-types';

export interface FooterInputProps {
  modeId: RenameStrategyId;
  isDisabled: boolean;
  isEmpty: boolean;
  payload: unknown;
  onPayloadChange: (payload: unknown) => void;
  onSubmit: () => void;
  showToast: (message: string, type: ToastType) => void;
  getAIConfig?: () => Promise<AIChatSettings>;
}

export type FooterInputComponent = ComponentType<FooterInputProps>;

export interface StrategyExecuteContext {
  runners?: Record<string, (instruction: string) => Promise<void>>;
  aiConfig?: AIChatSettings;
  batching?: {
    batchSize: number;
    concurrencyLimit: number;
    totalFiles?: number;
  };
}

export interface BatchChunkMeta {
  batchIndex: number;
  start: number;
  startIndex: number; // 1-based index in full file list
  requestId: string;
}

export interface ModeStrategy {
  id: RenameStrategyId;
  meta: RenameStrategyMeta;
  createInitialPayload: () => unknown;
  normalizePayload?: (payload: unknown, context?: unknown) => unknown;
  getSubmitToken: (payload: unknown) => string;
  validateSubmit?: (payload: unknown) => RenameValidationResult;
  buildPreview?: (files: FileItem[], payload: unknown) => string[] | null;
  execute: (
    files: FileItem[],
    payload: unknown,
    context: StrategyExecuteContext
  ) => Promise<StrategyResult>;
  executeBatchChunk?: (
    files: FileItem[],
    payload: unknown,
    context: StrategyExecuteContext,
    chunkMeta: BatchChunkMeta
  ) => Promise<FileItem[]>;
  FooterInputComponent?: FooterInputComponent;
  hydratePresetContent?: (content: string) => unknown;
}
