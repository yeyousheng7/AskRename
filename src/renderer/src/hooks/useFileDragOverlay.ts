import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

function isFileDragEvent(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer?.types || []);
  return types.includes('Files');
}

export function useFileDragOverlay(onDropFiles: (e: DragEvent<HTMLDivElement>) => void): {
  isDragging: boolean;
  rootProps: {
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  };
} {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const resetDragging = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const onWindowDrop = (): void => resetDragging();
    const onWindowDragEnd = (): void => resetDragging();
    const onWindowDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) resetDragging();
    };

    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragend', onWindowDragEnd);
    window.addEventListener('dragleave', onWindowDragLeave as unknown as EventListener);
    return () => {
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragend', onWindowDragEnd);
      window.removeEventListener('dragleave', onWindowDragLeave as unknown as EventListener);
    };
  }, [resetDragging]);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFileDragEvent(e)) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFileDragEvent(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      resetDragging();
      onDropFiles(e);
    },
    [onDropFiles, resetDragging]
  );

  return { isDragging, rootProps: { onDrop, onDragOver, onDragEnter, onDragLeave } };
}
