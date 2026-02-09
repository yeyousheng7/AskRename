import { useCallback, useEffect, useState } from 'react';
import { ListIcon, SettingsIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AISettings } from '@/hooks/useSettings';
import { ApiTab } from '@/components/settings/ApiTab';
import { PresetsTab } from '@/components/settings/PresetsTab';
import type { SettingsTabId } from '@/types/settings';
import { cn } from '@/lib/utils';

const TABS: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'api', label: 'API 配置', icon: <SettingsIcon className="h-4 w-4" /> },
  { id: 'presets', label: '预设管理', icon: <ListIcon className="h-4 w-4" /> }
];

export function SettingsDialog({
  open,
  onClose,
  settings,
  updateSettings,
  forcedTab,
  onClearForcedTab
}: {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  updateSettings: (partial: Partial<AISettings>) => void;
  forcedTab?: SettingsTabId | null;
  onClearForcedTab?: () => void;
}): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('api');
  const effectiveTab = forcedTab ?? activeTab;

  const handleClose = useCallback(() => {
    onClearForcedTab?.();
    onClose();
  }, [onClearForcedTab, onClose]);

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
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 flex-shrink-0">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">设置</div>
          <Button size="icon" variant="ghost" onClick={handleClose} title="关闭">
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-36 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 py-2 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onClearForcedTab?.();
                  setActiveTab(tab.id);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors text-left',
                  effectiveTab === tab.id
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {effectiveTab === 'api' && (
              <ApiTab settings={settings} updateSettings={updateSettings} />
            )}
            {effectiveTab === 'presets' && <PresetsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
