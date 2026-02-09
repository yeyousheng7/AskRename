import { CheckIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToastAction, ToastType } from '@/hooks/useToast';

export function Toast({
  message,
  type,
  onClose,
  action
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
  action?: ToastAction;
}): React.JSX.Element {
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
