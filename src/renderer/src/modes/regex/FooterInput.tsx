import { LoaderIcon, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FooterInputProps } from '@/modes/contracts';
import { generateRegexFromDescription } from './regex-assist';

export interface RegexPayload {
  findPattern: string;
  replacePattern: string;
}

function isRegexPayload(payload: unknown): payload is RegexPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Record<string, unknown>;
  return typeof value.findPattern === 'string' && typeof value.replacePattern === 'string';
}

export function RegexFooterInput({
  isDisabled,
  isEmpty,
  payload,
  onPayloadChange,
  onSubmit,
  showToast,
  getAIConfig
}: FooterInputProps): React.JSX.Element {
  const safePayload: RegexPayload = isRegexPayload(payload)
    ? payload
    : { findPattern: '', replacePattern: '' };

  const [isAssistMode, setIsAssistMode] = useState(false);
  const [assistText, setAssistText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const assistInputRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  const submitAssist = (): void => {
    if (isLoading) return;
    const requirement = assistText.trim();
    if (!requirement) {
      showToast('请先描述你的规则需求', 'error');
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    void (async () => {
      try {
        const aiConfig = getAIConfig ? await getAIConfig() : undefined;
        const result = await generateRegexFromDescription(
          requirement,
          aiConfig
            ? {
                provider: aiConfig.provider,
                apiKey: aiConfig.apiKey,
                baseURL: aiConfig.baseURL,
                model: aiConfig.model,
                jsonMode: aiConfig.jsonMode,
                maxTokens: aiConfig.maxTokens
              }
            : undefined
        );
        if (requestIdRef.current !== requestId) return;
        onPayloadChange({ findPattern: result.find, replacePattern: result.replace });
        setIsAssistMode(false);
        setAssistText('');
        window.setTimeout(() => findInputRef.current?.focus(), 0);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        showToast(err instanceof Error ? err.message : '规则生成失败', 'error');
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (!isAssistMode) return;
    const t = window.setTimeout(() => assistInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isAssistMode]);

  return (
    <div className="h-full flex flex-col">
      {isAssistMode ? (
        <div className="h-full flex items-center px-4">
          <div className="relative flex-1">
            <input
              ref={assistInputRef}
              type="text"
              placeholder="描述你想要的规则..."
              value={assistText}
              onChange={(e) => setAssistText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  requestIdRef.current += 1;
                  setIsLoading(false);
                  setIsAssistMode(false);
                  setAssistText('');
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitAssist();
                }
              }}
              disabled={isEmpty || isDisabled || isLoading}
              className={cn(
                'w-full px-0 pr-12 py-3 bg-transparent border-0 outline-none',
                'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                'font-mono text-sm'
              )}
            />
            <button
              type="button"
              onClick={submitAssist}
              disabled={isEmpty || isDisabled || isLoading}
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded-md',
                'text-zinc-400 hover:text-amber-500 hover:bg-amber-50',
                'dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/30',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              title={isLoading ? '生成中...' : '生成规则'}
            >
              {isLoading ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1">
            <input
              ref={findInputRef}
              type="text"
              placeholder="查找模式..."
              value={safePayload.findPattern}
              onChange={(e) => onPayloadChange({ ...safePayload, findPattern: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              disabled={isEmpty || isDisabled}
              className={cn(
                'w-full h-full px-4 pr-12 py-2.5 bg-transparent border-0 outline-none',
                'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                'font-mono text-sm'
              )}
            />
            <button
              type="button"
              onClick={() => {
                setIsAssistMode(true);
                setAssistText('');
              }}
              disabled={isEmpty || isDisabled || isLoading}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md',
                'text-zinc-400 hover:text-amber-500 hover:bg-amber-50',
                'dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/30',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              title="AI 辅助"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 mx-4" />
          <input
            type="text"
            placeholder="替换内容... (支持 ${i} ${i0})"
            value={safePayload.replacePattern}
            onChange={(e) => onPayloadChange({ ...safePayload, replacePattern: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            disabled={isEmpty || isDisabled}
            className={cn(
              'flex-1 px-4 py-2.5 bg-transparent border-0 outline-none',
              'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'font-mono text-sm'
            )}
          />
        </>
      )}
    </div>
  );
}
