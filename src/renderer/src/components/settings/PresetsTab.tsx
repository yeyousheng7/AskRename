import { useCallback, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePresets } from '@/hooks/usePresets';
import type { Preset } from '@/types/preset';
import { PresetEditorDialog } from '@/components/settings/PresetEditorDialog';
import { PresetItem } from '@/components/settings/PresetItem';

export function PresetsTab(): React.JSX.Element {
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

  const handleCancel = useCallback(() => {
    setEditingPreset(null);
    setIsCreating(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-1">
        {presets.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">暂无预设</div>
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
        <PresetEditorDialog preset={editingPreset} onSave={handleSave} onCancel={handleCancel} />
      )}
    </div>
  );
}
