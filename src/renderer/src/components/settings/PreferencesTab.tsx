import { useCallback } from 'react';

import { Input } from '@/components/ui/input';
import type { AISettings, BatchPolicy } from '@/hooks/useSettings';

const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';
const helpClass = 'text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-5';
const fieldGap = 'space-y-2';

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const v = Math.floor(Number(value));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

function getBatchPolicyLabel(policy: BatchPolicy): string {
  if (policy === 'off') return '关闭';
  if (policy === 'auto') return '自动（超阈值启用）';
  return '强制（始终分批）';
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

  const handleBatchThresholdChange = useCallback(
    (raw: string) => {
      const next = clampInt(raw === '' ? 1 : Number(raw), 1, 2000, settings.batchThreshold);
      updateSettings({ batchThreshold: next });
    },
    [settings.batchThreshold, updateSettings]
  );

  const batchEnabled = settings.batchPolicy !== 'off';

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">AI 批处理</div>
          <div className={helpClass}>仅作用于 AI 与智能模式。Regex 模式不使用分批执行。</div>
        </div>

        <div className={fieldGap}>
          <label className={labelClass}>分批策略</label>
          <select
            value={settings.batchPolicy}
            onChange={(e) => updateSettings({ batchPolicy: e.target.value as BatchPolicy })}
            className="h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100"
          >
            <option value="off">关闭</option>
            <option value="auto">自动（超阈值启用）</option>
            <option value="force">强制（始终分批）</option>
          </select>
          <div className={helpClass}>当前：{getBatchPolicyLabel(settings.batchPolicy)}</div>
        </div>

        <div className={fieldGap}>
          <label className={labelClass}>分批阈值</label>
          <Input
            type="number"
            min={1}
            max={2000}
            step={1}
            disabled={!batchEnabled}
            value={String(settings.batchThreshold)}
            onChange={(e) => handleBatchThresholdChange(e.target.value)}
          />
          <div className={helpClass}>
            仅在“自动”策略下生效：文件总数达到该值时启用分批。关闭策略时不可编辑。
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
              每个批次包含的文件数量。越大请求次数越少，但单批失败重试成本更高。
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
            <div className={helpClass}>同时进行的批次数量。越大越快，但更容易触发限流。</div>
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
                保护文件扩展名
              </div>
              <div className={helpClass}>
                如果文件存在扩展名，锁定扩展名，仅对 AI 自动建议生效。
              </div>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
