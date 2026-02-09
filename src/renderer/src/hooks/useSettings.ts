import { useCallback, useEffect, useMemo, useState } from 'react';

export interface AISettings {
  provider: 'openai' | 'deepseek' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY = 'app-settings';

type StoredPublicSettings = Omit<AISettings, 'apiKey'>;

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: ''
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

    if (!isProvider(obj.provider)) return null;
    if (typeof obj.baseUrl !== 'string') return null;
    if (typeof obj.model !== 'string') return null;

    return {
      provider: obj.provider,
      baseUrl: obj.baseUrl,
      model: obj.model
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
      model: settings.model
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publicSettings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AISettings>) => {
    setSettings((prev) => {
      let next: AISettings = { ...prev, ...partial };
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
