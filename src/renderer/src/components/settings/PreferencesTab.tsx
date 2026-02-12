import { useCallback } from 'react';

import { Input } from '@/components/ui/input';
import type { AISettings } from '@/hooks/useSettings';

const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';
const helpClass = 'text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-5';
const fieldGap = 'space-y-2';

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const v = Math.floor(Number(value));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

export function PreferencesTab({
  settings,
  updateSettings
}: {
  settings: AISettings;
  updateSettings: (partial: Partial<AISettings>) => void;
}): React.JSX.Element {
  const handleBatchSizeChange = useCallback(
    (raw: string) => {
      // 空输入时先回退到最小值，避免把 settings 置为 NaN
      const next = clampInt(raw === '' ? 1 : Number(raw), 1, 50, settings.batchSize);
      updateSettings({ batchSize: next });
    },
    [settings.batchSize, updateSettings]
  );

  const handleConcurrencyChange = useCallback(
    (raw: string) => {
      const next = clampInt(raw === '' ? 1 : Number(raw), 1, 10, settings.concurrencyLimit);
      updateSettings({ concurrencyLimit: next });
    },
    [settings.concurrencyLimit, updateSettings]
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">AI 批处理</div>
          <div className={helpClass}>
            这些设置仅影响“文件数量较大时”的 AI 批量处理（会拆分为多个批次并发请求）。
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={fieldGap}>
            <label className={labelClass}>批次大小</label>
            <Input
              type="number"
              min={1}
              max={50}
              step={1}
              value={String(settings.batchSize)}
              onChange={(e) => handleBatchSizeChange(e.target.value)}
            />
            <div className={helpClass}>
              每个批次包含的文件数。越大越省请求次数，但单次耗时/失败重试成本更高。
            </div>
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>并发数量</label>
            <Input
              type="number"
              min={1}
              max={10}
              step={1}
              value={String(settings.concurrencyLimit)}
              onChange={(e) => handleConcurrencyChange(e.target.value)}
            />
            <div className={helpClass}>
              同时进行的批次数量。越大越快，但更容易触发限流或占用更多资源。
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">重命名行为</div>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.lockSuffix}
              onChange={(e) => updateSettings({ lockSuffix: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 accent-zinc-900 dark:accent-zinc-100"
            />
            <span>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                锁定文件后缀（扩展名）
              </div>
              <div className={helpClass}>
                开启时：新文件名无扩展名时自动补全原扩展名（例：photo.jpg → photo_1.jpg）。
              </div>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
