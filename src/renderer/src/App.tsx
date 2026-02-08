import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent
} from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SparklesIcon,
  UploadIcon,
  LoaderIcon,
  SquareIcon,
  CheckIcon,
  XIcon,
  Undo2Icon,
  WandIcon,
  SunIcon,
  MoonIcon
} from 'lucide-react';
import { useFileStore } from '@/hooks/useFileStore';
import { useTheme } from '@/hooks/useTheme';
import EditorRow from '@/components/EditorRow';
import { QUICK_ACTIONS, type QuickAction } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ============================================================================
// Toast 组件
// ============================================================================

type ToastType = 'success' | 'error';
type ToastAction = { label: string; onClick: () => void };
type ToastState = { message: string; type: ToastType; action?: ToastAction };

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  action?: ToastAction;
}

function Toast({ message, type, onClose, action }: ToastProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2',
        type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
      )}
    >
      {type === 'success' ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="ml-2 px-2 py-0.5 text-sm font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Empty State 组件
// ============================================================================

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-500">
        <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-6">
          <UploadIcon className="h-12 w-12" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
            拖入文件以开始重命名
          </p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">支持批量拖入多个文件</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Actions 下拉菜单
// ============================================================================

interface QuickActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRule: (handler: (name: string, index: number) => string) => void;
  onSelectAI: (prompt: string) => void;
}

function QuickActionsMenu({
  isOpen,
  onClose,
  onSelectRule,
  onSelectAI
}: QuickActionsMenuProps): React.JSX.Element | null {
  if (!isOpen) return null;

  const ruleActions = QUICK_ACTIONS.filter(
    (a): a is Extract<QuickAction, { type: 'rule' }> => a.type === 'rule'
  );
  const aiActions = QUICK_ACTIONS.filter(
    (a): a is Extract<QuickAction, { type: 'ai' }> => a.type === 'ai'
  );

  const sectionLabelClass =
    'text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide';
  const menuItemClass =
    'w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors';

  const handleClick = (action: QuickAction): void => {
    if (action.type === 'rule') {
      onSelectRule(action.handler);
    } else {
      onSelectAI(action.prompt);
    }
    onClose();
  };

  return (
    <>
      {/* 点击背景关闭 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* 菜单面板 */}
      <div className="absolute bottom-full left-0 mb-2 z-50 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 py-1 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
        {/* 规则类 */}
        <div className="px-2 py-1.5">
          <span className={sectionLabelClass}>规则转换</span>
        </div>
        {ruleActions.map((action) => (
          <button key={action.label} onClick={() => handleClick(action)} className={menuItemClass}>
            <action.icon className="h-4 w-4 text-zinc-400" />
            {action.label}
          </button>
        ))}

        {/* 分割线 */}
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

        {/* AI 类 */}
        <div className="px-2 py-1.5">
          <span className={sectionLabelClass}>AI 智能</span>
        </div>
        {aiActions.map((action) => (
          <button key={action.label} onClick={() => handleClick(action)} className={menuItemClass}>
            <action.icon className="h-4 w-4 text-purple-500" />
            {action.label}
            <SparklesIcon className="h-3 w-3 text-purple-400 ml-auto" />
          </button>
        ))}
      </div>
    </>
  );
}

// ============================================================================
// App 主组件
// ============================================================================

function App(): React.JSX.Element {
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const { resolvedTheme, toggleTheme } = useTheme();

  const {
    files,
    isRenaming,
    isApplying,
    isUndoing,
    hasChanges,
    canUndo,
    updateFileName,
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

  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // 是否处于审查模式（有待应用的更改）
  const isReviewMode = hasChanges && !isRenaming;

  // 显示 Toast
  const showToast = useCallback((message: string, type: ToastType, action?: ToastAction) => {
    setToast({ message, type, action });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    // 5秒后自动关闭（有操作按钮时给更多时间）
    toastTimerRef.current = window.setTimeout(() => setToast(null), action ? 5000 : 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

    setError(null);
    try {
      await startRenaming(instruction);
    } catch (err) {
      const message = err instanceof Error ? err.message : '重命名失败，请重试';
      setError(message);
      console.error('重命名失败:', err);
    }
  }, [instruction, isRenaming, files.length, startRenaming]);

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

  // 快捷指令 - 规则类
  const handleQuickRule = useCallback(
    (handler: (name: string, index: number) => string) => {
      applyRule(handler);
    },
    [applyRule]
  );

  // 快捷指令 - AI 类
  const handleQuickAI = useCallback((prompt: string) => {
    setInstruction(prompt);
    // 延迟聚焦确保状态更新
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRename();
      }
    },
    [handleRename]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const isEmpty = files.length === 0;

  return (
    <div
      className={cn(
        'flex h-screen w-screen flex-col bg-white dark:bg-zinc-950 transition-colors',
        isDragging && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onDrop={(e) => {
        setIsDragging(false);
        handleDrop(e);
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          action={toast.action}
        />
      )}

      {/* 拖放覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg m-2">
          <div className="flex flex-col items-center gap-3 text-blue-500">
            <UploadIcon className="h-16 w-16" />
            <p className="text-xl font-medium">释放以添加文件</p>
          </div>
        </div>
      )}

      {/* 表头 */}
      <div className="flex-shrink-0 grid grid-cols-[3rem_1fr_3rem_1fr_auto] border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="h-8 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800" />
        <div className="flex h-8 items-center border-r border-zinc-200 dark:border-zinc-800 px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            原始文本
          </span>
          {!isEmpty && (
            <span className="ml-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              ({files.length})
            </span>
          )}
        </div>
        <div className="h-8 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800" />
        <div className="flex h-8 items-center px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            预览文本
          </span>
          {isRenaming ? (
            <span className="ml-2 font-mono text-xs text-blue-500 flex items-center gap-1">
              <LoaderIcon className="h-3 w-3 animate-spin" />
              AI 生成中...
            </span>
          ) : hasChanges ? (
            <span className="ml-2 font-mono text-xs text-emerald-500">(待审查)</span>
          ) : (
            <span className="ml-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              (点击编辑)
            </span>
          )}
        </div>
        {/* 主题切换按钮 */}
        <div className="flex items-center px-2 bg-zinc-50 dark:bg-zinc-900">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            title={resolvedTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {resolvedTheme === 'dark' ? (
              <SunIcon className="h-4 w-4" />
            ) : (
              <MoonIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-h-full">
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
                isLoading={isRenaming}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 底部操作栏 */}
      <footer className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
        {error && (
          <div className="mb-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded">
            {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          {/* 撤销按钮 */}
          <Button
            onClick={handleUndo}
            size="icon"
            variant="outline"
            disabled={!canUndo || isUndoing || isApplying || isRenaming}
            title={canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
          >
            {isUndoing ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2Icon className="h-4 w-4" />
            )}
          </Button>

          {/* 快捷指令按钮 */}
          <div className="relative">
            <Button
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              size="icon"
              variant="ghost"
              className="text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              disabled={isEmpty || isRenaming || isApplying || isUndoing}
              title="快捷指令"
            >
              <WandIcon className="h-4 w-4" />
            </Button>
            <QuickActionsMenu
              isOpen={isQuickActionsOpen}
              onClose={() => setIsQuickActionsOpen(false)}
              onSelectRule={handleQuickRule}
              onSelectAI={handleQuickAI}
            />
          </div>

          <Input
            ref={inputRef}
            type="text"
            placeholder={
              isReviewMode
                ? '不满意？修改指令后按回车重新生成...'
                : '输入重命名指令，例如：将所有图片按日期命名...'
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 font-mono bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            disabled={isEmpty || isRenaming || isApplying || isUndoing}
          />

          {/* 审查模式：显示放弃和应用按钮 */}
          {isReviewMode ? (
            <>
              {/* 放弃更改按钮 */}
              <Button
                onClick={handleDiscard}
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                disabled={isApplying || isUndoing}
              >
                <XIcon className="mr-2 h-4 w-4" />
                放弃
              </Button>

              {/* 确认应用按钮 */}
              <Button
                onClick={handleApply}
                className="px-5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                disabled={isApplying || isUndoing}
              >
                {isApplying ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckIcon className="mr-2 h-4 w-4" />
                    确认应用
                  </>
                )}
              </Button>
            </>
          ) : (
            /* 输入模式：显示生成按钮 */
            <>
              {isRenaming ? (
                <Button onClick={stopRenaming} variant="destructive" className="px-5">
                  <SquareIcon className="mr-2 h-4 w-4" />
                  停止
                </Button>
              ) : (
                <Button
                  onClick={handleRename}
                  className="px-5"
                  disabled={isEmpty || !instruction.trim() || isApplying || isUndoing}
                >
                  <SparklesIcon className="mr-2 h-4 w-4" />
                  生成
                </Button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
