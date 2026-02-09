import { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeIcon, EyeOffIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AISettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@shared/ipc-types';

const PROVIDER_LABELS: Record<AISettings['provider'], string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  custom: 'Custom'
};

export function SettingsDialog({
  open,
  onClose,
  settings,
  updateSettings
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  updateSettings: (partial: Partial<AISettings>) => void;
}): React.JSX.Element | null {
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleClose = useCallback(() => {
    setShowApiKey(false);
    setSaveError(null);
    setTestStatus(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  const apiKeyPlaceholder = useMemo(() => {
    if (settings.provider === 'ollama') return 'Ollama 通常不需要 API Key';
    return '请输入 API Key';
  }, [settings.provider]);

  if (!open) return null;

  const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300';
  const helpClass = 'text-xs text-zinc-500 dark:text-zinc-400';
  const fieldGap = 'space-y-2';

  const selectClass = cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'dark:bg-input/30'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI 模型配置"
        className="relative z-10 w-[min(520px,calc(100vw-2rem))] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              AI 模型配置
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              配置不同的 AI 服务供应商与模型
            </div>
          </div>

          <Button size="icon" variant="ghost" onClick={handleClose} title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-5 space-y-6">
          <div className={fieldGap}>
            <label className={labelClass}>供应商</label>
            <select
              className={selectClass}
              value={settings.provider}
              onChange={async (e) => {
                setSaveError(null);
                setTestStatus(null);
                const provider = e.target.value as AISettings['provider'];
                updateSettings({ provider });

                if (provider === 'ollama') {
                  updateSettings({ apiKey: '' });
                  return;
                }

                try {
                  const saved = await window.api.getApiKey(provider);
                  updateSettings({ apiKey: saved || '' });
                } catch (err) {
                  console.error('Failed to load api key:', err);
                }
              }}
            >
              {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <div className={helpClass}>切换供应商会自动填充 Base URL 和模型名称（Custom 除外）</div>
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>API Key</label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                placeholder={apiKeyPlaceholder}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                onClick={() => setShowApiKey((v) => !v)}
                title={showApiKey ? '隐藏' : '显示'}
              >
                {showApiKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>Base URL</label>
            <Input
              type="text"
              value={settings.baseUrl}
              placeholder="例如 https://api.openai.com/v1"
              onChange={(e) => updateSettings({ baseUrl: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>模型名称</label>
            <Input
              type="text"
              value={settings.model}
              placeholder="例如 gpt-4o"
              onChange={(e) => updateSettings({ model: e.target.value })}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 px-5 py-4 bg-zinc-50 dark:bg-zinc-900/40">
          <div className="mr-auto min-h-4 text-xs">
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

          <Button
            variant="secondary"
            disabled={isSaving || isTesting}
            onClick={async () => {
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

              setIsTesting(true);
              try {
                let apiKeyToUse = settings.apiKey.trim();
                if (settings.provider !== 'ollama' && !apiKeyToUse) {
                  apiKeyToUse = ((await window.api.getApiKey(settings.provider)) || '').trim();
                }
                if (settings.provider !== 'ollama' && !apiKeyToUse) {
                  setTestStatus({ type: 'error', message: '请先配置 API Key' });
                  return;
                }

                const messages: ChatMessage[] = [
                  {
                    role: 'system',
                    content: 'You are a connectivity test endpoint. Reply with "ok".'
                  },
                  { role: 'user', content: 'ok' }
                ];

                const resp = await window.api.askAI(
                  {
                    provider: settings.provider,
                    apiKey: apiKeyToUse,
                    baseURL,
                    model,
                    jsonMode: false,
                    maxTokens: 8
                  },
                  messages
                );

                if (!resp.success) {
                  setTestStatus({ type: 'error', message: resp.error || '连接失败' });
                  return;
                }

                setTestStatus({ type: 'success', message: '连接成功' });
              } catch (err) {
                const message = err instanceof Error ? err.message : '连接失败';
                setTestStatus({ type: 'error', message });
              } finally {
                setIsTesting(false);
              }
            }}
          >
            {isTesting ? '测试中...' : '测试连接'}
          </Button>
          <Button
            onClick={async () => {
              setSaveError(null);
              setTestStatus(null);
              setIsSaving(true);
              try {
                if (settings.provider !== 'ollama') {
                  await window.api.setApiKey(settings.provider, settings.apiKey);
                }
                updateSettings({ apiKey: '' });
                handleClose();
              } catch (err) {
                const message = err instanceof Error ? err.message : '保存失败';
                setSaveError(message);
              } finally {
                setIsSaving(false);
              }
            }}
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
