import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import EditorRow, { type EditorRowProps } from '@/components/EditorRow';
import { cn } from '@/lib/utils';

export type SortableItemProps = EditorRowProps & {
  disabled?: boolean;
};

export default function SortableItem({
  file,
  index,
  filesLength,
  editingIndex,
  setEditingIndex,
  onRename,
  onRevert,
  onRemove,
  isLoading,
  isHighlighted,
  disabled = false
}: SortableItemProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: file.id, disabled });

  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition
    }),
    [transform, transition]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'opacity-70 shadow-lg')}
      data-dnd-dragging={isDragging ? 'true' : 'false'}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={cn(
          'absolute left-1 top-1.5 z-10',
          'inline-flex h-6 w-6 items-center justify-center rounded',
          'text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100',
          'dark:text-zinc-600 dark:hover:text-zinc-400 dark:hover:bg-zinc-900/60',
          'cursor-grab active:cursor-grabbing touch-none select-none',
          disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
        )}
        aria-label="Drag to reorder"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <EditorRow
        file={file}
        index={index}
        filesLength={filesLength}
        editingIndex={editingIndex}
        setEditingIndex={setEditingIndex}
        onRename={onRename}
        onRevert={onRevert}
        onRemove={onRemove}
        isLoading={isLoading}
        isHighlighted={isHighlighted}
      />
    </div>
  );
}
