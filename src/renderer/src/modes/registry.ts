import type { RenameStrategyId } from '@renderer/types/types';
import type {
  RegexSubmitParams,
  StrategySubmitParamsById,
  TextSubmitParams
} from '@renderer/types/types';
import type { FileItem } from '@/types/file';
import { AIStrategy } from '@/modes/ai';
import { RegexStrategy } from '@/modes/regex';
import { SmartStrategy } from '@/modes/smart';

export const MODES = {
  smart: SmartStrategy,
  ai: AIStrategy,
  regex: RegexStrategy
} as const;

export function getModeById(id: RenameStrategyId): (typeof MODES)[RenameStrategyId] {
  return MODES[id];
}

export function getModeList(): Array<(typeof MODES)[RenameStrategyId]> {
  return Object.values(MODES);
}

type StrategyRunResult =
  | { ok: true; files: FileItem[] }
  | {
      ok: false;
      error: string;
    };

export async function executeModeStrategy(
  mode: 'regex',
  files: FileItem[],
  params: RegexSubmitParams,
  runners: Record<'smart' | 'ai', (instruction: string) => Promise<void>>
): Promise<StrategyRunResult>;
export async function executeModeStrategy(
  mode: 'smart' | 'ai',
  files: FileItem[],
  params: TextSubmitParams,
  runners: Record<'smart' | 'ai', (instruction: string) => Promise<void>>
): Promise<StrategyRunResult>;
export async function executeModeStrategy(
  mode: RenameStrategyId,
  files: FileItem[],
  params: StrategySubmitParamsById[RenameStrategyId],
  runners: Record<'smart' | 'ai', (instruction: string) => Promise<void>>
): Promise<StrategyRunResult> {
  if (mode === 'regex') {
    const validation = RegexStrategy.validate?.(params as RegexSubmitParams);
    if (validation && !validation.valid) {
      return { ok: false, error: validation.error || '参数无效' };
    }

    const nextFiles = await RegexStrategy.execute(files, params as RegexSubmitParams);
    return { ok: true, files: nextFiles };
  }

  if (mode === 'ai') {
    const typedParams = params as TextSubmitParams;
    const validation = AIStrategy.validate?.(typedParams);
    if (validation && !validation.valid) {
      return { ok: false, error: validation.error || '参数无效' };
    }

    const nextFiles = await AIStrategy.execute(files, {
      ...typedParams,
      runner: runners.ai
    });
    return { ok: true, files: nextFiles };
  }

  const typedParams = params as TextSubmitParams;
  const validation = SmartStrategy.validate?.(typedParams);
  if (validation && !validation.valid) {
    return { ok: false, error: validation.error || '参数无效' };
  }

  const nextFiles = await SmartStrategy.execute(files, {
    ...typedParams,
    runner: runners.smart
  });
  return { ok: true, files: nextFiles };
}
