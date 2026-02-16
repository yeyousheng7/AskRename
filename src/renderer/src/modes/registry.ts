import type { FileItem } from '@/types/file';
import type { Mode } from '@/types/mode';
import type { RenameStrategyId, StrategyResult } from '@/types/types';
import type { ModeStrategy } from '@/modes/contracts';
import { AIStrategy } from '@/modes/ai';
import { RegexStrategy } from '@/modes/regex';
import { SmartStrategy } from '@/modes/smart';

const MODE_STRATEGIES: Record<Mode, ModeStrategy> = {
  smart: SmartStrategy,
  ai: AIStrategy,
  regex: RegexStrategy
};

export function getModeById(id: RenameStrategyId): ModeStrategy {
  return MODE_STRATEGIES[id];
}

export function getModeList(): ModeStrategy[] {
  return Object.values(MODE_STRATEGIES);
}

export function getModeSubmitInput(mode: RenameStrategyId, payload: unknown): string {
  const normalizedPayload = normalizeModePayload(mode, payload);
  return getModeById(mode).getSubmitToken(normalizedPayload);
}

export function normalizeModePayload(
  mode: RenameStrategyId,
  payload: unknown,
  context?: unknown
): unknown {
  const strategy = getModeById(mode);
  return strategy.normalizePayload ? strategy.normalizePayload(payload, context) : payload;
}

export function buildModePreview(
  mode: RenameStrategyId,
  files: FileItem[],
  payload: unknown
): string[] | null {
  const normalizedPayload = normalizeModePayload(mode, payload);
  return getModeById(mode).buildPreview?.(files, normalizedPayload) ?? null;
}

type StrategyRunResult =
  | { ok: true; result: StrategyResult }
  | {
      ok: false;
      error: string;
    };

export async function executeModeStrategy(
  mode: RenameStrategyId,
  files: FileItem[],
  payload: unknown,
  context: Parameters<ModeStrategy['execute']>[2]
): Promise<StrategyRunResult> {
  const strategy = getModeById(mode);
  const normalizedPayload = normalizeModePayload(mode, payload);
  const validation = strategy.validateSubmit?.(normalizedPayload);
  if (validation && !validation.valid) {
    return { ok: false, error: validation.error || '参数无效' };
  }

  const result = await strategy.execute(files, normalizedPayload, context);
  return { ok: true, result };
}
