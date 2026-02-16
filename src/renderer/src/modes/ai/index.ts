import { SparklesIcon } from 'lucide-react';
import type { FileItem } from '@/types/file';
import type { ModeStrategy } from '@/modes/contracts';
import { normalizeAIInstruction } from './promptBuilder';
import { generateNewNames } from '@/lib/ai-service';

function getInstruction(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>).instruction;
  return typeof value === 'string' ? value : '';
}

export const AIStrategy: ModeStrategy = {
  id: 'ai',
  meta: {
    label: 'AI',
    icon: SparklesIcon,
    description: '始终使用 AI 生成文件名',
    ui: {
      inputMinHeightClass: 'min-h-[44px]',
      showHistoryDrawer: true,
      submitTitle: '生成'
    }
  },
  createInitialPayload: () => ({ instruction: '' }),
  getSubmitToken: (payload) => normalizeAIInstruction(getInstruction(payload)),
  hydratePresetContent: (content) => ({ instruction: content }),
  validateSubmit: (payload) => {
    if (!normalizeAIInstruction(getInstruction(payload))) {
      return { valid: false, error: '请输入指令' };
    }
    return { valid: true };
  },
  execute: async (files: FileItem[], payload, context) => {
    const instruction = normalizeAIInstruction(getInstruction(payload));
    if (!instruction) return { type: 'list', files };

    const aiConfig = context.aiConfig;
    if (!aiConfig) {
      throw new Error('AI 配置缺失，请先在设置中配置 API 参数');
    }

    const names = await generateNewNames(
      files.map((file) => file.original),
      instruction,
      aiConfig
    );

    return {
      type: 'list',
      files: files.map((file, index) => ({
        ...file,
        renamed: names[index] ?? file.original,
        renameOrigin: 'ai'
      }))
    };
  },
  executeBatchChunk: async (files: FileItem[], payload, context, chunkMeta) => {
    const instruction = normalizeAIInstruction(getInstruction(payload));
    if (!instruction) return files;

    const aiConfig = context.aiConfig;
    if (!aiConfig) {
      throw new Error('AI 配置缺失，请先在设置中配置 API 参数');
    }

    const names = await generateNewNames(
      files.map((file) => file.original),
      instruction,
      aiConfig,
      {
        requestId: chunkMeta.requestId,
        startIndex: chunkMeta.startIndex,
        totalCount: context.batching?.totalFiles
      }
    );

    return files.map((file, index) => ({
      ...file,
      renamed: names[index] ?? file.original,
      renameOrigin: 'ai'
    }));
  }
};
