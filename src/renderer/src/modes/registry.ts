import type { RenameStrategyId } from '@renderer/types/types';
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
