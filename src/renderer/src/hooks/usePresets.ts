import { useCallback, useSyncExternalStore } from 'react';
import type { Preset } from '@/types/preset';
import { isMode } from '@/types/mode';
import { getModeList } from '@/modes/registry';

const STORAGE_KEY = 'app-presets';
const modeList = getModeList();
const defaultRuleModeId =
  modeList.find((item) => item.meta.ui?.showHistoryDrawer === false)?.id ?? modeList[0]?.id ?? 'ai';

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'sys-remove-spaces',
    name: '移除空格',
    content: '\\s+',
    modeId: defaultRuleModeId
  },
  {
    id: 'sys-lowercase',
    name: '转为小写',
    content: '将文件名全部转为小写',
    modeId: 'ai'
  },
  {
    id: 'sys-date-format',
    name: '规范日期',
    content: '从文件名中提取日期并格式化为 YYYY-MM-DD 格式',
    modeId: 'ai'
  },
  {
    id: 'sys-snake-case',
    name: '蛇形命名',
    content: '转换为 snake_case 格式',
    modeId: 'ai'
  }
];

type Listener = () => void;

let presetsStore: Preset[] | null = null;
const listeners = new Set<Listener>();

function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPresetLike(value: unknown): value is Preset {
  if (!isRecord(value)) return false;
  if (!isMode(value.modeId)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.content === 'string' &&
    value.modeId.trim().length > 0
  );
}

function parseStoredPresets(raw: string | null): Preset[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every(isPresetLike)) return null;
    return parsed as Preset[];
  } catch {
    return null;
  }
}

function getStore(): Preset[] {
  if (presetsStore) return presetsStore;
  const stored = parseStoredPresets(localStorage.getItem(STORAGE_KEY));
  presetsStore = stored ?? DEFAULT_PRESETS;
  return presetsStore;
}

function emitChange(): void {
  for (const l of listeners) l();
}

function setStore(next: Preset[]): void {
  presetsStore = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitChange();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Preset[] {
  return getStore();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const parsed = parseStoredPresets(e.newValue);
    if (!parsed) return;
    presetsStore = parsed;
    emitChange();
  });
}

export function usePresets(): {
  presets: Preset[];
  addPreset: (preset: Omit<Preset, 'id'>) => void;
  updatePreset: (id: string, updates: Partial<Omit<Preset, 'id'>>) => void;
  removePreset: (id: string) => void;
} {
  const presets = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addPreset = useCallback((preset: Omit<Preset, 'id'>) => {
    const id = generateId();
    const next = [...getStore(), { ...preset, id }];
    setStore(next);
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Omit<Preset, 'id'>>) => {
    const next = getStore().map((p) => (p.id === id ? { ...p, ...updates } : p));
    setStore(next);
  }, []);

  const removePreset = useCallback((id: string) => {
    const next = getStore().filter((p) => p.id !== id);
    setStore(next);
  }, []);

  return { presets, addPreset, updatePreset, removePreset };
}
