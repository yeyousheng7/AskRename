import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { FileItem, TargetMode } from '@/types/file';
import { generateNewNames, type AIServiceConfig } from '@/lib/ai-service';
import { ensureExtension } from '@/lib/filename';
import { electronApi } from '@/lib/electron-api';
import {
  extractFilePathsFromDataTransfer,
  getElectronFilePath,
  isAbsolutePathLike
} from '@/lib/file-drop';
import { getDedupeKey } from '@/lib/file-dedupe';
import type { RenameError, RenameFileItem, RenameResult, RenamedItem } from '@shared/ipc-types';

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
  highlightedIds: Set<string>;
  targetMode: TargetMode;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  setTargetMode: (mode: TargetMode) => void;
  addFiles: (newFiles: FileItem[]) => void;
  reorderFiles: (oldIndex: number, newIndex: number) => void;
  removeFile: (id: string) => void;
  updateFileName: (id: string, newName: string) => void;
  batchUpdateFileNames: (newNames: string[]) => void;
  clearFiles: () => void;
  discardChanges: () => void;
  revertFileName: (index: number) => void;
  applyRule: (handler: (name: string, index: number) => string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  startRenaming: (instruction: string, config?: Partial<AIServiceConfig>) => Promise<void>;
  stopRenaming: () => void;
  applyRename: () => Promise<{
    successCount: number;
    errors: RenameError[];
    renamed?: RenamedItem[];
  }>;
  resetAfterApply: (renamed?: RenamedItem[]) => void;
  undo: () => Promise<{ success: boolean; error?: string }>;
};

function arrayMove<T>(items: T[], oldIndex: number, newIndex: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}

export function useFileStore(): UseFileStoreResult {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [targetMode, setTargetModeRaw] = useState<TargetMode>('file');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const filesRef = useRef<FileItem[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  // 检查是否有未应用的更改
  const hasChanges = files.some((file) => file.original !== file.renamed);

  // 检查是否可以撤销
  const canUndo = history.length > 0;

  const addFiles = useCallback((newFiles: FileItem[]) => {
    if (newFiles.length === 0) return;

    // 收集重复文件的 ID
    const duplicateIds: string[] = [];
    const current = filesRef.current;

    const keyToId = new Map(current.map((f) => [getDedupeKey(f), f.id]));
    const keys = new Set(current.map(getDedupeKey));
    const next = [...current];

    for (const file of newFiles) {
      const key = getDedupeKey(file);
      if (keys.has(key)) {
        const existingId = keyToId.get(key);
        if (existingId) duplicateIds.push(existingId);
        continue;
      }
      keys.add(key);
      keyToId.set(key, file.id);
      next.push(file);
    }

    setFiles(next);

    // 触发高亮动画
    if (duplicateIds.length > 0) {
      // 清除之前的定时器
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }

      // 强制重启动画（同一行被重复触发时，class 不变会导致动画不重新播放）
      setHighlightedIds(new Set());
      window.requestAnimationFrame(() => {
        setHighlightedIds(new Set(duplicateIds));
      });

      // 1.5 秒后清除高亮
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedIds(new Set());
        highlightTimerRef.current = null;
      }, 1500);
    }
  }, []);

  const reorderFiles = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;

    setFiles((prev) => {
      if (oldIndex < 0 || newIndex < 0) return prev;
      if (oldIndex >= prev.length || newIndex >= prev.length) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
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

  // 移除单个文件（仅从 UI 列表移除，不删除物理文件）
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
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
      prev.map((file, i) => (i === index ? { ...file, renamed: file.original } : file))
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

  // 切换目标模式时自动清空列表
  const setTargetMode = useCallback((mode: TargetMode) => {
    setTargetModeRaw(mode);
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

      if (targetMode === 'folder') {
        // 文件夹模式：仅保留文件夹，忽略文件
        // DataTransfer 中的文件夹有特征：size === 0 且无扩展名（但不完全可靠）
        // 更可靠的方法是通过 Electron 获取路径后在 main 进程判断
        // 这里用简单方式：通过 webkitGetAsEntry 判断
        const items = e.dataTransfer.items;
        const folderFiles: FileItem[] = [];

        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            const file = droppedFiles[i];
            const rawPath = rawPaths[i] || '';
            const pathFromUri = fallbackPaths[i] || '';
            const finalPath = isAbsolutePathLike(rawPath) ? rawPath : pathFromUri;

            folderFiles.push({
              id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              original: file.name,
              renamed: file.name,
              path: finalPath || file.name,
              isDirectory: true
            });
          }
        }

        addFiles(folderFiles);
      } else {
        // 文件模式：文件直接保留，文件夹递归扫描
        const items = e.dataTransfer.items;
        const directFiles: FileItem[] = [];
        const folderPaths: string[] = [];

        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          const file = droppedFiles[i];
          const rawPath = rawPaths[i] || '';
          const pathFromUri = fallbackPaths[i] || '';
          const finalPath = isAbsolutePathLike(rawPath) ? rawPath : pathFromUri;

          if (entry?.isDirectory) {
            // 文件夹 → 收集路径待扫描
            if (isAbsolutePathLike(finalPath)) {
              folderPaths.push(finalPath);
            }
          } else {
            // 普通文件 → 直接加入
            directFiles.push({
              id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              original: file.name,
              renamed: file.name,
              path: finalPath || file.name,
              isDirectory: false
            });
          }
        }

        // 先添加直接拖入的文件
        if (directFiles.length > 0) {
          addFiles(directFiles);
        }

        // 异步扫描文件夹并添加
        if (folderPaths.length > 0) {
          electronApi.scanDirectory(folderPaths).then((result) => {
            const scannedFiles: FileItem[] = result.files.map((f) => ({
              id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              original: f.name,
              renamed: f.name,
              path: f.path,
              isDirectory: false
            }));
            if (scannedFiles.length > 0) {
              addFiles(scannedFiles);
            }
          });
        }
      }
    },
    [addFiles, targetMode]
  );

  const stopRenaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRenaming(false);
  }, []);

  const startRenaming = useCallback(
    async (instruction: string, config?: Partial<AIServiceConfig>) => {
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
        const newNames = await generateNewNames(originalNames, instruction, config);

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
      return { successCount: 0, errors: [] as RenameError[], renamed: [] as RenamedItem[] };
    }

    setIsApplying(true);

    try {
      const localErrors: RenameError[] = [];

      const renameList = files
        .filter((file) => file.original !== file.renamed)
        .flatMap((file): RenameFileItem[] => {
          if (!isAbsolutePathLike(file.path)) {
            localErrors.push({
              path: file.path || file.original,
              error: '无法获取文件绝对路径：请从系统文件管理器（资源管理器/Finder）拖入文件'
            });
            return [];
          }

          const finalName = ensureExtension(file.renamed, file.original);
          if (finalName.split(/[/\\]/).length > 1) {
            localErrors.push({
              path: file.path,
              error: '新文件名不能包含路径分隔符'
            });
            return [];
          }
          if (!finalName.trim()) {
            localErrors.push({
              path: file.path,
              error: '新文件名不能为空'
            });
            return [];
          }

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
      const result: RenameResult = await electronApi.applyRename(renameList);

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
      const result = await electronApi.applyRename(
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
    highlightedIds,
    targetMode,
    isRenaming,
    isApplying,
    isUndoing,
    hasChanges,
    canUndo,
    setTargetMode,
    addFiles,
    reorderFiles,
    removeFile,
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
