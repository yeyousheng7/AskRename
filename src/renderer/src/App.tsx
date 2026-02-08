import { useState, useCallback, type DragEvent, type KeyboardEvent } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SparklesIcon, UploadIcon, LoaderIcon, SquareIcon, CheckIcon, XIcon } from 'lucide-react';
import { useFileStore } from '@/hooks/useFileStore';
import EditorRow from '@/components/EditorRow';

// ============================================================================
// Toast 组件
// ============================================================================

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps): React.JSX.Element {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2 ${
        type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
      }`}
    >
      {type === 'success' ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
      <span className="text-sm font-medium">{message}</span>
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
      <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-500">
        <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-6">
          <UploadIcon className="h-12 w-12" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
            拖入文件以开始重命名
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">支持批量拖入多个文件</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// App 主组件
// ============================================================================

function App(): React.JSX.Element {
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const {
    files,
    isRenaming,
    isApplying,
    hasChanges,
    updateFileName,
    handleDrop,
    startRenaming,
    stopRenaming,
    applyRename,
    resetAfterApply
  } = useFileStore();

  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // 显示 Toast
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    // 3秒后自动关闭
    setTimeout(() => setToast(null), 3000);
  }, []);

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
        showToast(`成功重命名 ${result.successCount} 个文件`, 'success');
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
  }, [isApplying, hasChanges, applyRename, resetAfterApply, showToast]);

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
      className={`flex h-screen w-screen flex-col bg-white dark:bg-slate-950 transition-colors ${isDragging ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
      onDrop={(e) => {
        setIsDragging(false);
        handleDrop(e);
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Toast 通知 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
      <div className="flex-shrink-0 grid grid-cols-[3rem_1fr_3rem_1fr] border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <div className="h-8 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" />
        <div className="flex h-8 items-center border-r border-slate-200 dark:border-slate-700 px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            原始文本
          </span>
          {!isEmpty && (
            <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
              ({files.length})
            </span>
          )}
        </div>
        <div className="h-8 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" />
        <div className="flex h-8 items-center px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            预览文本
          </span>
          {isRenaming ? (
            <span className="ml-2 font-mono text-xs text-blue-500 flex items-center gap-1">
              <LoaderIcon className="h-3 w-3 animate-spin" />
              AI 生成中...
            </span>
          ) : hasChanges ? (
            <span className="ml-2 font-mono text-xs text-emerald-500">(待应用)</span>
          ) : (
            <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
              (点击编辑)
            </span>
          )}
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
                isLoading={isRenaming}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 底部操作栏 */}
      <footer className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-3">
        {error && (
          <div className="mb-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded">
            {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="输入重命名指令，例如：将所有图片按日期命名..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-9 font-mono text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-blue-400 focus:ring-blue-400/20"
            disabled={isEmpty || isRenaming || isApplying}
          />

          {isRenaming ? (
            <Button
              onClick={stopRenaming}
              size="default"
              variant="destructive"
              className="h-9 px-5 text-sm font-medium"
            >
              <SquareIcon className="mr-2 h-4 w-4" />
              停止
            </Button>
          ) : (
            <Button
              onClick={handleRename}
              size="default"
              className="h-9 px-5 text-sm font-medium"
              disabled={isEmpty || !instruction.trim() || isApplying}
            >
              <SparklesIcon className="mr-2 h-4 w-4" />
              生成
            </Button>
          )}

          {/* 应用按钮 */}
          <Button
            onClick={handleApply}
            size="default"
            variant={hasChanges ? 'default' : 'outline'}
            className={`h-9 px-5 text-sm font-medium ${
              hasChanges ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
            }`}
            disabled={isEmpty || !hasChanges || isRenaming || isApplying}
          >
            {isApplying ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                应用中...
              </>
            ) : (
              <>
                <CheckIcon className="mr-2 h-4 w-4" />
                应用
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default App;
