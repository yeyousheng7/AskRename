import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PRESET_KINDS, type Preset, type PresetKind } from '@/types/preset';

const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';
const fieldGap = 'space-y-2';

const PRESET_KIND_LABELS: Record<PresetKind, string> = {
  instruction: '指令',
  regex: '正则'
};

export function PresetEditorDialog({
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
  const [kind, setKind] = useState<PresetKind>(preset?.kind ?? 'instruction');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (): void => {
    if (!name.trim() || !content.trim()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSave({ name: name.trim(), content: content.trim(), kind });
  };

  const selectClass = cn(
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'dark:bg-input/30'
  );

  const contentPlaceholder =
    kind === 'regex' ? '请输入查找规则（正则表达式）...' : '请输入指令（Prompt）...';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onCancel} />
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
              value={kind}
              onChange={(e) => setKind(e.target.value as PresetKind)}
            >
              {PRESET_KINDS.map((presetKind) => (
                <option key={presetKind} value={presetKind}>
                  {PRESET_KIND_LABELS[presetKind]}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldGap}>
            <label className={labelClass}>内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={contentPlaceholder}
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
            disabled={isSubmitting || !name.trim() || !content.trim()}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
