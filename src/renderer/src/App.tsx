import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileStore } from '@/hooks/useFileStore';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import FileList from '@/components/FileList';
import { ProgressOverlay } from '@/components/ProgressOverlay';
import { SmartWarningDialog } from '@/components/SmartWarningDialog';
import { PaginationBar } from '@/components/PaginationBar';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Toast } from '@/components/Toast';
import { FileDropOverlay } from '@/components/FileDropOverlay';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { useToast } from '@/hooks/useToast';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useFileDragOverlay } from '@/hooks/useFileDragOverlay';
import { useEvent } from '@/hooks/useEvent';
import { useBatchAI } from '@/hooks/useBatchAI';
import { electronApi } from '@/lib/electron-api';
import { generateAutoDecision, getConfigFromEnv } from '@/lib/ai-service';
import { generateRegexFromDescription } from '@/lib/regex-assist';
import { batchApplyMagicRegex } from '@/lib/magic-regex';
import { cn } from '@/lib/utils';
import type { AISessionState, PendingDecision } from '@/types/ai';
import type { Mode } from '@/types/mode';
import type { SettingsTabId } from '@/types/settings';

// ============================================================================
// App 主组件
// ============================================================================

function hasMagicIndexVars(text: string): boolean {
  return /\$\{i(?:0|00|000)?\}/.test(text);
}

const PAGINATION_THRESHOLD = 100;
const DEFAULT_PAGE_SIZE = 50;

function App(): React.JSX.Element {
  // 模式状态：auto(智能) | ai(纯AI) | regex(纯正则)
  const [mode, setMode] = useState<Mode>('auto');

  // AI Session 状态：智能模式下的会话状态机
  const [aiSession, setAISession] = useState<AISessionState>('idle');
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>(null);
  const autoDecisionRequestIdRef = useRef<string | null>(null);

  // AI 模式状态
  const [instruction, setInstruction] = useState('');

  // 正则模式状态
  const [findPattern, setFindPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsOpenTimerRef = useRef<number | null>(null);
  const [settingsForcedTab, setSettingsForcedTab] = useState<SettingsTabId | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { resolvedTheme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast, showToast, dismissToast } = useToast();
  const { history, addToHistory } = useSessionHistory();
  const batchAI = useBatchAI();

  const {
    files,
    highlightedIds,
    targetMode,
    isRenaming,
    isApplying,
    isUndoing,
    hasChanges,
    canUndo,
    setTargetMode,
    removeFile,
    reorderFiles,
    updateFileName,
    batchUpdateFileNames,
    clearFiles,
    discardChanges,
    revertFileName,
    handleDrop,
    startRenaming,
    stopRenaming,
    applyRename,
    resetAfterApply,
    undo
  } = useFileStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // 是否处于审查模式（有待应用的更改）
  const isReviewMode = hasChanges && !isRenaming && batchAI.status === 'idle';
  const isAutoDecisionLoading = mode === 'auto' && aiSession === 'loading';

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const stableOriginalNamesKey = files
    .map((f) => `${f.id}:${f.original}`)
    .sort()
    .join('\u0000');

  // 正则实时预览引擎（支持魔法变量）
  useEffect(() => {
    if (mode !== 'regex') return;

    const currentFiles = filesRef.current;
    if (currentFiles.length === 0) return;

    const filenames = currentFiles.map((f) => f.original);
    const newNames = batchApplyMagicRegex(filenames, findPattern, replacePattern);

    batchUpdateFileNames(newNames);
  }, [mode, findPattern, replacePattern, stableOriginalNamesKey, batchUpdateFileNames]);

  const [reorderNonce, setReorderNonce] = useState(0);
  const handleAfterReorder = useCallback(() => {
    setReorderNonce((prev) => prev + 1);
  }, []);

  const recomputeIfMagicEnabledAfterReorder = useCallback(() => {
    if (files.length === 0) return;

    if (mode === 'regex') {
      if (!hasMagicIndexVars(replacePattern)) return;
      const originals = files.map((f) => f.original);
      const newNames = batchApplyMagicRegex(originals, findPattern, replacePattern);
      batchUpdateFileNames(newNames);
      return;
    }

    if (aiSession === 'review' && pendingDecision?.type === 'regex') {
      if (!hasMagicIndexVars(pendingDecision.replace)) return;
      const originals = files.map((f) => f.original);
      const newNames = batchApplyMagicRegex(
        originals,
        pendingDecision.find,
        pendingDecision.replace
      );
      batchUpdateFileNames(newNames);
    }
  }, [files, mode, replacePattern, findPattern, batchUpdateFileNames, aiSession, pendingDecision]);

  useEffect(() => {
    if (reorderNonce === 0) return;
    recomputeIfMagicEnabledAfterReorder();
  }, [reorderNonce, recomputeIfMagicEnabledAfterReorder]);

  // 模式切换处理
  const handleModeChange = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;

      const autoDecisionRequestId = autoDecisionRequestIdRef.current;
      if (autoDecisionRequestId) {
        autoDecisionRequestIdRef.current = null;
        void electronApi.cancelAI(autoDecisionRequestId).catch(() => undefined);
      }

      // 切换时清空输入并重置预览
      pendingAiContinueRef.current = null;
      pendingAiInstructionSnapshotRef.current = '';
      setAISession('idle');
      setPendingDecision(null);
      setInstruction('');
      setFindPattern('');
      setReplacePattern('');
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
      if (aiSession === 'review') {
        setPendingDecision(null);
        setAISession('idle');
      }
      showToast('已撤回预览更改', 'success');
      return;
    }

    const result = await undo();
    if (result.success) {
      showToast('撤销成功', 'success');
    } else {
      showToast(`撤销失败：${result.error}`, 'error');
    }
  }, [aiSession, canUndo, discardChanges, hasChanges, isUndoing, undo, showToast]);
  const handleUndoEvent = useEvent(handleUndo);

  const [isLargeAiWarningOpen, setIsLargeAiWarningOpen] = useState(false);
  const pendingAiContinueRef = useRef<(() => void) | null>(null);
  const pendingAiInstructionSnapshotRef = useRef<string>('');

  // AI 生成处理
  const doRename = useCallback(
    async (instructionText: string) => {
      const trimmedInstruction = instructionText.trim();
      if (mode !== 'ai') return;
    if (
      isRenaming ||
      batchAI.status === 'processing' ||
      files.length === 0 ||
        !trimmedInstruction
    ) {
      return;
    }

    let apiKeyToUse = settings.apiKey.trim();
    if (settings.provider !== 'ollama' && !apiKeyToUse) {
      try {
        apiKeyToUse = ((await electronApi.getApiKey(settings.provider)) || '').trim();
      } catch (err) {
        console.error('Failed to load api key:', err);
      }

      if (!apiKeyToUse) {
        promptConfigureApiKey();
        return;
      }

      updateSettings({ apiKey: apiKeyToUse });
    }

    setError(null);
      addToHistory(trimmedInstruction);
    try {
      if (files.length > 20) {
        const envCfg = getConfigFromEnv();
        const baseURL = settings.baseUrl.trim();
        const model = settings.model.trim();
        if (!baseURL) throw new Error('API Base URL 未配置');
        if (!model) throw new Error('模型名称未配置');

        batchAI.start({
          items: files.map((f) => ({ id: f.id, original: f.original })),
            instruction: trimmedInstruction,
          settings: {
            provider: settings.provider,
            apiKey: apiKeyToUse,
            baseURL,
            model,
            jsonMode: envCfg.jsonMode,
            maxTokens: envCfg.maxTokens
          },
          onBatchApplied: ({ items, resultNames }) => {
            items.forEach((it, i) => updateFileName(it.id, resultNames[i] || ''));
          }
        });
      } else {
          await startRenaming(trimmedInstruction, {
          provider: settings.provider,
          apiKey: apiKeyToUse,
          baseURL: settings.baseUrl,
          model: settings.model
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '重命名失败，请重试';
      setError(message);
      console.error('重命名失败:', err);
    }
    },
    [
      mode,
      isRenaming,
      batchAI,
      files,
      promptConfigureApiKey,
      settings,
      startRenaming,
      updateSettings,
      addToHistory,
      updateFileName
    ]
  );

  const handleRename = useCallback(async () => {
    if (mode !== 'ai') return;
    if (
      isRenaming ||
      batchAI.status === 'processing' ||
      files.length === 0 ||
      !instruction.trim()
    ) {
      return;
    }

    const snapshot = instruction;

    if (files.length > 50) {
      pendingAiInstructionSnapshotRef.current = snapshot;
      pendingAiContinueRef.current = () => void doRename(snapshot);
      setInstruction('');
      setIsLargeAiWarningOpen(true);
      return;
    }

    setInstruction('');
    await doRename(snapshot);
  }, [mode, isRenaming, batchAI.status, files.length, instruction, doRename]);

  // Auto 模式：AI 决策引擎
  const handleAutoRename = useCallback(async () => {
    if (
      aiSession === 'loading' ||
      batchAI.status === 'processing' ||
      files.length === 0 ||
      !instruction.trim()
    ) {
      return;
    }

    // 获取 API Key
    let apiKeyToUse = settings.apiKey.trim();
    if (settings.provider !== 'ollama' && !apiKeyToUse) {
      try {
        apiKeyToUse = ((await electronApi.getApiKey(settings.provider)) || '').trim();
      } catch (err) {
        console.error('Failed to load api key:', err);
      }

      if (!apiKeyToUse) {
        promptConfigureApiKey();
        return;
      }

      updateSettings({ apiKey: apiKeyToUse });
    }

    // 记录指令到历史（在清空前）
    addToHistory(instruction);

    // 立即反馈：清空输入框，设置 loading 状态
    const requestId = `auto:decision:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    autoDecisionRequestIdRef.current = requestId;
    setAISession('loading');
    setInstruction('');
    setError(null);

    try {
      // 调用 AI 获取决策
      const fileNames = files.map((f) => f.original);
      const decision = await generateAutoDecision(
        fileNames,
        instruction,
        {
          provider: settings.provider,
          apiKey: apiKeyToUse,
          baseURL: settings.baseUrl,
          model: settings.model
        },
        requestId
      );

      if (autoDecisionRequestIdRef.current !== requestId) return;
      autoDecisionRequestIdRef.current = null;

      if (decision.type === 'regex') {
        // AI 决定使用正则：【不切换模式】，存入 pendingDecision，应用预览
        setPendingDecision(decision);
        // 应用正则预览
        const newNames = batchApplyMagicRegex(fileNames, decision.find, decision.replace);
        batchUpdateFileNames(newNames);
        setAISession('review');
      } else {
        // AI 返回文件名列表
        if (files.length > 20) {
          // 文件超过样本数，需要完整 AI 处理（使用批处理）
          setAISession('idle');

          const envCfg = getConfigFromEnv();
          const baseURL = settings.baseUrl.trim();
          const model = settings.model.trim();
          if (!baseURL) throw new Error('API Base URL 未配置');
          if (!model) throw new Error('模型名称未配置');

          batchAI.start({
            items: files.map((f) => ({ id: f.id, original: f.original })),
            instruction,
            settings: {
              provider: settings.provider,
              apiKey: apiKeyToUse,
              baseURL,
              model,
              jsonMode: envCfg.jsonMode,
              maxTokens: envCfg.maxTokens
            },
            onBatchApplied: ({ items, resultNames }) => {
              items.forEach((it, i) => updateFileName(it.id, resultNames[i] || ''));
            }
          });
        } else {
          // 文件数在样本范围内，直接使用返回结果
          setPendingDecision(decision);
          batchUpdateFileNames(decision.names);
          setAISession('review');
        }
      }
    } catch (err) {
      if (autoDecisionRequestIdRef.current !== requestId) return;
      autoDecisionRequestIdRef.current = null;
      const message = err instanceof Error ? err.message : 'AI 决策失败，请重试';
      setError(message);
      setAISession('idle');
      console.error('Auto rename failed:', err);
    }
  }, [
    instruction,
    aiSession,
    batchAI,
    files,
    promptConfigureApiKey,
    settings,
    updateSettings,
    batchUpdateFileNames,
    addToHistory,
    updateFileName
  ]);

  // 放弃 AI 决策
  const handleDiscardDecision = useCallback(() => {
    if (aiSession !== 'review') return;
    discardChanges();
    setPendingDecision(null);
    setAISession('idle');
  }, [aiSession, discardChanges]);

  // 更新待定的正则规则（用于 Action Card 编辑）
  const handleUpdatePendingRegex = useCallback(
    (find: string, replace: string) => {
      if (pendingDecision?.type !== 'regex') return;
      setPendingDecision({ type: 'regex', find, replace });
      // 实时预览
      const fileNames = files.map((f) => f.original);
      const newNames = batchApplyMagicRegex(fileNames, find, replace);
      batchUpdateFileNames(newNames);
    },
    [pendingDecision, files, batchUpdateFileNames]
  );

  // 放弃更改
  const handleDiscard = useCallback(() => {
    discardChanges();
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
        setInstruction('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '应用失败，请重试';
      setError(message);
      showToast(message, 'error');
      console.error('应用失败:', err);
    }
  }, [isApplying, hasChanges, applyRename, resetAfterApply, showToast, handleUndoEvent]);

  // 确认应用 AI 决策
  const handleConfirmDecision = useCallback(async () => {
    if (aiSession !== 'review' || !pendingDecision) return;
    await handleApply();
    setPendingDecision(null);
    setAISession('idle');
  }, [aiSession, pendingDecision, handleApply]);

  // 历史记录选择：填入输入框并聚焦
  const handleSelectHistory = useCallback((text: string) => {
    setInstruction(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleGenerateRegexAssist = useCallback(
    async (requirement: string): Promise<{ find: string; replace: string }> => {
      let apiKeyToUse = settings.apiKey.trim();

      if (settings.provider !== 'ollama' && !apiKeyToUse) {
        try {
          apiKeyToUse = ((await electronApi.getApiKey(settings.provider)) || '').trim();
        } catch (err) {
          console.error('Failed to load api key:', err);
        }

        if (!apiKeyToUse) {
          promptConfigureApiKey();
          throw new Error('请先配置 API Key 以继续');
        }

        updateSettings({ apiKey: apiKeyToUse });
      }

      const baseURL = settings.baseUrl.trim();
      const model = settings.model.trim();
      if (!baseURL) throw new Error('API Base URL 未配置');
      if (!model) throw new Error('模型名称未配置');

      const envCfg = getConfigFromEnv();
      return generateRegexFromDescription(requirement, {
        provider: settings.provider,
        apiKey: apiKeyToUse,
        baseURL,
        model,
        jsonMode: envCfg.jsonMode,
        maxTokens: envCfg.maxTokens
      });
    },
    [settings.apiKey, settings.baseUrl, settings.model, settings.provider, promptConfigureApiKey, updateSettings]
  );

  const { isDragging, rootProps } = useFileDragOverlay(handleDrop);

  const isEmpty = files.length === 0;
  const isPagingEnabled = files.length > PAGINATION_THRESHOLD && Number.isFinite(pageSize);
  const effectivePageSize = isPagingEnabled ? pageSize : files.length || 1;
  const pageCount = Math.max(1, Math.ceil(files.length / effectivePageSize));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = clampedPageIndex * effectivePageSize;
  const pageFiles = isPagingEnabled ? files.slice(pageStart, pageStart + effectivePageSize) : files;

  useEffect(() => {
    if (clampedPageIndex !== pageIndex) setPageIndex(clampedPageIndex);
  }, [clampedPageIndex, pageIndex]);

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

      <SmartWarningDialog
        open={isLargeAiWarningOpen}
        onClose={() => {
          if (pendingAiInstructionSnapshotRef.current) {
            setInstruction(pendingAiInstructionSnapshotRef.current);
            pendingAiInstructionSnapshotRef.current = '';
          }
          pendingAiContinueRef.current = null;
          setIsLargeAiWarningOpen(false);
        }}
        onContinue={() => {
          const fn = pendingAiContinueRef.current;
          pendingAiInstructionSnapshotRef.current = '';
          pendingAiContinueRef.current = null;
          setIsLargeAiWarningOpen(false);
          setInstruction('');
          fn?.();
        }}
        onSwitchMode={handleModeChange}
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

      {/* 拖放覆盖层 */}
      {isDragging && <FileDropOverlay targetMode={targetMode} />}

      {/* 表头 */}
      <AppHeader
        filesLength={files.length}
        isRenaming={isRenaming || batchAI.status === 'processing'}
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
              isLoading={isRenaming || isAutoDecisionLoading}
              isDisabled={
                isRenaming ||
                isAutoDecisionLoading ||
                isApplying ||
                isUndoing ||
                batchAI.status === 'processing'
              }
              animatePreview={mode !== 'regex'}
            />
          </ScrollArea>
        </>
      )}

      <AppFooter
        mode={mode}
        onModeChange={handleModeChange}
        error={error}
        instruction={instruction}
        findPattern={findPattern}
        replacePattern={replacePattern}
        inputRef={inputRef}
        isEmpty={isEmpty}
        isReviewMode={isReviewMode}
        isRenaming={isRenaming || batchAI.status === 'processing'}
        isApplying={isApplying}
        isUndoing={isUndoing}
        canUndo={canUndo}
        aiSession={aiSession}
        pendingDecision={pendingDecision}
        onConfirmDecision={() => void handleConfirmDecision()}
        onDiscardDecision={handleDiscardDecision}
        onUpdatePendingRegex={handleUpdatePendingRegex}
        onGenerateRegexAssist={handleGenerateRegexAssist}
        onInstructionChange={(next) => setInstruction(next)}
        onFindPatternChange={(next) => setFindPattern(next)}
        onReplacePatternChange={(next) => setReplacePattern(next)}
        onUndo={() => void handleUndoEvent()}
        onDiscard={handleDiscard}
        onApply={() => void handleApply()}
        onStop={() => {
          if (batchAI.status === 'processing') {
            batchAI.cancel();
            showToast('已取消任务', 'success');
            return;
          }
          const autoDecisionRequestId = autoDecisionRequestIdRef.current;
          if (aiSession === 'loading' && autoDecisionRequestId) {
            autoDecisionRequestIdRef.current = null;
            void electronApi.cancelAI(autoDecisionRequestId).catch(() => undefined);
            setAISession('idle');
            setPendingDecision(null);
            showToast('已取消生成', 'success');
            return;
          }
          stopRenaming();
        }}
        onGenerate={() => void (mode === 'auto' ? handleAutoRename() : handleRename())}
        showToast={showToast}
        history={history}
        onSelectHistory={handleSelectHistory}
      />
    </div>
  );
}

export default App;
