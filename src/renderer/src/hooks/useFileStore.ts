import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { FileItem } from '@/types/file';
import { generateNewNames, getConfigFromEnv } from '@/lib/ai-service';

function isAbsolutePathLike(p: string): boolean {
  if (!p) return false;
  // Windows: C:\ or C:/, or UNC \\server\share
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)) return true;
  // POSIX: /home/...
  return p.startsWith('/');
}

function extractFilePathsFromDataTransfer(dt: DataTransfer): string[] {
  const uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
  const lines = uriList
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const paths: string[] = [];

  for (const line of lines) {
    if (!line.toLowerCase().startsWith('file:')) continue;
    try {
      const url = new URL(line);
      const host = url.host;
      const pathname = decodeURIComponent(url.pathname);

      // Windows: file:///C:/Users/... -> C:\Users\...
      if (/^\/[a-zA-Z]:\//.test(pathname)) {
        paths.push(pathname.slice(1).replaceAll('/', '\\'));
        continue;
      }

      // Windows UNC: file://server/share/path -> \\server\share\path
      if (host) {
        const unc = `\\\\${host}${pathname}`.replaceAll('/', '\\');
        paths.push(unc);
        continue;
      }

      // POSIX: file:///home/... -> /home/...
      paths.push(pathname);
    } catch {
      // ignore parse failures
    }
  }

  return paths.filter(isAbsolutePathLike);
}

function getElectronFilePath(file: File): string {
  try {
    if (window.api && typeof window.api.getPathForFile === 'function') {
      return (window.api.getPathForFile(file) || '').trim();
    }
  } catch {
    // ignore
  }

  const legacy = file as unknown as { path?: string };
  return (legacy.path || '').trim();
}

type RenamedItem = { oldPath: string; newPath: string };

// Hook 返回类型
export type UseFileStoreResult = {
  files: FileItem[];
  isRenaming: boolean;
  isApplying: boolean;
  hasChanges: boolean;
  addFiles: (newFiles: FileItem[]) => void;
  updateFileName: (id: string, newName: string) => void;
  batchUpdateFileNames: (newNames: string[]) => void;
  clearFiles: () => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  startRenaming: (instruction: string) => Promise<void>;
  stopRenaming: () => void;
  applyRename: () => Promise<{
    successCount: number;
    errors: { path: string; error: string }[];
    renamed?: RenamedItem[];
  }>;
  resetAfterApply: (renamed?: RenamedItem[]) => void;
};

export function useFileStore(): UseFileStoreResult {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 检查是否有未应用的更改
  const hasChanges = files.some((file) => file.original !== file.renamed);

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
      const rawPaths = droppedFiles.map((f) => getElectronFilePath(f));
      const needsFallback = rawPaths.some((p) => !isAbsolutePathLike(p));
      const fallbackPaths = needsFallback ? extractFilePathsFromDataTransfer(e.dataTransfer) : [];

      const newFiles: FileItem[] = droppedFiles.map((file, index) => {
        const rawPath = rawPaths[index] || '';
        const pathFromUri = fallbackPaths[index] || '';
        const finalPath = isAbsolutePathLike(rawPath) ? rawPath : pathFromUri;

        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          original: file.name,
          renamed: file.name,
          path: finalPath || file.name
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

  const applyRename = useCallback(async () => {
    if (files.length === 0 || !hasChanges) {
      return { successCount: 0, errors: [] };
    }

    setIsApplying(true);

    try {
      // 构建重命名列表：只处理有变化的文件
      // 只传 newName，由主进程负责拼接路径，避免 Windows 分隔符/盘符在 renderer 端出错
      const localErrors: { path: string; error: string }[] = [];
      const renameList = files
        .filter((file) => file.original !== file.renamed)
        .flatMap((file) => {
          if (!isAbsolutePathLike(file.path)) {
            localErrors.push({
              path: file.path || file.original,
              error: '无法获取文件绝对路径：请从系统文件管理器（资源管理器/Finder）拖入文件'
            });
            return [];
          }
          return [
            {
              oldPath: file.path,
              newName: file.renamed
            }
          ];
        });

      if (renameList.length === 0) {
        return { successCount: 0, errors: localErrors, renamed: [] };
      }

      // 调用主进程执行重命名
      const result = await window.api.applyRename(renameList);
      return {
        successCount: result.successCount,
        errors: [...localErrors, ...result.errors],
        renamed: result.renamed
      };
    } finally {
      setIsApplying(false);
    }
  }, [files, hasChanges]);

  // 重命名成功后重置列表
  const resetAfterApply = useCallback((renamed?: RenamedItem[]) => {
    const pathMap = new Map((renamed || []).map((r) => [r.oldPath, r.newPath]));
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        original: file.renamed,
        // 由主进程返回 newPath，避免 renderer 端路径处理差异
        path: pathMap.get(file.path) || file.path
      }))
    );
  }, []);

  return {
    files,
    isRenaming,
    isApplying,
    hasChanges,
    addFiles,
    updateFileName,
    batchUpdateFileNames,
    clearFiles,
    handleDrop,
    startRenaming,
    stopRenaming,
    applyRename,
    resetAfterApply
  };
}
