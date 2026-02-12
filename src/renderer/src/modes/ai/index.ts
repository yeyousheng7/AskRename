import { SparklesIcon } from 'lucide-react';
import type { FileItem } from '@/types/file';
import type { RenameStrategy } from '@renderer/types/types';
import { AIInput, type AIParams } from './AIInput';
import { normalizeAIInstruction } from './promptBuilder';

export const AIStrategy: RenameStrategy<
  AIParams & { runner?: (instruction: string) => Promise<void> }
> = {
  id: 'ai',
  meta: {
    label: 'AI',
    icon: SparklesIcon,
    description: '始终使用 AI 生成文件名'
  },
  InputComponent: AIInput,
  validate: (params) => {
    if (!normalizeAIInstruction(params.instruction)) {
      return { valid: false, error: '请输入指令' };
    }
    return { valid: true };
  },
  execute: async (files: FileItem[], params) => {
    if (params.runner) {
      await params.runner(normalizeAIInstruction(params.instruction));
    }
    return files;
  }
};
