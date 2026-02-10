import { FolderIcon, UploadIcon } from 'lucide-react';
import type { TargetMode } from '@/types/file';

export function FileDropOverlay({ targetMode }: { targetMode: TargetMode }): React.JSX.Element {
  const isFolder = targetMode === 'folder';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className={
          isFolder
            ? 'absolute inset-0 bg-amber-50/70 dark:bg-amber-950/30 backdrop-blur-[2px]'
            : 'absolute inset-0 bg-blue-50/70 dark:bg-blue-950/30 backdrop-blur-[2px]'
        }
      />
      <div
        className={
          isFolder
            ? 'absolute inset-3 rounded-xl border-2 border-dashed border-amber-400/70 dark:border-amber-500/50'
            : 'absolute inset-3 rounded-xl border-2 border-dashed border-blue-400/70 dark:border-blue-500/50'
        }
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={
            isFolder
              ? 'flex flex-col items-center gap-3 text-amber-600 dark:text-amber-300'
              : 'flex flex-col items-center gap-3 text-blue-600 dark:text-blue-300'
          }
        >
          {isFolder ? <FolderIcon className="h-16 w-16" /> : <UploadIcon className="h-16 w-16" />}
          <p className="text-xl font-medium">{isFolder ? '释放以添加文件夹' : '释放以添加文件'}</p>
        </div>
      </div>
    </div>
  );
}
