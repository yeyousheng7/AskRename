import { useCallback, useMemo, useState } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AISettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { electronApi } from '@/lib/electron-api';
import type { ChatMessage } from '@shared/ipc-types';

const PROVIDER_LABELS: Record<AISettings['provider'], string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  custom: 'Custom'
};

const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';
const helpClass = 'text-xs text-zinc-500 dark:text-zinc-400 mt-1.5';
const fieldGap = 'space-y-2';

export function ApiTab({
  settings,
  updateSettings
}: {
  settings: AISettings;
  updateSettings: (partial: Partial<AISettings>) => void;
}): React.JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const apiKeyPlaceholder = useMemo(() => {
    if (settings.provider === 'ollama') return 'Ollama 通常不需要 API Key';
    return '请输入 API Key';
  }, [settings.provider]);

  const selectClass = cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'dark:bg-input/30'
  );

  const handleTest = useCallback(async (): Promise<void> => {
    setSaveError(null);
    setTestStatus(null);

    const baseURL = settings.baseUrl.trim();
    const model = settings.model.trim();
    if (!baseURL) {
      setTestStatus({ type: 'error', message: '请先填写 Base URL' });
      return;
    }
    if (!model) {
      setTestStatus({ type: 'error', message: '请先填写模型名称' });
      return;
    }
    if (settings.provider !== 'ollama' && !settings.apiKey.trim()) {
      setTestStatus({ type: 'error', message: '请先填写 API Key' });
      return;
    }

    setIsTesting(true);
    try {
      const messages: ChatMessage[] = [{ role: 'user', content: 'ping' }];
      const resp = await electronApi.askAI(
        {
          provider: settings.provider,
          apiKey: settings.apiKey,
          baseURL,
          model,
          jsonMode: true,
          maxTokens: 64
        },
        messages
      );
      if (resp.success) {
        setTestStatus({ type: 'success', message: '连接成功' });
      } else {
        setTestStatus({ type: 'error', message: resp.error || '连接失败' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败';
      setTestStatus({ type: 'error', message: msg });
    } finally {
      setIsTesting(false);
    }
  }, [settings]);

  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      if (settings.provider !== 'ollama') {
        await electronApi.setApiKey(settings.provider, settings.apiKey);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [settings.provider, settings.apiKey]);

  return (
    <div className="space-y-6">
      <div className={fieldGap}>
        <label className={labelClass}>供应商</label>
        <select
          className={selectClass}
          value={settings.provider}
          onChange={(e) => updateSettings({ provider: e.target.value as AISettings['provider'] })}
        >
          {Object.keys(PROVIDER_LABELS).map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p as AISettings['provider']]}
            </option>
          ))}
        </select>
      </div>

      <div className={fieldGap}>
        <label className={labelClass}>API Key</label>
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={settings.apiKey}
            placeholder={apiKeyPlaceholder}
            onChange={(e) => updateSettings({ apiKey: e.target.value })}
            disabled={settings.provider === 'ollama'}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            disabled={settings.provider === 'ollama'}
            title={showApiKey ? '隐藏' : '显示'}
          >
            {showApiKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
        <div className={helpClass}>Key 仅保存在本地。</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={fieldGap}>
          <label className={labelClass}>Base URL</label>
          <Input
            type="text"
            value={settings.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => updateSettings({ baseUrl: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className={fieldGap}>
          <label className={labelClass}>模型名称</label>
          <Input
            type="text"
            value={settings.model}
            placeholder="gpt-4o"
            onChange={(e) => updateSettings({ model: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="min-h-4 text-xs">
          {saveError ? (
            <span className="text-red-600 dark:text-red-400">{saveError}</span>
          ) : testStatus ? (
            <span
              className={
                testStatus.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {testStatus.message}
            </span>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={isSaving || isTesting}
            title="测试连接会消耗少量 Token"
            onClick={handleTest}
          >
            {isTesting ? '测试中...' : '测试连接'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}
