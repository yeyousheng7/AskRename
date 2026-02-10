import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import type { FileItem } from '@/types/file';
import EditorRow from '@/components/EditorRow';
import SortableItem from '@/components/SortableItem';

export type FileListProps = {
  files: FileItem[];
  highlightedIds: Set<string>;
  editingIndex: number | null;
  setEditingIndex: (next: number | null) => void;
  onRename: (id: string, newName: string) => void;
  onRevert: (index: number) => void;
  onRemove: (id: string) => void;
  reorderFiles: (oldIndex: number, newIndex: number) => void;
  onAfterReorder: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
};

export default function FileList({
  files,
  highlightedIds,
  editingIndex,
  setEditingIndex,
  onRename,
  onRevert,
  onRemove,
  reorderFiles,
  onAfterReorder,
  isLoading = false,
  isDisabled = false
}: FileListProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);

  const ids = useMemo(() => files.map((f) => f.id), [files]);
  const activeFile = useMemo(
    () => (activeId ? files.find((f) => f.id === activeId) : null),
    [activeId, files]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isDisabled) return;
      setActiveId(String(event.active.id));
    },
    [isDisabled]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isDisabled) {
        setActiveId(null);
        return;
      }

      const { active, over } = event;
      setActiveId(null);

      if (!over) return;
      if (active.id === over.id) return;

      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      reorderFiles(oldIndex, newIndex);
      onAfterReorder();
    },
    [ids, reorderFiles, onAfterReorder, isDisabled]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="min-h-full pb-32">
          {files.map((file, index) => (
            <SortableItem
              key={file.id}
              file={file}
              index={index}
              filesLength={files.length}
              editingIndex={editingIndex}
              setEditingIndex={setEditingIndex}
              onRename={onRename}
              onRevert={onRevert}
              onRemove={onRemove}
              isLoading={isLoading}
              isHighlighted={highlightedIds.has(file.id)}
              disabled={isDisabled}
            />
          ))}
        </div>
      </SortableContext>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay>
            {activeFile ? (
              <div className="opacity-90 shadow-2xl">
                <EditorRow
                  file={activeFile}
                  index={ids.indexOf(activeFile.id)}
                  filesLength={files.length}
                  editingIndex={editingIndex}
                  setEditingIndex={setEditingIndex}
                  onRename={onRename}
                  onRevert={onRevert}
                  onRemove={onRemove}
                  isLoading={isLoading}
                  isHighlighted={highlightedIds.has(activeFile.id)}
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
