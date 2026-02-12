import { Zap } from 'lucide-react';
import type { FileItem } from '@/types/file';
import type { RenameStrategy } from '@renderer/types/types';
import { SmartInput, type SmartParams } from './SmartInput';

export const SmartStrategy: RenameStrategy<
  SmartParams & { runner?: (instruction: string) => Promise<void> }
> = {
  id: 'smart',
  meta: {
    label: '智能',
    icon: Zap,
    description: 'AI 自动判断使用正则或完整生成',
    ui: {
      inputMinHeightClass: 'min-h-[44px]',
      showHistoryDrawer: true,
      submitTitle: '生成'
    }
  },
  InputComponent: SmartInput,
  validate: (params) => {
    if (!params.instruction.trim()) {
      return { valid: false, error: '请输入指令' };
    }
    return { valid: true };
  },
  execute: async (files: FileItem[], params) => {
    if (params.runner) {
      await params.runner(params.instruction.trim());
    }
    return files;
  }
};
