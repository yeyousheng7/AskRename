import type { LucideIcon } from 'lucide-react';
import { Hash, Scissors, ArrowDown, FileCode, Languages, Calendar } from 'lucide-react';
import { splitFileName } from '@/lib/filename';

// ============================================================================
// 快捷指令类型定义
// ============================================================================

export type QuickAction =
  | {
      type: 'rule';
      label: string;
      icon: LucideIcon;
      handler: (name: string, index: number) => string;
    }
  | { type: 'ai'; label: string; icon: LucideIcon; prompt: string };

// ============================================================================
// 快捷指令列表
// ============================================================================

export const QUICK_ACTIONS: QuickAction[] = [
  // === 规则类：直接转换 ===
  {
    type: 'rule',
    label: '添加序号',
    icon: Hash,
    handler: (name: string, index: number) => {
      const { base, ext } = splitFileName(name);
      const seq = String(index + 1).padStart(3, '0');
      return `${base}_${seq}${ext}`;
    }
  },
  {
    type: 'rule',
    label: '移除空格',
    icon: Scissors,
    handler: (name: string) => name.replace(/\s+/g, '')
  },
  {
    type: 'rule',
    label: '转为小写',
    icon: ArrowDown,
    handler: (name: string) => name.toLowerCase()
  },

  // === AI 类：需要调用 AI 处理 ===
  {
    type: 'ai',
    label: '蛇形命名',
    icon: FileCode,
    prompt: '转为 snake_case 格式'
  },
  {
    type: 'ai',
    label: '翻译中文',
    icon: Languages,
    prompt: '将文件名翻译为简洁的中文'
  },
  {
    type: 'ai',
    label: '规范日期',
    icon: Calendar,
    prompt: '从文件名中提取日期并格式化为 YYYY-MM-DD 格式'
  }
];
