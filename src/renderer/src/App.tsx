import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileStore } from '@/hooks/useFileStore';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import FileList from '@/components/FileList';
import { ProgressOverlay } from '@/components/ProgressOverlay';
import { ScanDepthDialog } from '@/components/ScanDepthDialog';
import { PaginationBar } from '@/components/PaginationBar';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Toast } from '@/components/Toast';
import { BatchSuggestDialog } from '@/components/BatchSuggestDialog';
import { FileDropOverlay } from '@/components/FileDropOverlay';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { useToast } from '@/hooks/useToast';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useFileDragOverlay } from '@/hooks/useFileDragOverlay';
import { useEvent } from '@/hooks/useEvent';
import { useFooterController } from '@/hooks/useFooterController';
import { useBatchAI } from '@/hooks/useBatchAI';
import { electronApi } from '@/lib/electron-api';
import { getConfigFromEnv } from '@/lib/ai-service';
import {
  extractFilePathsFromDataTransfer,
  getElectronFilePath,
  isAbsolutePathLike
} from '@/lib/file-drop';
import { cn } from '@/lib/utils';
import {
  buildModePreview,
  executeModeStrategy,
  getModeById,
  getModeSubmitInput,
  normalizeModePayload
} from '@/modes/registry';
import type { FileItem } from '@/types/file';
import type { Mode } from '@/types/mode';
import type { SettingsTabId } from '@/types/settings';
import type { AIChatSettings } from '@shared/ipc-types';

// ============================================================================
// App 主组件
// ============================================================================

const PAGINATION_THRESHOLD = 100;
const DEFAULT_PAGE_SIZE = 50;
const INITIAL_SMART_PAYLOAD = { instruction: '' };
type SmartHandoffState = { find: string; replace: string };

function extractInstruction(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('instruction' in payload)) return '';
  const value = (payload as { instruction?: unknown }).instruction;
  return typeof value === 'string' ? value : '';
}

function App(): React.JSX.Element {
  // 当前选择的重命名模式
  const [mode, setMode] = useState<Mode>('smart');

  const [aiPreviewCount, setAiPreviewCount] = useState(0);
  const [smartPreview, setSmartPreview] = useState<{ count: number } | null>(null);
  const [smartDerivedRegex, setSmartDerivedRegex] = useState<SmartHandoffState | null>(null);

  const modePayloadRef = useRef<unknown>(INITIAL_SMART_PAYLOAD);
  const [footerPayload, setFooterPayload] = useState<unknown>(INITIAL_SMART_PAYLOAD);
  const [smartInstructionDraft, setSmartInstructionDraft] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsOpenTimerRef = useRef<number | null>(null);
  const [settingsForcedTab, setSettingsForcedTab] = useState<SettingsTabId | null>(null);
  const [isBatchSuggestOpen, setIsBatchSuggestOpen] = useState(false);
  const pendingSubmitPayloadRef = useRef<unknown | null>(null);

  const { resolvedTheme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast, showToast, dismissToast } = useToast();
  const { history, addToHistory } = useSessionHistory();
  const batchAI = useBatchAI({
    batchSize: settings.batchSize,
    concurrencyLimit: settings.concurrencyLimit
  });
  const [isStrategyProcessing, setIsStrategyProcessing] = useState(false);

  const {
    files,
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
    removeFile,
    reorderFiles,
    updateFileName,
    batchUpdateFileNames,
    patchFileNames,
    clearFiles,
    discardChanges,
    revertFileName,
    handleDrop,
    scanDepthRootOnly,
    scanDepthRecursive,
    closeScanDepthDialog,
    applyRename,
    resetAfterApply,
    undo
  } = useFileStore({
    onFilesIgnored: (count) => showToast(`已忽略 ${count} 个非文件夹项`, 'error'),
    lockSuffix: settings.lockSuffix
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // 是否处于审查模式（有待应用的更改）
  const isBatchCapableMode = mode === 'ai' || mode === 'smart';
  const shouldBatchRun =
    isBatchCapableMode &&
    (settings.batchPolicy === 'force' ||
      (settings.batchPolicy === 'auto' && files.length >= settings.batchThreshold));
  const shouldSuggestBatchEnable =
    (mode === 'ai' || (mode === 'smart' && !(smartDerivedRegex && !shouldBatchRun))) &&
    settings.batchPolicy === 'off' &&
    files.length >= Math.max(1, settings.batchThreshold);
  const isAnyProcessing = batchAI.status === 'processing' || isStrategyProcessing;
  const isReviewMode = hasChanges && !isAnyProcessing && batchAI.status === 'idle';
  const effectiveSubmitMode: Mode =
    mode === 'smart' && smartDerivedRegex && !shouldBatchRun ? 'regex' : mode;
  const canSubmitToken = useMemo(
    () => getModeSubmitInput(effectiveSubmitMode, footerPayload),
    [effectiveSubmitMode, footerPayload]
  );
  const disableSubmitForReview = useMemo(
    () => isReviewMode && canSubmitToken.length === 0,
    [isReviewMode, canSubmitToken]
  );
  const footerStrategyUi = useMemo(
    () => getModeById(effectiveSubmitMode).meta.ui,
    [effectiveSubmitMode]
  );
  const footerReviewKind = useMemo(() => {
    if (!isReviewMode) return 'none';
    if (mode === 'ai') return 'ai-review';
    if (mode === 'smart' && (smartPreview?.count ?? 0) > 0) return 'smart-review';
    return 'plain-review';
  }, [isReviewMode, mode, smartPreview]);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const stableOriginalNamesKey = files
    .map((f) => `${f.id}:${f.original}`)
    .sort()
    .join('\u0000');

  const computePreviewSafe = useCallback(
    (currentFiles: FileItem[], currentMode: Mode, payload: unknown): string[] | null => {
      if (currentMode === 'smart' && smartDerivedRegex && !shouldBatchRun) {
        const regexPayload = normalizeModePayload('regex', payload, smartDerivedRegex);
        return buildModePreview('regex', currentFiles, regexPayload);
      }
      return buildModePreview(currentMode, currentFiles, payload);
    },
    [smartDerivedRegex, shouldBatchRun]
  );

  const applyModePreview = useCallback(
    (payload: unknown, origin: 'ai' | 'rule') => {
      const currentFiles = filesRef.current;
      if (currentFiles.length === 0) return;
      const names = computePreviewSafe(currentFiles, mode, payload);
      if (!names) return;
      batchUpdateFileNames(names, origin);
    },
    [mode, computePreviewSafe, batchUpdateFileNames]
  );

  useEffect(() => {
    if (mode !== 'smart' || !shouldBatchRun || !smartDerivedRegex) return;
    const restoredPayload = { instruction: smartInstructionDraft };
    modePayloadRef.current = restoredPayload;
    setFooterPayload(restoredPayload);
    setSmartDerivedRegex(null);
    setSmartPreview(null);
  }, [mode, shouldBatchRun, smartDerivedRegex, smartInstructionDraft]);

  const handleModePayloadChange = useCallback(
    (payload: unknown) => {
      modePayloadRef.current = payload;
      setFooterPayload(payload);
      if (mode === 'smart' && !smartDerivedRegex) {
        setSmartInstructionDraft(extractInstruction(payload));
      }
      applyModePreview(payload, 'rule');
    },
    [mode, smartDerivedRegex, applyModePreview]
  );

  useEffect(() => {
    applyModePreview(modePayloadRef.current, 'rule');
  }, [mode, stableOriginalNamesKey, smartDerivedRegex, applyModePreview]);

  const [reorderNonce, setReorderNonce] = useState(0);
  const handleAfterReorder = useCallback(() => {
    setReorderNonce((prev) => prev + 1);
  }, []);

  const recomputeAfterReorder = useCallback(() => {
    const names = computePreviewSafe(files, mode, modePayloadRef.current);
    if (names) {
      batchUpdateFileNames(names, 'rule');
    }
  }, [mode, files, computePreviewSafe, batchUpdateFileNames]);

  useEffect(() => {
    if (reorderNonce === 0) return;
    recomputeAfterReorder();
  }, [reorderNonce, recomputeAfterReorder]);

  // 模式切换处理
  const handleModeChange = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;

      // 切换时清空输入并重置预览
      setAiPreviewCount(0);
      setSmartPreview(null);
      setSmartDerivedRegex(null);
      const nextPayload = getModeById(newMode).createInitialPayload();
      modePayloadRef.current = nextPayload;
      setFooterPayload(nextPayload);
      if (newMode === 'smart') {
        setSmartInstructionDraft(extractInstruction(nextPayload));
      }
      discardChanges();
      setError(null);

      setMode(newMode);
    },
    [mode, discardChanges]
  );

  const openSettings = useCallback(async () => {
    setIsSettingsOpen(true);
    if (settings.provider === 'ollama') return;
    if (settings.apiKey.trim()) return;
    try {
      const saved = (await electronApi.getApiKey(settings.provider)) || '';
      if (saved.trim()) updateSettings({ apiKey: saved });
    } catch (err) {
      console.error('Failed to load api key:', err);
    }
  }, [settings.provider, settings.apiKey, updateSettings]);

  const promptConfigureApiKey = useCallback(() => {
    showToast('请先配置 API Key 以继续...', 'error');
    if (settingsOpenTimerRef.current) {
      window.clearTimeout(settingsOpenTimerRef.current);
    }
    settingsOpenTimerRef.current = window.setTimeout(() => {
      setSettingsForcedTab('api');
      void openSettings();
    }, 1500);
  }, [openSettings, showToast]);

  useEffect(() => {
    return () => {
      if (settingsOpenTimerRef.current) {
        window.clearTimeout(settingsOpenTimerRef.current);
      }
    };
  }, []);

  // 撤销处理
  const handleUndo = useCallback(async () => {
    if (isUndoing) return;

    // UX: if we have preview changes (not applied yet), "undo" acts as "discard preview changes".
    if (!canUndo && hasChanges) {
      discardChanges();
      setAiPreviewCount(0);
      setSmartPreview(null);
      showToast('已撤回预览更改', 'success');
      return;
    }

    const result = await undo();
    if (result.success) {
      showToast('撤销成功', 'success');
    } else {
      showToast(`撤销失败：${result.error}`, 'error');
    }
  }, [canUndo, discardChanges, hasChanges, isUndoing, undo, showToast]);
  const handleUndoEvent = useEvent(handleUndo);

  const resolveApiKey = useCallback(async (): Promise<string | null> => {
    const localApiKey = settings.apiKey.trim();
    if (settings.provider === 'ollama') return localApiKey;
    if (localApiKey) return localApiKey;

    try {
      const saved = ((await electronApi.getApiKey(settings.provider)) || '').trim();
      if (!saved) {
        promptConfigureApiKey();
        return null;
      }
      updateSettings({ apiKey: saved });
      return saved;
    } catch (err) {
      console.error('Failed to load api key:', err);
      promptConfigureApiKey();
      return null;
    }
  }, [settings.apiKey, settings.provider, promptConfigureApiKey, updateSettings]);

  const resolveModelSettings = useCallback(() => {
    const baseURL = settings.baseUrl.trim();
    const model = settings.model.trim();
    if (!baseURL) throw new Error('API Base URL 未配置');
    if (!model) throw new Error('模型名称未配置');
    return { baseURL, model };
  }, [settings.baseUrl, settings.model]);

  const resolveAIConfig = useCallback(async (): Promise<AIChatSettings> => {
    const apiKeyToUse = await resolveApiKey();
    if (!apiKeyToUse && settings.provider !== 'ollama') {
      throw new Error('API Key 未配置，请先在设置中配置 API Key');
    }

    const envCfg = getConfigFromEnv();
    const { baseURL, model } = resolveModelSettings();

    return {
      provider: settings.provider,
      apiKey: apiKeyToUse ?? '',
      baseURL,
      model,
      jsonMode: envCfg.jsonMode,
      maxTokens: envCfg.maxTokens
    };
  }, [resolveApiKey, resolveModelSettings, settings.provider]);

  const pushInstructionHistory = useCallback(
    (payload: unknown): void => {
      const instruction = extractInstruction(payload).trim();
      if (!instruction) return;
      addToHistory(instruction);
    },
    [addToHistory]
  );

  const clearSubmittedInstruction = useCallback(
    (payload: unknown): void => {
      if (mode !== 'ai' && mode !== 'smart') return;
      if (!extractInstruction(payload).trim()) return;

      const nextPayload = { instruction: '' };
      modePayloadRef.current = nextPayload;
      setFooterPayload(nextPayload);
      if (mode === 'smart' && !smartDerivedRegex) {
        setSmartInstructionDraft('');
      }
    },
    [mode, smartDerivedRegex]
  );

  const handleGenerateByStrategy = useCallback(
    async (params?: unknown, options?: { bypassBatchSuggest?: boolean }) => {
      if (files.length === 0 || isAnyProcessing || isApplying || isUndoing) return;

      const submitPayload = params ?? modePayloadRef.current;
      if (!options?.bypassBatchSuggest && shouldSuggestBatchEnable) {
        pendingSubmitPayloadRef.current = submitPayload;
        setIsBatchSuggestOpen(true);
        return;
      }

      if (shouldBatchRun) {
        setError(null);
        try {
          const aiConfig = await resolveAIConfig();
          const strategy = getModeById(mode);
          const normalizedPayload = normalizeModePayload(mode, submitPayload);
          const validation = strategy.validateSubmit?.(normalizedPayload);
          if (validation && !validation.valid) {
            showToast(validation.error || '参数无效', 'error');
            return;
          }
          clearSubmittedInstruction(submitPayload);
          const executeBatchChunk = strategy.executeBatchChunk;
          if (!executeBatchChunk) {
            throw new Error(`${strategy.meta.label} 当前不支持分批执行`);
          }

          showToast(`正在分批处理 ${files.length} 个文件...`, 'success');
          if (mode === 'smart') {
            setSmartDerivedRegex(null);
            setSmartPreview(null);
          } else {
            setSmartPreview(null);
          }
          setAiPreviewCount(0);

          const filesSnapshot = files.map((file) => ({ ...file }));
          const chunkContext = {
            aiConfig,
            batching: {
              batchSize: settings.batchSize,
              concurrencyLimit: settings.concurrencyLimit,
              totalFiles: filesSnapshot.length
            }
          };

          batchAI.start({
            requestIdPrefix: `${mode}-batch`,
            items: filesSnapshot.map((file) => ({ id: file.id, original: file.original })),
            runChunk: async ({ batchIndex, start, startIndex, requestId, items, signal }) => {
              if (signal.aborted) {
                throw new Error('任务已取消');
              }
              const chunkFiles = filesSnapshot.slice(start, start + items.length);
              const chunkResult = await executeBatchChunk(
                chunkFiles,
                normalizedPayload,
                chunkContext,
                {
                  batchIndex,
                  start,
                  startIndex,
                  requestId
                }
              );
              if (signal.aborted) {
                throw new Error('任务已取消');
              }
              return chunkResult.map((file) => file.renamed);
            },
            onBatchApplied: ({ start, resultNames }) => {
              patchFileNames(start, resultNames, 'ai');
            },
            onCancelRequest: (requestId) => {
              void electronApi.cancelAI(requestId);
            }
          });

          pushInstructionHistory(submitPayload);
        } catch (err) {
          const message = err instanceof Error ? err.message : '处理失败，请重试';
          setError(message);
          showToast(message, 'error');
        }
        return;
      }

      setIsStrategyProcessing(true);
      setError(null);
      try {
        const strategyMode = effectiveSubmitMode;
        let aiConfig: AIChatSettings | undefined;
        if (strategyMode === 'ai' || strategyMode === 'smart') {
          showToast(`正在处理 ${files.length} 个文件...`, 'success');
          aiConfig = await resolveAIConfig();
        }

        clearSubmittedInstruction(submitPayload);

        if (mode === 'smart' && !smartDerivedRegex) {
          setSmartPreview(null);
        }
        if (strategyMode === 'ai') {
          setAiPreviewCount(0);
        }

        const result = await executeModeStrategy(strategyMode, files, submitPayload, {
          aiConfig,
          batching: {
            batchSize: settings.batchSize,
            concurrencyLimit: settings.concurrencyLimit
          }
        });
        if (!result.ok) {
          showToast(result.error, 'error');
          return;
        }

        const strategyResult = result.result;
        if (strategyResult.type === 'regex-handoff') {
          setSmartInstructionDraft(extractInstruction(modePayloadRef.current));
          const regexPayload = {
            findPattern: strategyResult.payload.find,
            replacePattern: strategyResult.payload.replace
          };
          const handoffNames = buildModePreview('regex', files, regexPayload);
          if (handoffNames) {
            batchUpdateFileNames(handoffNames, 'rule');
          }
          modePayloadRef.current = regexPayload;
          setFooterPayload(regexPayload);
          setSmartDerivedRegex({
            find: strategyResult.payload.find,
            replace: strategyResult.payload.replace
          });
          setSmartPreview(null);
          setAiPreviewCount(0);
          pushInstructionHistory(submitPayload);
          showToast('已生成正则规则，可在智能模式下继续微调', 'success');
          return;
        }

        if (mode === 'smart' && strategyMode === 'smart') {
          setSmartDerivedRegex(null);
        }
        const nextNames = strategyResult.files.map((f) => f.renamed);
        batchUpdateFileNames(nextNames, strategyMode === 'regex' ? 'rule' : 'ai');

        if (mode === 'smart') {
          setSmartPreview({ count: nextNames.length });
          setAiPreviewCount(0);
        } else if (strategyMode === 'ai') {
          setAiPreviewCount(nextNames.length);
          setSmartPreview(null);
        } else {
          setAiPreviewCount(0);
          setSmartPreview(null);
        }

        pushInstructionHistory(submitPayload);
      } catch (err) {
        const message = err instanceof Error ? err.message : '处理失败，请重试';
        setError(message);
        showToast(message, 'error');
      } finally {
        setIsStrategyProcessing(false);
      }
    },
    [
      mode,
      effectiveSubmitMode,
      shouldBatchRun,
      shouldSuggestBatchEnable,
      smartDerivedRegex,
      showToast,
      files,
      batchUpdateFileNames,
      patchFileNames,
      resolveAIConfig,
      batchAI,
      isAnyProcessing,
      isApplying,
      isUndoing,
      settings.batchSize,
      settings.concurrencyLimit,
      clearSubmittedInstruction,
      pushInstructionHistory
    ]
  );

  const closeBatchSuggestDialog = useCallback(() => {
    pendingSubmitPayloadRef.current = null;
    setIsBatchSuggestOpen(false);
  }, []);

  const openPreferencesFromBatchSuggest = useCallback(() => {
    pendingSubmitPayloadRef.current = null;
    setIsBatchSuggestOpen(false);
    setSettingsForcedTab('preferences');
    void openSettings();
  }, [openSettings]);

  const continueWithoutBatching = useCallback(() => {
    const pending = pendingSubmitPayloadRef.current ?? modePayloadRef.current;
    pendingSubmitPayloadRef.current = null;
    setIsBatchSuggestOpen(false);
    void handleGenerateByStrategy(pending, { bypassBatchSuggest: true });
  }, [handleGenerateByStrategy]);

  useEffect(() => {
    if (!isBatchSuggestOpen) return;
    if (shouldSuggestBatchEnable) return;
    pendingSubmitPayloadRef.current = null;
    setIsBatchSuggestOpen(false);
  }, [isBatchSuggestOpen, shouldSuggestBatchEnable]);

  useEffect(() => {
    if (!shouldBatchRun) return;
    if (batchAI.status !== 'idle') return;
    if (!hasChanges) return;

    if (mode === 'smart') {
      setSmartPreview({ count: files.length });
      setAiPreviewCount(0);
      return;
    }

    if (mode === 'ai') {
      setAiPreviewCount(files.length);
      setSmartPreview(null);
    }
  }, [shouldBatchRun, batchAI.status, hasChanges, mode, files.length]);

  const footerController = useFooterController({
    mode,
    effectiveMode: effectiveSubmitMode,
    payload: footerPayload,
    onPayloadChange: handleModePayloadChange,
    onModeChange: handleModeChange,
    onGenerate: (payload) => {
      void handleGenerateByStrategy(payload);
    },
    showToast
  });

  // 放弃更改
  const handleDiscard = useCallback(() => {
    discardChanges();
    setAiPreviewCount(0);
    setSmartPreview(null);
  }, [discardChanges]);

  // 应用重命名
  const handleApply = useCallback(async () => {
    if (isApplying || !hasChanges) return;

    setError(null);
    try {
      const result = await applyRename();

      if (result.errors.length > 0) {
        // 部分失败
        const errorMsg = result.errors.map((e) => `${e.path}: ${e.error}`).join('\n');
        console.error('部分文件重命名失败:', errorMsg);

        if (result.successCount > 0) {
          showToast(
            `成功重命名 ${result.successCount} 个文件，${result.errors.length} 个失败`,
            'error'
          );
        } else {
          showToast(`重命名失败：${result.errors[0].error}`, 'error');
        }
      } else if (result.successCount > 0) {
        // 成功时显示带撤销按钮的 Toast
        showToast(`成功重命名 ${result.successCount} 个文件`, 'success', {
          label: '撤销',
          onClick: handleUndoEvent
        });
        // 重置列表，准备下一轮
        resetAfterApply(result.renamed);
        setAiPreviewCount(0);
        setSmartPreview(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '应用失败，请重试';
      setError(message);
      showToast(message, 'error');
      console.error('应用失败:', err);
    }
  }, [isApplying, hasChanges, applyRename, resetAfterApply, showToast, handleUndoEvent]);

  useEffect(() => {
    if (!hasChanges) {
      setAiPreviewCount(0);
      setSmartPreview(null);
    }
  }, [hasChanges]);

  const handleDropWithIgnoreToast = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (targetMode !== 'file') {
        handleDrop(e);
        return;
      }

      const items = e.dataTransfer.items;
      const singleEntry = items.length === 1 ? items[0].webkitGetAsEntry?.() : null;
      if (singleEntry?.isDirectory) {
        handleDrop(e);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = Array.from(e.dataTransfer.files);
      const rawPaths = droppedFiles.map((file) => getElectronFilePath(file));
      const needsFallback = rawPaths.some((path) => !isAbsolutePathLike(path));
      const fallbackPaths = needsFallback ? extractFilePathsFromDataTransfer(e.dataTransfer) : [];

      const directFiles: FileItem[] = [];
      let ignoredCount = 0;

      for (let i = 0; i < items.length; i += 1) {
        const entry = items[i].webkitGetAsEntry?.();
        const file = droppedFiles[i];
        if (entry?.isDirectory || !file) {
          ignoredCount += 1;
          continue;
        }

        const rawPath = rawPaths[i] || '';
        const pathFromUri = fallbackPaths[i] || '';
        const finalPath = isAbsolutePathLike(rawPath) ? rawPath : pathFromUri;
        if (!isAbsolutePathLike(finalPath)) {
          ignoredCount += 1;
          continue;
        }

        directFiles.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          original: file.name,
          renamed: file.name,
          path: finalPath,
          isDirectory: false,
          renameOrigin: 'initial'
        });
      }

      if (directFiles.length > 0) {
        addFiles(directFiles);
      }
      if (ignoredCount > 0) {
        showToast(`已忽略 ${ignoredCount} 个非文件项`, 'error');
      }
    },
    [targetMode, handleDrop, addFiles, showToast]
  );

  const { isDragging, rootProps } = useFileDragOverlay(handleDropWithIgnoreToast);

  const isEmpty = files.length === 0;
  const isPagingEnabled = files.length > PAGINATION_THRESHOLD && Number.isFinite(pageSize);
  const effectivePageSize = isPagingEnabled ? pageSize : files.length || 1;
  const pageCount = Math.max(1, Math.ceil(files.length / effectivePageSize));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = clampedPageIndex * effectivePageSize;
  const pageFiles = isPagingEnabled ? files.slice(pageStart, pageStart + effectivePageSize) : files;

  const setEditingIndexWithPaging = useCallback(
    (next: number | null) => {
      if (next !== null && isPagingEnabled) {
        setPageIndex(Math.floor(next / effectivePageSize));
      }
      setEditingIndex(next);
    },
    [isPagingEnabled, effectivePageSize]
  );

  return (
    <div
      className={cn(
        'flex h-screen w-screen flex-col bg-white dark:bg-zinc-950 transition-colors',
        isDragging && targetMode === 'folder' && 'bg-amber-50/50 dark:bg-amber-950/20',
        isDragging && targetMode === 'file' && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onDrop={rootProps.onDrop}
      onDragOver={rootProps.onDragOver}
      onDragEnter={rootProps.onDragEnter}
      onDragLeave={rootProps.onDragLeave}
    >
      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={dismissToast}
          action={toast.action}
        />
      )}

      <ScanDepthDialog
        open={isScanDepthDialogOpen && targetMode === 'file'}
        folderCount={scanDepthDialogFolderCount}
        onClose={closeScanDepthDialog}
        onRootOnly={scanDepthRootOnly}
        onRecursive={scanDepthRecursive}
      />

      <ProgressOverlay
        open={batchAI.status === 'processing' || batchAI.status === 'error'}
        status={batchAI.status}
        completedFiles={batchAI.completedFiles}
        totalFiles={batchAI.totalFiles}
        progressPercent={batchAI.progressPercent}
        batches={batchAI.batches}
        errorSummary={batchAI.errorSummary}
        onCancel={() => {
          batchAI.cancel();
          if (batchAI.status === 'processing') {
            showToast('已取消任务', 'success');
          }
        }}
        onRetryFailed={batchAI.retryFailed}
        onRetryBatch={batchAI.retryBatch}
      />

      {isSettingsOpen && (
        <SettingsDialog
          open
          forcedTab={settingsForcedTab}
          onClearForcedTab={() => setSettingsForcedTab(null)}
          onClose={() => {
            setSettingsForcedTab(null);
            setIsSettingsOpen(false);
          }}
          settings={settings}
          updateSettings={updateSettings}
        />
      )}

      <BatchSuggestDialog
        open={isBatchSuggestOpen}
        fileCount={files.length}
        threshold={Math.max(1, settings.batchThreshold)}
        onClose={closeBatchSuggestDialog}
        onOpenPreferences={openPreferencesFromBatchSuggest}
        onContinue={continueWithoutBatching}
      />

      {/* 拖放覆盖层 */}
      {isDragging && <FileDropOverlay targetMode={targetMode} />}

      {/* 表头 */}
      <AppHeader
        filesLength={files.length}
        isProcessing={isAnyProcessing}
        hasChanges={hasChanges}
        targetMode={targetMode}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => {
          setSettingsForcedTab(null);
          void openSettings();
        }}
        onClear={clearFiles}
        onTargetModeChange={setTargetMode}
      />

      {/* 文件列表 */}
      {isEmpty ? (
        <EmptyState targetMode={targetMode} />
      ) : (
        <>
          {files.length > PAGINATION_THRESHOLD && (
            <PaginationBar
              total={files.length}
              pageIndex={clampedPageIndex}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageIndexChange={(next) => setPageIndex(Math.min(Math.max(0, next), pageCount - 1))}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPageIndex(0);
              }}
            />
          )}

          <ScrollArea
            key={`${clampedPageIndex}:${pageSize}:${files.length}`}
            className="flex-1 min-h-0"
          >
            <FileList
              files={pageFiles}
              indexOffset={pageStart}
              totalFilesLength={files.length}
              highlightedIds={highlightedIds}
              editingIndex={editingIndex}
              setEditingIndex={setEditingIndexWithPaging}
              onRename={updateFileName}
              onRevert={revertFileName}
              onRemove={removeFile}
              reorderFiles={reorderFiles}
              onAfterReorder={handleAfterReorder}
              isLoading={isAnyProcessing}
              isDisabled={isAnyProcessing || isApplying || isUndoing}
              animatePreview
            />
          </ScrollArea>
        </>
      )}

      <AppFooter
        mode={mode}
        effectiveMode={effectiveSubmitMode}
        canSubmitToken={canSubmitToken}
        disableSubmitForReview={disableSubmitForReview}
        inputMinHeightClass={footerStrategyUi?.inputMinHeightClass ?? 'min-h-[44px]'}
        submitTitle={footerStrategyUi?.submitTitle ?? '生成'}
        showHistoryDrawer={footerStrategyUi?.showHistoryDrawer ?? false}
        isSmartRegexPanel={mode === 'smart' && !!smartDerivedRegex && !shouldBatchRun}
        CustomInput={footerController.CustomInput}
        smartDerivedRegex={smartDerivedRegex}
        onClearSmartDerivedRegex={() => {
          const restoredPayload = { instruction: smartInstructionDraft };
          modePayloadRef.current = restoredPayload;
          setFooterPayload(restoredPayload);
          setSmartDerivedRegex(null);
          setSmartPreview(null);
        }}
        onModeChange={handleModeChange}
        error={error}
        isEmpty={isEmpty}
        isReviewMode={isReviewMode}
        reviewKind={footerReviewKind}
        isProcessing={isAnyProcessing}
        isApplying={isApplying}
        isUndoing={isUndoing}
        canUndo={canUndo}
        payload={footerPayload}
        onPayloadChange={handleModePayloadChange}
        onUndo={() => void handleUndoEvent()}
        onDiscard={handleDiscard}
        onApply={() => void handleApply()}
        onStop={() => {
          if (batchAI.status === 'processing') {
            batchAI.cancel();
            showToast('已取消任务', 'success');
            return;
          }
          if (isStrategyProcessing) {
            showToast('当前任务处理中，请稍候...', 'error');
          }
        }}
        onPrimarySubmit={footerController.handlePrimarySubmit}
        aiPreviewCount={aiPreviewCount}
        smartPreviewCount={smartPreview?.count ?? 0}
        getAIConfig={resolveAIConfig}
        showToast={showToast}
        history={history}
        instruction={footerController.instruction}
        inputRef={footerController.inputRef}
        slashMenu={footerController.slashMenu}
        savePresetInput={footerController.savePresetInput}
        savePresetDialog={footerController.savePresetDialog}
        onInstructionChange={footerController.handleInstructionChange}
        onHistorySelect={footerController.handleHistorySelect}
      />
    </div>
  );
}

export default App;
