import { UploadIcon } from 'lucide-react';

export function EmptyState(): React.JSX.Element {
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
