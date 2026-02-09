import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// 预设类型定义
// ============================================================================

export interface Preset {
  id: string;
  name: string;
  content: string;
  type: 'regex' | 'prompt';
}

const STORAGE_KEY = 'app-presets';
const PRESETS_EVENT = 'app-presets-changed';

// ============================================================================
// 默认预设（系统预置）
// ============================================================================

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'sys-remove-spaces',
    name: '移除空格',
    content: '\\s+',
    type: 'regex'
  },
  {
    id: 'sys-lowercase',
    name: '转为小写',
    content: '将文件名转为小写',
    type: 'prompt'
  },
  {
    id: 'sys-date-format',
    name: '规范日期格式',
    content: '从文件名中提取日期并格式化为 YYYY-MM-DD 格式',
    type: 'prompt'
  },
  {
    id: 'sys-snake-case',
    name: '蛇形命名',
    content: '将文件名转为 snake_case 格式',
    type: 'prompt'
  }
];

// ============================================================================
// 工具函数
// ============================================================================

function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseStoredPresets(raw: string | null): Preset[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // 验证每个预设的结构
    const valid = parsed.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.content === 'string' &&
        (item.type === 'regex' || item.type === 'prompt')
    );

    if (!valid) return null;
    return parsed as Preset[];
  } catch {
    return null;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function usePresets(): {
  presets: Preset[];
  addPreset: (preset: Omit<Preset, 'id'>) => void;
  updatePreset: (id: string, updates: Partial<Omit<Preset, 'id'>>) => void;
  removePreset: (id: string) => void;
} {
  const [presets, setPresets] = useState<Preset[]>(() => {
    const stored = parseStoredPresets(localStorage.getItem(STORAGE_KEY));
    return stored ?? DEFAULT_PRESETS;
  });

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const handler = (e: Event): void => {
      const evt = e as CustomEvent<Preset[]>;
      if (!Array.isArray(evt.detail)) return;
      setPresets(evt.detail);
    };
    window.addEventListener(PRESETS_EVENT, handler);
    return () => window.removeEventListener(PRESETS_EVENT, handler);
  }, []);

  const addPreset = useCallback((preset: Omit<Preset, 'id'>) => {
    setPresets((prev) => {
      const next = [...prev, { ...preset, id: generateId() }];
      window.dispatchEvent(new CustomEvent<Preset[]>(PRESETS_EVENT, { detail: next }));
      return next;
    });
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Omit<Preset, 'id'>>) => {
    setPresets((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      window.dispatchEvent(new CustomEvent<Preset[]>(PRESETS_EVENT, { detail: next }));
      return next;
    });
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      window.dispatchEvent(new CustomEvent<Preset[]>(PRESETS_EVENT, { detail: next }));
      return next;
    });
  }, []);

  return { presets, addPreset, updatePreset, removePreset };
}
