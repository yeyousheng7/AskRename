import type { ReactNode } from 'react';
import { CheckIcon, LoaderIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FloatingPreviewVariant = 'purple';

const variantClassMap: Record<FloatingPreviewVariant, string> = {
  purple:
    'bg-gradient-to-br from-purple-50/80 to-blue-50/80 dark:from-purple-950/40 dark:to-blue-950/40 ring-1 ring-purple-200/50 dark:ring-purple-800/30'
};

export function FloatingPreviewBar({
  title,
  content,
  icon,
  onConfirm,
  onCancel,
  isLoading,
  variant = 'purple',
  confirmText = '确认应用',
  loadingText = '应用中...',
  cancelText = '放弃',
  className
}: {
  title: ReactNode;
  content?: ReactNode;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  variant?: FloatingPreviewVariant;
  confirmText?: ReactNode;
  loadingText?: ReactNode;
  cancelText?: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('mx-3 mt-3 p-3 rounded-xl', variantClassMap[variant], className)}>
      <div className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
        {icon}
        {title}
      </div>

      {content ? <div className="mt-2">{content}</div> : null}

      <div className="flex justify-end gap-2 mt-3">
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          disabled={isLoading}
        >
          <XIcon className="mr-1 h-3.5 w-3.5" />
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <LoaderIcon className="mr-1 h-3.5 w-3.5 animate-spin" />
              {loadingText}
            </>
          ) : (
            <>
              <CheckIcon className="mr-1 h-3.5 w-3.5" />
              {confirmText}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
