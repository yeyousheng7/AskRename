import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { FileItem } from '@/types/file';
import { generateNewNames, getConfigFromEnv } from '@/lib/ai-service';

// Electron 扩展的 File 类型（包含 path 属性）
interface ElectronFile extends File {
  path: string;
}

// Hook 返回类型
export type UseFileStoreResult = {
  files: FileItem[];
  isRenaming: boolean;
  addFiles: (newFiles: FileItem[]) => void;
  updateFileName: (id: string, newName: string) => void;
  batchUpdateFileNames: (newNames: string[]) => void;
  clearFiles: () => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  startRenaming: (instruction: string) => Promise<void>;
  stopRenaming: () => void;
};

export function useFileStore(): UseFileStoreResult {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addFiles = useCallback((newFiles: FileItem[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const updateFileName = useCallback((id: string, newName: string) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, renamed: newName } : file)));
  }, []);

  const batchUpdateFileNames = useCallback((newNames: string[]) => {
    setFiles((prev) =>
      prev.map((file, index) => ({
        ...file,
        renamed: newNames[index] ?? file.renamed
      }))
    );
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

  const stopRenaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRenaming(false);
  }, []);

  const startRenaming = useCallback(
    async (instruction: string) => {
      // 检查 API Key
      const config = getConfigFromEnv();
      if (!config.apiKey) {
        console.warn('API Key 未配置，请在 .env 文件中设置 VITE_AI_API_KEY');
        throw new Error('API Key 未配置');
      }

      if (files.length === 0) {
        console.warn('没有文件可重命名');
        return;
      }

      if (!instruction.trim()) {
        console.warn('请输入重命名指令');
        throw new Error('请输入重命名指令');
      }

      // 创建 AbortController 用于取消操作
      abortControllerRef.current = new AbortController();

      setIsRenaming(true);

      try {
        const originalNames = files.map((f) => f.original);
        const newNames = await generateNewNames(originalNames, instruction);

        // 检查是否被中断
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        batchUpdateFileNames(newNames);
      } finally {
        setIsRenaming(false);
        abortControllerRef.current = null;
      }
    },
    [files, batchUpdateFileNames]
  );

  return {
    files,
    isRenaming,
    addFiles,
    updateFileName,
    batchUpdateFileNames,
    clearFiles,
    handleDrop,
    startRenaming,
    stopRenaming
  };
}
