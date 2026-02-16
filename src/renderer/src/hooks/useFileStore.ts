import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type SetStateAction
} from 'react';
import type { FileItem, RenameOrigin, TargetMode } from '@/types/file';
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

// Hook 配置选项
export type UseFileStoreOptions = {
  /** 文件夹模式下拖入文件时触发的回调，参数为被忽略的文件数 */
  onFilesIgnored?: (count: number) => void;

  /** 后缀锁定：当新文件名没有扩展名时，自动补全原扩展名（默认开启） */
  lockSuffix?: boolean;
};

// Hook 返回类型
export type UseFileStoreResult = {
  files: FileItem[];
  highlightedIds: Set<string>;
  targetMode: TargetMode;
  isScanDepthDialogOpen: boolean;
  scanDepthDialogFolderCount: number;
  isApplying: boolean;
  isUndoing: boolean;
  hasChanges: boolean;
  canUndo: boolean;
  setTargetMode: (mode: TargetMode) => void;
  addFiles: (newFiles: FileItem[]) => void;
  reorderFiles: (oldIndex: number, newIndex: number) => void;
  removeFile: (id: string) => void;
  updateFileName: (id: string, newName: string, origin?: RenameOrigin) => void;
  batchUpdateFileNames: (newNames: string[], origin?: RenameOrigin) => void;
  patchFileNames: (start: number, newNames: string[], origin?: RenameOrigin) => void;
  clearFiles: () => void;
  discardChanges: () => void;
  revertFileName: (index: number) => void;
  applyRule: (handler: (name: string, index: number) => string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  scanDepthRootOnly: () => void;
  scanDepthRecursive: () => void;
  closeScanDepthDialog: () => void;
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

export function useFileStore(options?: UseFileStoreOptions): UseFileStoreResult {
  // ── 独立的双列表状态 ──
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [folderList, setFolderList] = useState<FileItem[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [targetMode, setTargetModeRaw] = useState<TargetMode>('file');
  const [isScanDepthDialogOpen, setIsScanDepthDialogOpen] = useState(false);
  const [scanDepthDialogFolderCount, setScanDepthDialogFolderCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const targetModeRef = useRef<TargetMode>('file');
  const highlightTimerRef = useRef<number | null>(null);
  const onFilesIgnoredRef = useRef(options?.onFilesIgnored);
  const lockSuffixRef = useRef(options?.lockSuffix ?? true);
  const pendingScanDepthRef = useRef<{
    folderPaths: string[];
    directFiles: FileItem[];
    shallowFiles: FileItem[];
  } | null>(null);

  // ── 计算属性：当前模式的可见列表 ──
  const currentFiles = targetMode === 'file' ? fileList : folderList;

  // 稳定的 setter，根据 targetModeRef 分派到对应列表
  const setCurrentFiles = useCallback((updater: SetStateAction<FileItem[]>) => {
    if (targetModeRef.current === 'file') {
      setFileList(updater);
    } else {
      setFolderList(updater);
    }
  }, []);

  // Ref 始终跟踪当前模式列表（供闭包安全读取）
  const currentFilesRef = useRef<FileItem[]>([]);
  useEffect(() => {
    currentFilesRef.current = currentFiles;
  }, [currentFiles]);

  useEffect(() => {
    targetModeRef.current = targetMode;
  }, [targetMode]);

  useEffect(() => {
    onFilesIgnoredRef.current = options?.onFilesIgnored;
  }, [options?.onFilesIgnored]);

  useEffect(() => {
    lockSuffixRef.current = options?.lockSuffix ?? true;
  }, [options?.lockSuffix]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  // 检查是否有未应用的更改（仅针对当前模式列表）
  const hasChanges = currentFiles.some((file) => file.original !== file.renamed);

  // 检查是否可以撤销
  const canUndo = history.length > 0;

  const addFiles = useCallback(
    (newFiles: FileItem[]) => {
      if (newFiles.length === 0) return;

      // 收集重复文件的 ID
      const duplicateIds: string[] = [];
      const current = currentFilesRef.current;

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

      setCurrentFiles(next);

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
    },
    [setCurrentFiles]
  );

  const reorderFiles = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) return;

      setCurrentFiles((prev) => {
        if (oldIndex < 0 || newIndex < 0) return prev;
        if (oldIndex >= prev.length || newIndex >= prev.length) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [setCurrentFiles]
  );

  const updateFileName = useCallback(
    (id: string, newName: string, origin: RenameOrigin = 'user') => {
      setCurrentFiles((prev) =>
        prev.map((file) => {
          if (file.id !== id) return file;
          if (file.renamed === newName) return file;
          return { ...file, renamed: newName, renameOrigin: origin };
        })
      );
    },
    [setCurrentFiles]
  );

  const batchUpdateFileNames = useCallback(
    (newNames: string[], origin: RenameOrigin = 'rule') => {
      setCurrentFiles((prev) =>
        prev.map((file, index) => {
          const nextName = newNames[index];
          if (nextName === undefined) return file;
          if (nextName === file.renamed) return file;
          return { ...file, renamed: nextName, renameOrigin: origin };
        })
      );
    },
    [setCurrentFiles]
  );

  const patchFileNames = useCallback(
    (start: number, newNames: string[], origin: RenameOrigin = 'rule') => {
      if (!Number.isFinite(start) || start < 0 || newNames.length === 0) return;
      setCurrentFiles((prev) =>
        prev.map((file, index) => {
          const chunkIndex = index - start;
          if (chunkIndex < 0 || chunkIndex >= newNames.length) return file;
          const nextName = newNames[chunkIndex];
          if (nextName === file.renamed) return file;
          return { ...file, renamed: nextName, renameOrigin: origin };
        })
      );
    },
    [setCurrentFiles]
  );

  const clearFiles = useCallback(() => {
    setCurrentFiles([]);
  }, [setCurrentFiles]);

  // 移除单个文件（仅从 UI 列表移除，不删除物理文件）
  const removeFile = useCallback(
    (id: string) => {
      setCurrentFiles((prev) => prev.filter((file) => file.id !== id));
    },
    [setCurrentFiles]
  );

  // 放弃更改：将所有 renamed 重置为 original
  const discardChanges = useCallback(() => {
    setCurrentFiles((prev) =>
      prev.map((file) => ({
        ...file,
        renamed: file.original,
        renameOrigin: 'initial'
      }))
    );
  }, [setCurrentFiles]);

  // 单行重置：将指定索引的文件 renamed 重置为 original
  const revertFileName = useCallback(
    (index: number) => {
      setCurrentFiles((prev) =>
        prev.map((file, i) =>
          i === index ? { ...file, renamed: file.original, renameOrigin: 'initial' } : file
        )
      );
    },
    [setCurrentFiles]
  );

  // 应用规则：使用 handler 函数批量修改所有文件的 renamed
  const applyRule = useCallback(
    (handler: (name: string, index: number) => string) => {
      setCurrentFiles((prev) =>
        prev.map((file, index) => {
          const nextName = handler(file.renamed, index);
          if (nextName === file.renamed) return file;
          return { ...file, renamed: nextName, renameOrigin: 'rule' };
        })
      );
    },
    [setCurrentFiles]
  );

  // 切换目标模式：不清理数据，实现"记忆"效果
  const setTargetMode = useCallback((mode: TargetMode) => {
    setTargetModeRaw(mode);
    pendingScanDepthRef.current = null;
    setIsScanDepthDialogOpen(false);
    setScanDepthDialogFolderCount(0);
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
        const items = e.dataTransfer.items;
        const folderFiles: FileItem[] = [];
        let ignoredFileCount = 0;

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
              isDirectory: true,
              renameOrigin: 'initial'
            });
          } else {
            ignoredFileCount++;
          }
        }

        addFiles(folderFiles);
        if (ignoredFileCount > 0) {
          onFilesIgnoredRef.current?.(ignoredFileCount);
        }
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
              isDirectory: false,
              renameOrigin: 'initial'
            });
          }
        }

        // 先添加直接拖入的文件
        if (folderPaths.length === 0 && directFiles.length > 0) {
          addFiles(directFiles);
        }

        // 异步扫描文件夹并添加
        if (folderPaths.length > 0) {
          electronApi.scanDirectoryShallow(folderPaths).then((result) => {
            const shallowFiles: FileItem[] = result.files.map((f) => ({
              id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              original: f.name,
              renamed: f.name,
              path: f.path,
              isDirectory: false,
              renameOrigin: 'initial'
            }));

            if (!result.hasSubdirectories) {
              addFiles([...directFiles, ...shallowFiles]);
              return;
            }

            pendingScanDepthRef.current = { folderPaths, directFiles, shallowFiles };
            setScanDepthDialogFolderCount(folderPaths.length);
            setIsScanDepthDialogOpen(true);
          });
        }
      }
    },
    [addFiles, targetMode]
  );

  const closeScanDepthDialog = useCallback(() => {
    pendingScanDepthRef.current = null;
    setIsScanDepthDialogOpen(false);
    setScanDepthDialogFolderCount(0);
  }, []);

  const scanDepthRootOnly = useCallback(() => {
    const pending = pendingScanDepthRef.current;
    if (!pending) return;
    addFiles([...pending.directFiles, ...pending.shallowFiles]);
    closeScanDepthDialog();
  }, [addFiles, closeScanDepthDialog]);

  const scanDepthRecursive = useCallback(() => {
    const pending = pendingScanDepthRef.current;
    if (!pending) return;

    addFiles(pending.directFiles);
    const folderPaths = pending.folderPaths.slice();
    closeScanDepthDialog();

    void electronApi.scanDirectory(folderPaths).then((result) => {
      const scannedFiles: FileItem[] = result.files.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        original: f.name,
        renamed: f.name,
        path: f.path,
        isDirectory: false,
        renameOrigin: 'initial'
      }));
      if (scannedFiles.length > 0) addFiles(scannedFiles);
    });
  }, [addFiles, closeScanDepthDialog]);

  const applyRename = useCallback(async () => {
    const snapshot = currentFilesRef.current;
    const snapshotHasChanges = snapshot.some((f) => f.original !== f.renamed);
    if (snapshot.length === 0 || !snapshotHasChanges) {
      return { successCount: 0, errors: [] as RenameError[], renamed: [] as RenamedItem[] };
    }

    setIsApplying(true);

    try {
      const localErrors: RenameError[] = [];

      const renameList = snapshot
        .filter((file) => file.original !== file.renamed)
        .flatMap((file): RenameFileItem[] => {
          if (!isAbsolutePathLike(file.path)) {
            localErrors.push({
              path: file.path || file.original,
              error: '无法获取文件绝对路径：请从系统文件管理器（资源管理器/Finder）拖入文件'
            });
            return [];
          }

          const finalName = lockSuffixRef.current
            ? file.renameOrigin === 'ai' && !file.isDirectory
              ? ensureExtension(file.renamed, file.original)
              : file.renamed
            : file.renamed;
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
  }, []);

  // 重命名成功后重置列表
  // 从后端返回的实际路径（可能带序号）更新状态
  const resetAfterApply = useCallback(
    (renamed?: RenamedItem[]) => {
      const pathMap = new Map((renamed || []).map((r) => [r.oldPath, r.newPath]));

      setCurrentFiles((prev) =>
        prev.map((file) => {
          const actualNewPath = pathMap.get(file.path);
          if (actualNewPath) {
            // 从实际路径提取文件名作为新的 original
            const actualFileName = actualNewPath.split(/[\\/]/).pop() || file.renamed;
            return {
              ...file,
              original: actualFileName,
              renamed: actualFileName,
              path: actualNewPath,
              renameOrigin: 'initial'
            };
          }
          // 未返回映射：可能是 old===new 的 no-op（例如 AI 去掉后缀但开启“锁定后缀”后被补回）
          // 这里绝不能用未补全的 renamed 覆盖 original，否则会导致 UI 丢失扩展名。
          const committedName =
            lockSuffixRef.current && file.renameOrigin === 'ai' && !file.isDirectory
              ? ensureExtension(file.renamed, file.original)
              : file.renamed;

          if (committedName === file.original) {
            // 应用后等价于未改名：将 UI 恢复为原名并清除改动状态
            if (file.renamed === file.original && file.renameOrigin === 'initial') return file;
            return { ...file, renamed: file.original, renameOrigin: 'initial' };
          }

          // 兜底：若 committedName 与编辑框内容不同（例如补全了后缀），至少让 UI 展示已提交的名字
          if (committedName !== file.renamed) {
            return { ...file, renamed: committedName };
          }

          return file;
        })
      );
    },
    [setCurrentFiles]
  );

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

      // 更新文件列表：两个列表都更新，路径匹配保证只改对应项
      if (result.renamed && result.renamed.length > 0) {
        const pathMap = new Map(result.renamed.map((r) => [r.oldPath, r.newPath]));
        const updater = (prev: FileItem[]): FileItem[] =>
          prev.map((file) => {
            const newPath = pathMap.get(file.path);
            if (newPath) {
              const newName = newPath.split(/[/\\]/).pop() || file.original;
              return {
                ...file,
                original: newName,
                renamed: newName,
                path: newPath,
                renameOrigin: 'initial'
              };
            }
            return file;
          });
        setFileList(updater);
        setFolderList(updater);
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
    files: currentFiles,
    highlightedIds,
    targetMode,
    isScanDepthDialogOpen,
    scanDepthDialogFolderCount,
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
    patchFileNames,
    clearFiles,
    discardChanges,
    revertFileName,
    applyRule,
    handleDrop,
    scanDepthRootOnly,
    scanDepthRecursive,
    closeScanDepthDialog,
    applyRename,
    resetAfterApply,
    undo
  };
}
