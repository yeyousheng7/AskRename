import { CheckIcon, LoaderIcon, Regex, SparklesIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PendingDecision } from '@/types/ai';

export function FooterPendingDecisionCard({
  pendingDecision,
  isApplying,
  onUpdatePendingRegex,
  onDiscardDecision,
  onConfirmDecision
}: {
  pendingDecision: Exclude<PendingDecision, null>;
  isApplying: boolean;
  onUpdatePendingRegex: (find: string, replace: string) => void;
  onDiscardDecision: () => void;
  onConfirmDecision: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50/80 to-blue-50/80 dark:from-purple-950/40 dark:to-blue-950/40 ring-1 ring-purple-200/50 dark:ring-purple-800/30">
      {pendingDecision.type === 'regex' ? (
        <>
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
            <Regex className="h-3.5 w-3.5" />
            AI 生成了正则规则，可编辑微调
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">查找</label>
              <input
                type="text"
                value={pendingDecision.find}
                onChange={(e) => onUpdatePendingRegex(e.target.value, pendingDecision.replace)}
                className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-600 outline-none transition-all"
                placeholder="正则表达式"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">替换</label>
              <input
                type="text"
                value={pendingDecision.replace}
                onChange={(e) => onUpdatePendingRegex(pendingDecision.find, e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-600 outline-none transition-all"
                placeholder="替换内容 (支持 ${i} 序号)"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
          <SparklesIcon className="h-3.5 w-3.5" />
          AI 已生成新文件名，预览已就绪
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <Button
          onClick={onDiscardDecision}
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          disabled={isApplying}
        >
          <XIcon className="mr-1 h-3.5 w-3.5" />
          放弃
        </Button>
        <Button
          onClick={onConfirmDecision}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isApplying}
        >
          {isApplying ? (
            <>
              <LoaderIcon className="mr-1 h-3.5 w-3.5 animate-spin" />
              应用中...
            </>
          ) : (
            <>
              <CheckIcon className="mr-1 h-3.5 w-3.5" />
              确认应用
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
