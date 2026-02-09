import { SparklesIcon } from 'lucide-react';
import { QUICK_ACTIONS, type QuickAction } from '@/lib/constants';

export function QuickActionsMenu({
  isOpen,
  onClose,
  onSelectRule,
  onSelectAI
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectRule: (handler: (name: string, index: number) => string) => void;
  onSelectAI: (prompt: string) => void;
}): React.JSX.Element | null {
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
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute bottom-full left-0 mb-2 z-50 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 py-1 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
        <div className="px-2 py-1.5">
          <span className={sectionLabelClass}>规则转换</span>
        </div>
        {ruleActions.map((action) => (
          <button key={action.label} onClick={() => handleClick(action)} className={menuItemClass}>
            <action.icon className="h-4 w-4 text-zinc-400" />
            {action.label}
          </button>
        ))}

        <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

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
