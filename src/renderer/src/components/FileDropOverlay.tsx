import { UploadIcon } from 'lucide-react';

export function FileDropOverlay(): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-blue-50/70 dark:bg-blue-950/30 backdrop-blur-[2px]" />
      <div className="absolute inset-3 rounded-xl border-2 border-dashed border-blue-400/70 dark:border-blue-500/50" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-blue-600 dark:text-blue-300">
          <UploadIcon className="h-16 w-16" />
          <p className="text-xl font-medium">释放以添加文件</p>
        </div>
      </div>
    </div>
  );
}
