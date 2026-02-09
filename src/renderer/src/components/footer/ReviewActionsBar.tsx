import { CheckIcon, LoaderIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FooterReviewActionsBar({
  isApplying,
  isUndoing,
  onDiscard,
  onApply
}: {
  isApplying: boolean;
  isUndoing: boolean;
  onDiscard: () => void;
  onApply: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-0">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">预览已就绪，确认应用更改？</span>
      <div className="flex gap-2">
        <Button
          onClick={onDiscard}
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={isApplying || isUndoing}
        >
          <XIcon className="mr-1.5 h-3.5 w-3.5" />
          放弃
        </Button>
        <Button
          onClick={onApply}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isApplying || isUndoing}
        >
          {isApplying ? (
            <>
              <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              应用中...
            </>
          ) : (
            <>
              <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
              确认应用
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
