import { useCallback, useEffect, useMemo, useState } from 'react';

export type BatchPolicy = 'off' | 'auto' | 'force';

export interface AISettings {
  provider: 'openai' | 'deepseek' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;

  // Batch runtime controls.
  batchSize: number;
  concurrencyLimit: number;
  batchPolicy: BatchPolicy;
  batchThreshold: number;

  // Keep original extension for AI-generated names.
  lockSuffix: boolean;
}

const STORAGE_KEY = 'app-settings';

type StoredPublicSettings = Omit<AISettings, 'apiKey'>;

type LegacyStoredSettings = {
  provider: AISettings['provider'];
  baseUrl: string;
  model: string;
  batchSize?: number;
  concurrencyLimit?: number;
  enableBatchProcessing?: boolean;
  lockSuffix?: boolean;
};

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  batchSize: 10,
  concurrencyLimit: 3,
  batchPolicy: 'off',
  batchThreshold: 80,
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

function isBatchPolicy(value: unknown): value is BatchPolicy {
  return value === 'off' || value === 'auto' || value === 'force';
}

function parseStoredSettings(raw: string | null): StoredPublicSettings | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const base = parsed as Partial<Record<keyof StoredPublicSettings, unknown>>;
    if (!isProvider(base.provider)) return null;
    if (typeof base.baseUrl !== 'string') return null;
    if (typeof base.model !== 'string') return null;

    const legacy = parsed as LegacyStoredSettings;

    const batchSize =
      typeof base.batchSize === 'number' ? base.batchSize : DEFAULT_SETTINGS.batchSize;
    const concurrencyLimit =
      typeof base.concurrencyLimit === 'number'
        ? base.concurrencyLimit
        : DEFAULT_SETTINGS.concurrencyLimit;

    const batchPolicy = isBatchPolicy(base.batchPolicy)
      ? base.batchPolicy
      : typeof legacy.enableBatchProcessing === 'boolean'
        ? legacy.enableBatchProcessing
          ? 'auto'
          : 'off'
        : DEFAULT_SETTINGS.batchPolicy;

    const batchThreshold =
      typeof base.batchThreshold === 'number'
        ? base.batchThreshold
        : DEFAULT_SETTINGS.batchThreshold;

    const lockSuffix =
      typeof base.lockSuffix === 'boolean' ? base.lockSuffix : DEFAULT_SETTINGS.lockSuffix;

    return {
      provider: base.provider,
      baseUrl: base.baseUrl,
      model: base.model,
      batchSize,
      concurrencyLimit,
      batchPolicy,
      batchThreshold,
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
      batchPolicy: settings.batchPolicy,
      batchThreshold: settings.batchThreshold,
      lockSuffix: settings.lockSuffix
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSettings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AISettings>) => {
    setSettings((prev) => {
      let next: AISettings = { ...prev, ...partial };

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
      if (partial.batchThreshold !== undefined) {
        const v = Math.floor(Number(partial.batchThreshold));
        next.batchThreshold = Number.isFinite(v)
          ? Math.min(Math.max(v, 1), 2000)
          : prev.batchThreshold;
      }
      if (partial.batchPolicy !== undefined && isBatchPolicy(partial.batchPolicy)) {
        next.batchPolicy = partial.batchPolicy;
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
