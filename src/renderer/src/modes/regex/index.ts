import { Regex } from 'lucide-react';
import type { FileItem } from '@/types/file';
import type { ModeStrategy } from '@/modes/contracts';
import { executeRegex } from './core';
import { RegexFooterInput, type RegexPayload } from './FooterInput';
import { batchApplyMagicRegex } from './magic-regex';

type RegexFallback = { find?: string; replace?: string };

function isRegexFallback(value: unknown): value is RegexFallback {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.find === 'string' ||
    data.find === undefined ||
    typeof data.replace === 'string' ||
    data.replace === undefined
  );
}

function normalizeRegexPayload(payload: unknown, fallback?: RegexFallback): RegexPayload {
  const fallbackFind = fallback?.find ?? '';
  const fallbackReplace = fallback?.replace ?? '';
  if (!payload || typeof payload !== 'object') {
    return { findPattern: fallbackFind, replacePattern: fallbackReplace };
  }
  const value = payload as Record<string, unknown>;
  const findValue =
    typeof value.findPattern === 'string'
      ? value.findPattern
      : typeof value.find === 'string'
        ? value.find
        : fallbackFind;
  const replaceValue =
    typeof value.replacePattern === 'string'
      ? value.replacePattern
      : typeof value.replace === 'string'
        ? value.replace
        : fallbackReplace;
  return { findPattern: findValue, replacePattern: replaceValue };
}

export const RegexStrategy: ModeStrategy = {
  id: 'regex',
  meta: {
    label: '正则',
    icon: Regex,
    description: '手动输入查找替换规则',
    ui: {
      inputMinHeightClass: 'min-h-[88px]',
      showHistoryDrawer: false,
      submitTitle: '应用规则'
    }
  },
  createInitialPayload: () => ({ findPattern: '', replacePattern: '' }),
  normalizePayload: (payload, context) =>
    normalizeRegexPayload(payload, isRegexFallback(context) ? context : undefined),
  getSubmitToken: (payload) => normalizeRegexPayload(payload).findPattern.trim(),
  hydratePresetContent: (content) => ({ findPattern: content, replacePattern: '' }),
  validateSubmit: (payload) => {
    const parsed = normalizeRegexPayload(payload);
    if (!parsed.findPattern.trim()) {
      return { valid: false, error: '查找规则不能为空' };
    }
    return { valid: true };
  },
  buildPreview: (files: FileItem[], payload) => {
    const parsed = normalizeRegexPayload(payload);
    const originals = files.map((f) => f.original);
    return batchApplyMagicRegex(originals, parsed.findPattern, parsed.replacePattern);
  },
  execute: async (files: FileItem[], payload) => {
    return { type: 'list', files: await executeRegex(files, normalizeRegexPayload(payload)) };
  },
  FooterInputComponent: RegexFooterInput
};
