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
import { useFileDragOverlay } from '@/hooks/useFileDragOverlay';
import { electronApi } from '@/lib/electron-api';
import { generateAutoDecision } from '@/lib/ai-service';
import { batchApplyMagicRegex } from '@/lib/magic-regex';
import { cn } from '@/lib/utils';

// ============================================================================
// App 主组件
// ============================================================================

function App(): React.JSX.Element {
  // 模式状态：auto(智能) | ai(纯AI) | regex(纯正则)
  const [mode, setMode] = useState<'auto' | 'ai' | 'regex'>('auto');

  // AI 模式状态
  const [instruction, setInstruction] = useState('');

  // 正则模式状态
  const [findPattern, setFindPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const { resolvedTheme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { toast, showToast, dismissToast } = useToast();

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
    applyRule,
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

  // 正则实时预览引擎（支持魔法变量）
  useEffect(() => {
    if (mode !== 'regex' || files.length === 0) return;

    const filenames = files.map((f) => f.original);
    const newNames = batchApplyMagicRegex(filenames, findPattern, replacePattern);

    batchUpdateFileNames(newNames);
  }, [mode, findPattern, replacePattern, files.length, batchUpdateFileNames]);

  // 模式切换处理
  const handleModeChange = useCallback(
    (newMode: 'auto' | 'ai' | 'regex') => {
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

  // 撤销处理
  const handleUndo = useCallback(async () => {
    if (isUndoing || !canUndo) return;

    const result = await undo();
    if (result.success) {
      showToast('撤销成功', 'success');
    } else {
      showToast(`撤销失败：${result.error}`, 'error');
    }
  }, [isUndoing, canUndo, undo, showToast]);

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
        void openSettings();
        showToast('请先配置 API Key', 'error');
        return;
      }

      updateSettings({ apiKey: apiKeyToUse });
    }

    setError(null);
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
    openSettings,
    settings,
    showToast,
    startRenaming,
    updateSettings
  ]);

  // Auto 模式：AI 决策引擎
  const handleAutoRename = useCallback(async () => {
    if (isRenaming || files.length === 0 || !instruction.trim()) return;

    // 获取 API Key
    let apiKeyToUse = settings.apiKey.trim();
    if (settings.provider !== 'ollama' && !apiKeyToUse) {
      try {
        apiKeyToUse = ((await electronApi.getApiKey(settings.provider)) || '').trim();
      } catch (err) {
        console.error('Failed to load api key:', err);
      }

      if (!apiKeyToUse) {
        void openSettings();
        showToast('请先配置 API Key', 'error');
        return;
      }

      updateSettings({ apiKey: apiKeyToUse });
    }

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
        // AI 决定使用正则：切换到正则模式并填入规则
        setMode('regex');
        setFindPattern(decision.find);
        setReplacePattern(decision.replace);
        showToast('✨ 已自动转换为正则规则，可手动修改', 'success');
      } else {
        // AI 返回文件名列表：由于只发送了样本，需要对剩余文件再次调用 AI
        // 简化处理：如果文件数超过样本数，回退到完整 AI 模式
        if (files.length > 20) {
          // 文件超过样本数，需要完整 AI 处理
          await startRenaming(instruction, {
            provider: settings.provider,
            apiKey: apiKeyToUse,
            baseURL: settings.baseUrl,
            model: settings.model
          });
        } else {
          // 文件数在样本范围内，直接使用返回结果
          batchUpdateFileNames(decision.names);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 决策失败，请重试';
      setError(message);
      console.error('Auto rename failed:', err);
    }
  }, [
    instruction,
    isRenaming,
    files,
    openSettings,
    settings,
    showToast,
    updateSettings,
    startRenaming,
    batchUpdateFileNames
  ]);

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
          onClick: handleUndo
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
  }, [isApplying, hasChanges, applyRename, resetAfterApply, showToast, handleUndo]);

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

      <SettingsDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
      />

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
        onOpenSettings={() => void openSettings()}
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
        onInstructionChange={(next) => setInstruction(next)}
        onFindPatternChange={(next) => setFindPattern(next)}
        onReplacePatternChange={(next) => setReplacePattern(next)}
        onUndo={() => void handleUndo()}
        onQuickRule={(handler) => applyRule(handler)}
        onQuickAI={(prompt) => setInstruction(prompt)}
        onDiscard={handleDiscard}
        onApply={() => void handleApply()}
        onStop={stopRenaming}
        onGenerate={() => void (mode === 'auto' ? handleAutoRename() : handleRename())}
      />
    </div>
  );
}

export default App;
