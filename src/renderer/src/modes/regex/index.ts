import { Regex } from 'lucide-react';
import type { RenameStrategy } from '@renderer/types/types';
import { RegexInput } from './RegexInput';
import { executeRegex, type RegexParams } from './core';

export const RegexStrategy: RenameStrategy<RegexParams> = {
  id: 'regex',
  meta: {
    label: '正则',
    icon: Regex,
    description: '手动输入正则表达式'
  },
  InputComponent: RegexInput,
  validate: (params) => {
    if (!params.findPattern.trim()) {
      return { valid: false, error: '查找正则不能为空' };
    }
    return { valid: true };
  },
  execute: executeRegex
};
