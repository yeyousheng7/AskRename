import { Zap } from 'lucide-react';
import type { FileItem } from '@/types/file';
import type { ModeStrategy } from '@/modes/contracts';
import { generateAutoDecision, generateNewNames } from '@/lib/ai-service';
import { normalizeBackreferenceSyntax } from '@/lib/safe-replace';
import { batchApplyMagicRegex } from '@/modes/regex/magic-regex';

function getInstruction(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>).instruction;
  return typeof value === 'string' ? value.trim() : '';
}

function containsRegexPlaceholder(names: string[]): boolean {
  return names.some((name) => /\\\d+|\$\d+/.test(name));
}

function mapNamesToFiles(
  files: FileItem[],
  names: string[],
  origin: 'ai' | 'rule' = 'ai'
): FileItem[] {
  return files.map((file, index) => ({
    ...file,
    renamed: names[index] ?? file.original,
    renameOrigin: origin
  }));
}

function countCapturingGroups(pattern: string): number {
  let count = 0;
  let escaped = false;
  let inCharClass = false;

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (!char) continue;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '[') {
      inCharClass = true;
      continue;
    }

    if (char === ']' && inCharClass) {
      inCharClass = false;
      continue;
    }

    if (inCharClass || char !== '(') continue;

    const next = pattern[i + 1] ?? '';
    const nextTwo = pattern.slice(i + 1, i + 3);
    if (next === '?') {
      // Named capturing groups are still capturing: (?<name>...)
      if (nextTwo === '?<') count += 1;
      continue;
    }

    count += 1;
  }

  return count;
}

function normalizeSequenceReplacement(
  findPattern: string,
  replacePattern: string,
  instruction: string
): string {
  const normalized = normalizeBackreferenceSyntax(replacePattern);
  const asksSequence = /(序号|编号|流水号|递增|顺序|序列|index|number)/i.test(instruction);
  if (!asksSequence) return normalized;
  if (/\$\{i(?:000|00|0)?\}/.test(normalized)) return normalized;
  if (countCapturingGroups(findPattern) > 0) return normalized;

  const serialAlias: Record<string, string> = {
    '1': '${i}',
    '2': '${i0}',
    '3': '${i00}',
    '4': '${i000}'
  };

  return normalized.replace(
    /(^|[^$])\$(1|2|3|4)(?!\d)/g,
    (_match, prefix: string, digit: string) => {
      return `${prefix}${serialAlias[digit]}`;
    }
  );
}

export const SmartStrategy: ModeStrategy = {
  id: 'smart',
  meta: {
    label: '智能',
    icon: Zap,
    description: 'AI 自动判断使用规则转换或完整生成',
    ui: {
      inputMinHeightClass: 'min-h-[44px]',
      showHistoryDrawer: true,
      submitTitle: '生成'
    }
  },
  createInitialPayload: () => ({ instruction: '' }),
  getSubmitToken: (payload) => getInstruction(payload),
  hydratePresetContent: (content) => ({ instruction: content }),
  validateSubmit: (payload) => {
    if (!getInstruction(payload)) {
      return { valid: false, error: '请输入指令' };
    }
    return { valid: true };
  },
  execute: async (files: FileItem[], payload, context) => {
    const instruction = getInstruction(payload);
    if (!instruction) return { type: 'list', files };

    const aiConfig = context.aiConfig;
    if (!aiConfig) {
      throw new Error('AI 配置缺失，请先在设置中配置 API 参数');
    }

    const originals = files.map((file) => file.original);
    const decision = await generateAutoDecision(originals, instruction, aiConfig);

    switch (decision.type) {
      case 'regex': {
        if (!decision.payload.find.trim()) {
          throw new Error('Smart 决策返回的正则模式缺少 find');
        }
        return {
          type: 'regex-handoff',
          payload: {
            find: decision.payload.find,
            replace: normalizeSequenceReplacement(
              decision.payload.find,
              decision.payload.replace,
              instruction
            )
          }
        };
      }
      case 'list': {
        if (decision.names.length === files.length && !containsRegexPlaceholder(decision.names)) {
          return {
            type: 'list',
            files: mapNamesToFiles(files, decision.names, 'ai')
          };
        }
        break;
      }
      default: {
        const _exhaustiveCheck: never = decision;
        throw new Error(`未知 smart 决策类型: ${String(_exhaustiveCheck)}`);
      }
    }

    const names = await generateNewNames(originals, instruction, aiConfig);

    return {
      type: 'list',
      files: mapNamesToFiles(files, names, 'ai')
    };
  },
  executeBatchChunk: async (files: FileItem[], payload, context, chunkMeta) => {
    const instruction = getInstruction(payload);
    if (!instruction) return files;

    const aiConfig = context.aiConfig;
    if (!aiConfig) {
      throw new Error('AI 配置缺失，请先在设置中配置 API 参数');
    }

    const originals = files.map((file) => file.original);
    const fallbackToList = async (): Promise<FileItem[]> => {
      const names = await generateNewNames(originals, instruction, aiConfig, {
        requestId: chunkMeta.requestId,
        startIndex: chunkMeta.startIndex,
        totalCount: context.batching?.totalFiles
      });
      return mapNamesToFiles(files, names, 'ai');
    };

    let decision: Awaited<ReturnType<typeof generateAutoDecision>>;
    try {
      decision = await generateAutoDecision(originals, instruction, aiConfig, chunkMeta.requestId, {
        startIndex: chunkMeta.startIndex,
        totalCount: context.batching?.totalFiles
      });
    } catch {
      return fallbackToList();
    }

    switch (decision.type) {
      case 'regex': {
        const find = decision.payload.find.trim();
        if (!find) {
          return fallbackToList();
        }

        const replace = normalizeSequenceReplacement(find, decision.payload.replace, instruction);
        try {
          new RegExp(find, 'g');
          const names = batchApplyMagicRegex(
            originals,
            find,
            replace,
            Math.max(1, chunkMeta.startIndex)
          );
          if (names.length !== files.length) {
            return fallbackToList();
          }
          if (names.every((name, index) => name === originals[index])) {
            return fallbackToList();
          }
          return mapNamesToFiles(files, names, 'ai');
        } catch {
          return fallbackToList();
        }
      }
      case 'list': {
        if (decision.names.length !== files.length || containsRegexPlaceholder(decision.names)) {
          return fallbackToList();
        }
        return mapNamesToFiles(files, decision.names, 'ai');
      }
      default: {
        const _exhaustiveCheck: never = decision;
        throw new Error(`未知 smart 决策类型: ${String(_exhaustiveCheck)}`);
      }
    }
  }
};
