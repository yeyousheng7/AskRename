import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { diffChars } from 'diff';
import TextareaAutosize from 'react-textarea-autosize';
import { Undo2 } from 'lucide-react';
import type { FileItem } from '@/types/file';

const textStyles = 'font-mono text-sm leading-6';

function DiffRemovedText({
  original,
  renamed
}: {
  original: string;
  renamed: string;
}): React.JSX.Element {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed]);

  return (
    <span className={textStyles}>
      {parts.map((part, index) => {
        if (part.added) {
          return null;
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-600 line-through decoration-red-300 dark:bg-red-950/50 dark:text-red-400"
            >
              {part.value}
            </span>
          );
        }
        return (
          <span key={index} className="text-zinc-600 dark:text-zinc-400">
            {part.value}
          </span>
        );
      })}
    </span>
  );
}

function DiffAddedText({
  original,
  renamed,
  onClick
}: {
  original: string;
  renamed: string;
  onClick: () => void;
}): React.JSX.Element {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed]);

  return (
    <div
      className={`${textStyles} min-h-6 cursor-text text-zinc-800 dark:text-zinc-200`}
      onClick={onClick}
    >
      {parts.map((part, index) => {
        if (part.removed) {
          return null;
        }
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
      {renamed.length === 0 && (
        <span className="text-zinc-300 dark:text-zinc-600 italic">点击编辑...</span>
      )}
    </div>
  );
}

export type EditorRowProps = {
  file: FileItem;
  index: number;
  filesLength: number;
  editingIndex: number | null;
  setEditingIndex: (next: number | null) => void;
  onRename: (id: string, newName: string) => void;
  onRevert?: (index: number) => void;
  isLoading?: boolean;
};

export default function EditorRow({
  file,
  index,
  filesLength,
  editingIndex,
  setEditingIndex,
  onRename,
  onRevert,
  isLoading = false
}: EditorRowProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  // 检查该行是否有修改
  const hasChange = file.original !== file.renamed;

  const stopEditing = useCallback(() => {
    setEditingIndex(null);
  }, [setEditingIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        stopEditing();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing();
        return;
      }

      if (selectionStart !== selectionEnd) return;

      if (e.key === 'ArrowUp') {
        const textBeforeCursor = value.substring(0, selectionStart);
        const isFirstLine = !textBeforeCursor.includes('\n');

        if (isFirstLine && index > 0) {
          e.preventDefault();
          setEditingIndex(index - 1);
        }
      } else if (e.key === 'ArrowDown') {
        const textAfterCursor = value.substring(selectionStart);
        const isLastLine = !textAfterCursor.includes('\n');

        if (isLastLine && index < filesLength - 1) {
          e.preventDefault();
          setEditingIndex(index + 1);
        }
      }
    },
    [filesLength, index, setEditingIndex, stopEditing]
  );

  const handleRevert = useCallback(() => {
    if (onRevert) {
      onRevert(index);
    }
  }, [onRevert, index]);

  return (
    <div
      className={`grid grid-cols-[3rem_1fr_3rem_1fr] border-b border-zinc-100 dark:border-zinc-800 transition-colors ${isHovered ? 'bg-blue-50/80 dark:bg-blue-950/20' : ''
        }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-end border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 pr-3 py-1.5">
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 select-none leading-6">
          {index + 1}
        </span>
      </div>

      <div className="border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-1.5">
        <DiffRemovedText original={file.original} renamed={file.renamed} />
      </div>

      {/* 中间列：行号 / 重置按钮 */}
      <div className="flex items-start justify-center border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-1.5">
        {hasChange && onRevert ? (
          <button
            onClick={handleRevert}
            className="p-1 rounded text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
            title="还原为原始文件名"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        ) : (
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 select-none leading-6">
            {index + 1}
          </span>
        )}
      </div>

      <div className="px-3 py-1.5 bg-white dark:bg-zinc-950">
        {isLoading ? (
          <div className="flex items-center h-6">
            <div className="h-4 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 rounded animate-pulse w-3/4" />
          </div>
        ) : editingIndex === index ? (
          <TextareaAutosize
            value={file.renamed}
            onChange={(e) => onRename(file.id, e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={stopEditing}
            autoFocus
            className={`w-full bg-transparent resize-none focus:outline-none ${textStyles} text-zinc-800 dark:text-zinc-200`}
            minRows={1}
          />
        ) : (
          <DiffAddedText
            original={file.original}
            renamed={file.renamed}
            onClick={() => setEditingIndex(index)}
          />
        )}
      </div>
    </div>
  );
}
