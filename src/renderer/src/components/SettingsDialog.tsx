import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EyeIcon,
  EyeOffIcon,
  XIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  SettingsIcon,
  ListIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AISettings } from '@/hooks/useSettings';
import { usePresets, type Preset } from '@/hooks/usePresets';
import { cn } from '@/lib/utils';
import { electronApi } from '@/lib/electron-api';
import type { ChatMessage } from '@shared/ipc-types';

// ============================================================================
// Constants
// ============================================================================

const PROVIDER_LABELS: Record<AISettings['provider'], string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  custom: 'Custom'
};

type TabId = 'api' | 'presets';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'api', label: 'API 配置', icon: <SettingsIcon className="h-4 w-4" /> },
  { id: 'presets', label: '预设管理', icon: <ListIcon className="h-4 w-4" /> }
];

// ============================================================================
// Styles
// ============================================================================

const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';
const helpClass = 'text-xs text-zinc-500 dark:text-zinc-400 mt-1.5';
const fieldGap = 'space-y-2';

// ============================================================================
// Sub-components
// ============================================================================

function PresetEditor({
  preset,
  onSave,
  onCancel
}: {
  preset: Preset | null;
  onSave: (data: Omit<Preset, 'id'>) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(preset?.name ?? '');
  const [content, setContent] = useState(preset?.content ?? '');
  const [type, setType] = useState<'regex' | 'prompt'>(preset?.type ?? 'prompt');

  const handleSubmit = (): void => {
    if (!name.trim() || !content.trim()) return;
    onSave({ name: name.trim(), content: content.trim(), type });
  };

  const selectClass = cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'dark:bg-input/30'
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div className="relative z-10 w-[min(400px,calc(100vw-2rem))] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {preset ? '编辑预设' : '新建预设'}
          </span>
          <Button size="icon" variant="ghost" onClick={onCancel} className="h-7 w-7">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className={fieldGap}>
            <label className={labelClass}>名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="预设名称"
              autoFocus
            />
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>类型</label>
            <select
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value as 'regex' | 'prompt')}
            >
              <option value="prompt">AI 提示词</option>
              <option value="regex">正则表达式</option>
            </select>
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === 'regex' ? '正则表达式模式' : 'AI 提示词内容'}
              className={cn(
                'w-full h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none resize-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'dark:bg-input/30'
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !content.trim()}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresetItem({
  preset,
  onEdit,
  onDelete
}: {
  preset: Preset;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const isSystem = preset.id.startsWith('sys-');
  const typeLabel = preset.type === 'regex' ? '正则' : 'AI';
  const truncatedContent =
    preset.content.length > 40 ? preset.content.slice(0, 40) + '…' : preset.content;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
        'border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {preset.name}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded',
              preset.type === 'regex'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
            )}
          >
            {typeLabel}
          </span>
          {isSystem && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              系统
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
          {truncatedContent}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          title="编辑"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
        {!isSystem && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
            title="删除"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PresetsTab(): React.JSX.Element {
  const { presets, addPreset, updatePreset, removePreset } = usePresets();
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSave = (data: Omit<Preset, 'id'>): void => {
    if (editingPreset) {
      updatePreset(editingPreset.id, data);
      setEditingPreset(null);
    } else {
      addPreset(data);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-1">
        {presets.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
            暂无预设
          </div>
        ) : (
          presets.map((preset) => (
            <PresetItem
              key={preset.id}
              preset={preset}
              onEdit={() => setEditingPreset(preset)}
              onDelete={() => removePreset(preset.id)}
            />
          ))
        )}
      </div>

      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
        <Button
          onClick={() => setIsCreating(true)}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          新建预设
        </Button>
      </div>

      {(isCreating || editingPreset) && (
        <PresetEditor
          preset={editingPreset}
          onSave={handleSave}
          onCancel={() => {
            setEditingPreset(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

function ApiTab({
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

  const handleTest = async (): Promise<void> => {
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
        apiKeyToUse = ((await electronApi.getApiKey(settings.provider)) || '').trim();
      }
      if (settings.provider !== 'ollama' && !apiKeyToUse) {
        setTestStatus({ type: 'error', message: '请先配置 API Key' });
        return;
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a connectivity test endpoint. Reply with "ok".' },
        { role: 'user', content: 'ok' }
      ];

      const resp = await electronApi.askAI(
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
  };

  const handleSave = async (): Promise<void> => {
    setSaveError(null);
    setTestStatus(null);
    setIsSaving(true);
    try {
      if (settings.provider !== 'ollama') {
        await electronApi.setApiKey(settings.provider, settings.apiKey);
      }
      updateSettings({ apiKey: '' });
      setTestStatus({ type: 'success', message: '已保存' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 供应商选择 */}
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
              const saved = await electronApi.getApiKey(provider);
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

      {/* API Key */}
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

      {/* Base URL & 模型名称 */}
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

      {/* Status & Actions */}
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

// ============================================================================
// Main Component
// ============================================================================

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
  const [activeTab, setActiveTab] = useState<TabId>('api');

  const handleClose = useCallback(() => {
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

  if (!open) return null;

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
        aria-label="设置"
        className="relative z-10 w-[min(600px,calc(100vw-2rem))] h-[min(500px,calc(100vh-4rem))] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 flex-shrink-0">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">设置</div>
          <Button size="icon" variant="ghost" onClick={handleClose} title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Body with Tabs */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Tabs */}
          <div className="w-36 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 py-2 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'api' && <ApiTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'presets' && <PresetsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
