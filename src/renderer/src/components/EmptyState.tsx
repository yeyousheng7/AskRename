import { FolderIcon, UploadIcon } from 'lucide-react';
import type { TargetMode } from '@/types/file';

export function EmptyState({ targetMode }: { targetMode: TargetMode }): React.JSX.Element {
  const isFolder = targetMode === 'folder';

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-500">
        <div
          className={
            isFolder
              ? 'rounded-full bg-amber-50 dark:bg-amber-900/30 p-6'
              : 'rounded-full bg-zinc-100 dark:bg-zinc-800 p-6'
          }
        >
          {isFolder ? (
            <FolderIcon className="h-12 w-12 text-amber-400 dark:text-amber-500" />
          ) : (
            <UploadIcon className="h-12 w-12" />
          )}
        </div>
        <div className="text-center">
          <p
            className={
              isFolder
                ? 'text-lg font-medium text-amber-500 dark:text-amber-400'
                : 'text-lg font-medium text-zinc-500 dark:text-zinc-400'
            }
          >
            {isFolder ? '请拖入文件夹...' : '拖入文件以开始重命名'}
          </p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            {isFolder ? '支持批量拖入多个文件夹' : '支持批量拖入多个文件'}
          </p>
        </div>
      </div>
    </div>
  );
}
