import { useCallback, useEffect, useMemo, useState } from 'react';

export interface AISettings {
  provider: 'openai' | 'deepseek' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;

  /** AI 批处理：每批处理多少个文件（文件量较大时使用） */
  batchSize: number;
  /** AI 批处理：并发批次数量上限 */
  concurrencyLimit: number;

  /** 后缀锁定：当新文件名没有扩展名时，自动补全原扩展名 */
  lockSuffix: boolean;
}

const STORAGE_KEY = 'app-settings';

type StoredPublicSettings = Omit<AISettings, 'apiKey'>;

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  batchSize: 10,
  concurrencyLimit: 3,
  lockSuffix: true
};

const PROVIDER_PRESETS: Record<AISettings['provider'], { baseUrl: string; model: string } | null> =
  {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
    custom: null
  };

function isProvider(value: unknown): value is AISettings['provider'] {
  return value === 'openai' || value === 'deepseek' || value === 'ollama' || value === 'custom';
}

function parseStoredSettings(raw: string | null): StoredPublicSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Partial<Record<keyof StoredPublicSettings, unknown>>;

    // 旧版本仅包含 provider/baseUrl/model（保持兼容）
    if (!isProvider(obj.provider)) return null;
    if (typeof obj.baseUrl !== 'string') return null;
    if (typeof obj.model !== 'string') return null;

    const batchSize =
      typeof obj.batchSize === 'number' ? obj.batchSize : DEFAULT_SETTINGS.batchSize;
    const concurrencyLimit =
      typeof obj.concurrencyLimit === 'number'
        ? obj.concurrencyLimit
        : DEFAULT_SETTINGS.concurrencyLimit;
    const lockSuffix =
      typeof obj.lockSuffix === 'boolean' ? obj.lockSuffix : DEFAULT_SETTINGS.lockSuffix;

    return {
      provider: obj.provider,
      baseUrl: obj.baseUrl,
      model: obj.model,
      batchSize,
      concurrencyLimit,
      lockSuffix
    };
  } catch {
    return null;
  }
}

export function useSettings(): {
  settings: AISettings;
  updateSettings: (partial: Partial<AISettings>) => void;
  providerPresets: typeof PROVIDER_PRESETS;
} {
  const [settings, setSettings] = useState<AISettings>(() => {
    const stored = parseStoredSettings(localStorage.getItem(STORAGE_KEY));
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const publicSettings: StoredPublicSettings = {
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      batchSize: settings.batchSize,
      concurrencyLimit: settings.concurrencyLimit,
      lockSuffix: settings.lockSuffix
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSettings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AISettings>) => {
    setSettings((prev) => {
      let next: AISettings = { ...prev, ...partial };

      // 归一化：避免 NaN / 非法范围
      if (partial.batchSize !== undefined) {
        const v = Math.floor(Number(partial.batchSize));
        next.batchSize = Number.isFinite(v) ? Math.min(Math.max(v, 1), 50) : prev.batchSize;
      }
      if (partial.concurrencyLimit !== undefined) {
        const v = Math.floor(Number(partial.concurrencyLimit));
        next.concurrencyLimit = Number.isFinite(v)
          ? Math.min(Math.max(v, 1), 10)
          : prev.concurrencyLimit;
      }
      if (partial.lockSuffix !== undefined) {
        next.lockSuffix = Boolean(partial.lockSuffix);
      }

      if (partial.provider && partial.provider !== prev.provider) {
        const preset = PROVIDER_PRESETS[partial.provider];
        if (preset) {
          next = { ...next, baseUrl: preset.baseUrl, model: preset.model };
        }
      }
      return next;
    });
  }, []);

  const providerPresets = useMemo(() => PROVIDER_PRESETS, []);

  return { settings, updateSettings, providerPresets };
}
