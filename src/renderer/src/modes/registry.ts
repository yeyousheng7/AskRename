import type { RenameStrategyId } from '@renderer/types/types';
import type {
  FooterReviewKind,
  FooterReviewResolverContext,
  RegexSubmitParams,
  StrategySubmitParamsById,
  TextSubmitParams
} from '@renderer/types/types';
import type { FileItem } from '@/types/file';
import type { PendingDecision } from '@/types/ai';
import { AIStrategy } from '@/modes/ai';
import { RegexStrategy } from '@/modes/regex';
import { SmartStrategy } from '@/modes/smart';
import { batchApplyMagicRegex } from '@/lib/magic-regex';

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

export function getModeSubmitInput(
  mode: RenameStrategyId,
  values: {
    instruction: string;
    findPattern: string;
  }
): string {
  return mode === 'regex' ? values.findPattern.trim() : values.instruction.trim();
}

export function resolveFooterReviewKind(ctx: FooterReviewResolverContext): FooterReviewKind {
  if (ctx.aiSession === 'review' && ctx.mode === 'smart' && ctx.pendingDecision) {
    return 'smart-decision';
  }
  if (ctx.isReviewMode && ctx.mode === 'ai') {
    return 'ai-review';
  }
  if (
    ctx.isReviewMode &&
    (ctx.mode === 'regex' || (ctx.mode === 'smart' && ctx.aiSession !== 'review'))
  ) {
    return 'plain-review';
  }
  return 'none';
}

export function shouldDisableSubmitForReview(
  mode: RenameStrategyId,
  values: {
    instruction: string;
    isReviewMode: boolean;
  }
): boolean {
  return values.isReviewMode && (mode === 'regex' || values.instruction.trim().length === 0);
}

export function getFooterInputVariant(mode: RenameStrategyId): 'regex' | 'text' {
  return mode === 'regex' ? 'regex' : 'text';
}

function hasMagicIndexVars(text: string): boolean {
  return /\$\{i(?:0|00|000)?\}/.test(text);
}

export function computeRegexPreviewNames(originals: string[], params: RegexSubmitParams): string[] {
  return batchApplyMagicRegex(originals, params.findPattern, params.replacePattern);
}

export function resolveReorderMagicPreview(
  mode: RenameStrategyId,
  files: FileItem[],
  context: {
    findPattern: string;
    replacePattern: string;
    aiSession: 'idle' | 'loading' | 'review';
    pendingDecision: PendingDecision;
    pendingRegexOrigin: 'ai' | 'rule';
  }
): { names: string[]; origin: 'ai' | 'rule' } | null {
  if (files.length === 0) return null;

  const originals = files.map((f) => f.original);

  if (mode === 'regex') {
    if (!hasMagicIndexVars(context.replacePattern)) return null;
    return {
      names: computeRegexPreviewNames(originals, {
        findPattern: context.findPattern,
        replacePattern: context.replacePattern
      }),
      origin: 'rule'
    };
  }

  if (context.aiSession === 'review' && context.pendingDecision?.type === 'regex') {
    if (!hasMagicIndexVars(context.pendingDecision.replace)) return null;
    return {
      names: computeRegexPreviewNames(originals, {
        findPattern: context.pendingDecision.find,
        replacePattern: context.pendingDecision.replace
      }),
      origin: context.pendingRegexOrigin
    };
  }

  return null;
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
