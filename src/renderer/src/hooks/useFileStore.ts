import { useCallback, useState, type DragEvent } from 'react';
import type { FileItem } from '@/types/file';

// Electron 扩展的 File 类型（包含 path 属性）
interface ElectronFile extends File {
  path: string;
}

// 文件数据类型
export type UseFileStoreResult = {
  files: FileItem[];
  addFiles: (newFiles: FileItem[]) => void;
  updateFileName: (id: string, newName: string) => void;
  clearFiles: () => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
};

export function useFileStore(): UseFileStoreResult {
  const [files, setFiles] = useState<FileItem[]>([]);

  const addFiles = useCallback((newFiles: FileItem[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const updateFileName = useCallback((id: string, newName: string) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, renamed: newName } : file)));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = Array.from(e.dataTransfer.files);

      const newFiles: FileItem[] = droppedFiles
        .filter((file) => file.size > 0)
        .map((file) => {
          const electronFile = file as ElectronFile;
          return {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            original: file.name,
            renamed: file.name,
            path: electronFile.path || file.name
          };
        });

      addFiles(newFiles);
    },
    [addFiles]
  );

  return { files, addFiles, updateFileName, clearFiles, handleDrop };
}
