import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { FileItem } from '@/types/file';
import { generateNewNames, getConfigFromEnv } from '@/lib/ai-service';

function isAbsolutePathLike(p: string): boolean {
  if (!p) return false;
  // Windows: C:\ or C:/, or UNC \\server\share
  if (/^[a-zA-Z]:[\\\/]/.test(p) || /^\\\\/.test(p)) return true;
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

// 历史记录项：用于撤销操作
export type HistoryItem = {
  /** 操作时间戳 */
  timestamp: number;
  /** 反向操作列表（撤销时执行） */
  undoItems: RenamedItem[];
};

// Hook 返回类型
export type UseFileStoreResult = {
  files: FileItem[];
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  addFiles: (newFiles: FileItem[]) => void;
  updateFileName: (id: string, newName: string) => void;
  batchUpdateFileNames: (newNames: string[]) => void;
  clearFiles: () => void;
  discardChanges: () => void;
  revertFileName: (index: number) => void;
  applyRule: (handler: (name: string, index: number) => string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  startRenaming: (instruction: string) => Promise<void>;
  stopRenaming: () => void;
  applyRename: () => Promise<{
    successCount: number;
    errors: { path: string; error: string }[];
    renamed?: RenamedItem[];
  }>;
  resetAfterApply: (renamed?: RenamedItem[]) => void;
  undo: () => Promise<{ success: boolean; error?: string }>;
};

export function useFileStore(): UseFileStoreResult {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 检查是否有未应用的更改
  const hasChanges = files.some((file) => file.original !== file.renamed);

  // 检查是否可以撤销
  const canUndo = history.length > 0;

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

  // 放弃更改：将所有 renamed 重置为 original
  const discardChanges = useCallback(() => {
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        renamed: file.original
      }))
    );
  }, []);

  // 单行重置：将指定索引的文件 renamed 重置为 original
  const revertFileName = useCallback((index: number) => {
    setFiles((prev) =>
      prev.map((file, i) =>
        i === index ? { ...file, renamed: file.original } : file
      )
    );
  }, []);

  // 应用规则：使用 handler 函数批量修改所有文件的 renamed
  const applyRule = useCallback((handler: (name: string, index: number) => string) => {
    setFiles((prev) =>
      prev.map((file, index) => ({
        ...file,
        renamed: handler(file.renamed, index)
      }))
    );
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

      // 辅助函数：获取扩展名（包含点号）
      const getExtension = (name: string): string => {
        const lastDot = name.lastIndexOf('.');
        // 确保点号不在开头且后面有内容
        if (lastDot > 0 && lastDot < name.length - 1) {
          return name.slice(lastDot);
        }
        return '';
      };

      // 辅助函数：智能补全扩展名
      const ensureExtension = (newName: string, originalName: string): string => {
        const newExt = getExtension(newName);
        const origExt = getExtension(originalName);

        // 如果 newName 已有扩展名，保持不变（尊重用户意图）
        if (newExt) {
          return newName;
        }

        // 如果 newName 没有扩展名但 original 有，自动补全
        if (!newExt && origExt) {
          return newName + origExt;
        }

        return newName;
      };

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

          // 智能扩展名补全
          const finalName = ensureExtension(file.renamed, file.original);

          return [
            {
              oldPath: file.path,
              newName: finalName
            }
          ];
        });

      if (renameList.length === 0) {
        return { successCount: 0, errors: localErrors, renamed: [] };
      }

      // 调用主进程执行重命名
      const result = await window.api.applyRename(renameList);

      // 如果有成功的重命名，保存到历史记录（用于撤销）
      if (result.renamed && result.renamed.length > 0) {
        // 保存反向操作：oldPath 和 newPath 互换
        const undoItems: RenamedItem[] = result.renamed.map((item) => ({
          oldPath: item.newPath,
          newPath: item.oldPath
        }));

        setHistory((prev) => [
          ...prev,
          {
            timestamp: Date.now(),
            undoItems
          }
        ]);
      }

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
  // 从后端返回的实际路径（可能带序号）更新状态
  const resetAfterApply = useCallback((renamed?: RenamedItem[]) => {
    const pathMap = new Map((renamed || []).map((r) => [r.oldPath, r.newPath]));

    setFiles((prev) =>
      prev.map((file) => {
        const actualNewPath = pathMap.get(file.path);
        if (actualNewPath) {
          // 从实际路径提取文件名作为新的 original
          const actualFileName = actualNewPath.split(/[\\/]/).pop() || file.renamed;
          return {
            ...file,
            original: actualFileName,
            renamed: actualFileName,
            path: actualNewPath
          };
        }
        // 未改名的保持原样
        return {
          ...file,
          original: file.renamed
        };
      })
    );
  }, []);

  // 撤销上一次操作
  const undo = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (history.length === 0) {
      return { success: false, error: '没有可撤销的操作' };
    }

    setIsUndoing(true);

    try {
      // 获取最近一次操作
      const lastOperation = history[history.length - 1];

      // 执行反向重命名
      const result = await window.api.applyRename(
        lastOperation.undoItems.map((item) => ({
          oldPath: item.oldPath,
          newPath: item.newPath
        }))
      );

      if (result.errors.length > 0 && result.successCount === 0) {
        return { success: false, error: result.errors[0].error };
      }

      // 从历史记录中移除
      setHistory((prev) => prev.slice(0, -1));

      // 更新文件列表：将新路径改回旧路径
      if (result.renamed && result.renamed.length > 0) {
        const pathMap = new Map(result.renamed.map((r) => [r.oldPath, r.newPath]));
        setFiles((prev) =>
          prev.map((file) => {
            const newPath = pathMap.get(file.path);
            if (newPath) {
              // 从路径中提取文件名
              const newName = newPath.split(/[/\\]/).pop() || file.original;
              return {
                ...file,
                original: newName,
                renamed: newName,
                path: newPath
              };
            }
            return file;
          })
        );
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '撤销失败';
      return { success: false, error: message };
    } finally {
      setIsUndoing(false);
    }
  }, [history]);

  return {
    files,
    isRenaming,
    isApplying,
    isUndoing,
    hasChanges,
    canUndo,
    addFiles,
    updateFileName,
    batchUpdateFileNames,
    clearFiles,
    discardChanges,
    revertFileName,
    applyRule,
    handleDrop,
    startRenaming,
    stopRenaming,
    applyRename,
    resetAfterApply,
    undo
  };
}
