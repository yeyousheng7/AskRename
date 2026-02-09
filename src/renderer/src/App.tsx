import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileStore } from '@/hooks/useFileStore';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import EditorRow from '@/components/EditorRow';
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
import { electronApi } from '@/lib/electron-api';
import { generateAutoDecision } from '@/lib/ai-service';
import { batchApplyMagicRegex } from '@/lib/magic-regex';
import { cn } from '@/lib/utils';
import type { AISessionState, PendingDecision } from '@/types/ai';
import type { Mode } from '@/types/mode';
import type { SettingsTabId } from '@/types/settings';

// ============================================================================
// App 主组件
// ============================================================================

function App(): React.JSX.Element {
  // 模式状态：auto(智能) | ai(纯AI) | regex(纯正则)
  const [mode, setMode] = useState<Mode>('auto');

  // AI Session 状态：智能模式下的会话状态机
  const [aiSession, setAISession] = useState<AISessionState>('idle');
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>(null);

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

  const {
    files,
    highlightedIds,
    isRenaming,
    isApplying,
    isUndoing,
    hasChanges,
    canUndo,
    removeFile,
    updateFileName,
    batchUpdateFileNames,
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

  // 是否处于审查模式（有待应用的更改）
  const isReviewMode = hasChanges && !isRenaming;

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const originalNamesKey = files.map((f) => f.original).join('\u0000');

  // 正则实时预览引擎（支持魔法变量）
  useEffect(() => {
    if (mode !== 'regex') return;

    const currentFiles = filesRef.current;
    if (currentFiles.length === 0) return;

    const filenames = currentFiles.map((f) => f.original);
    const newNames = batchApplyMagicRegex(filenames, findPattern, replacePattern);

    batchUpdateFileNames(newNames);
  }, [mode, findPattern, replacePattern, originalNamesKey, batchUpdateFileNames]);

  // 模式切换处理
  const handleModeChange = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;

      // 切换时清空输入并重置预览
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

    const result = await undo();
    if (result.success) {
      showToast('撤销成功', 'success');
    } else {
      showToast(`撤销失败：${result.error}`, 'error');
    }
  }, [isUndoing, undo, showToast]);
  const handleUndoEvent = useEvent(handleUndo);

  // AI 生成处理
  const handleRename = useCallback(async () => {
    if (isRenaming || files.length === 0 || !instruction.trim()) return;

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
    addToHistory(instruction);
    try {
      await startRenaming(instruction, {
        provider: settings.provider,
        apiKey: apiKeyToUse,
        baseURL: settings.baseUrl,
        model: settings.model
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '重命名失败，请重试';
      setError(message);
      console.error('重命名失败:', err);
    }
  }, [
    instruction,
    isRenaming,
    files.length,
    promptConfigureApiKey,
    settings,
    startRenaming,
    updateSettings,
    addToHistory
  ]);

  // Auto 模式：AI 决策引擎
  const handleAutoRename = useCallback(async () => {
    if (aiSession === 'loading' || files.length === 0 || !instruction.trim()) return;

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
    setAISession('loading');
    setInstruction('');
    setError(null);

    try {
      // 调用 AI 获取决策
      const fileNames = files.map((f) => f.original);
      const decision = await generateAutoDecision(fileNames, instruction, {
        provider: settings.provider,
        apiKey: apiKeyToUse,
        baseURL: settings.baseUrl,
        model: settings.model
      });

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
          // 文件超过样本数，需要完整 AI 处理（回退到 startRenaming）
          setAISession('idle');
          await startRenaming(instruction, {
            provider: settings.provider,
            apiKey: apiKeyToUse,
            baseURL: settings.baseUrl,
            model: settings.model
          });
        } else {
          // 文件数在样本范围内，直接使用返回结果
          setPendingDecision(decision);
          batchUpdateFileNames(decision.names);
          setAISession('review');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 决策失败，请重试';
      setError(message);
      setAISession('idle');
      console.error('Auto rename failed:', err);
    }
  }, [
    instruction,
    aiSession,
    files,
    promptConfigureApiKey,
    settings,
    updateSettings,
    startRenaming,
    batchUpdateFileNames,
    addToHistory
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

  const { isDragging, rootProps } = useFileDragOverlay(handleDrop);

  const isEmpty = files.length === 0;

  return (
    <div
      className={cn(
        'flex h-screen w-screen flex-col bg-white dark:bg-zinc-950 transition-colors',
        isDragging && 'bg-blue-50/50 dark:bg-blue-950/20'
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
      {isDragging && <FileDropOverlay />}

      {/* 表头 */}
      <AppHeader
        filesLength={files.length}
        isEmpty={isEmpty}
        isRenaming={isRenaming}
        hasChanges={hasChanges}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => {
          setSettingsForcedTab(null);
          void openSettings();
        }}
      />

      {/* 文件列表 */}
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-h-full pb-32">
            {files.map((file, index) => (
              <EditorRow
                key={file.id}
                file={file}
                index={index}
                filesLength={files.length}
                editingIndex={editingIndex}
                setEditingIndex={setEditingIndex}
                onRename={updateFileName}
                onRevert={revertFileName}
                onRemove={removeFile}
                isLoading={isRenaming}
                isHighlighted={highlightedIds.has(file.id)}
              />
            ))}
          </div>
        </ScrollArea>
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
        isRenaming={isRenaming}
        isApplying={isApplying}
        isUndoing={isUndoing}
        canUndo={canUndo}
        aiSession={aiSession}
        pendingDecision={pendingDecision}
        onConfirmDecision={() => void handleConfirmDecision()}
        onDiscardDecision={handleDiscardDecision}
        onUpdatePendingRegex={handleUpdatePendingRegex}
        onInstructionChange={(next) => setInstruction(next)}
        onFindPatternChange={(next) => setFindPattern(next)}
        onReplacePatternChange={(next) => setReplacePattern(next)}
        onUndo={() => void handleUndoEvent()}
        onDiscard={handleDiscard}
        onApply={() => void handleApply()}
        onStop={stopRenaming}
        onGenerate={() => void (mode === 'auto' ? handleAutoRename() : handleRename())}
        showToast={showToast}
        history={history}
        onSelectHistory={handleSelectHistory}
      />
    </div>
  );
}

export default App;
