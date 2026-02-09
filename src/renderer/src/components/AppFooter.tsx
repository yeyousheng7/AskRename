import { useCallback, useMemo, useState, useRef, useEffect, type RefObject } from 'react';
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  XIcon,
  Regex,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { CommandMenu } from '@/components/CommandMenu';
import { usePresets, type Preset } from '@/hooks/usePresets';
import { Input } from '@/components/ui/input';
import type { ToastType } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export type Mode = 'auto' | 'ai' | 'regex';
export type AISessionState = 'idle' | 'loading' | 'review';

/** Pending AI decision result */
export type PendingDecision =
  | { type: 'regex'; find: string; replace: string }
  | { type: 'list'; names: string[] }
  | null;

interface ModeConfig {
  id: Mode;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'auto',
    icon: <Zap className="h-4 w-4" />,
    label: '智能',
    description: 'AI 自动判断使用正则或完整生成'
  },
  {
    id: 'ai',
    icon: <SparklesIcon className="h-4 w-4" />,
    label: 'AI',
    description: '始终使用 AI 生成文件名'
  },
  {
    id: 'regex',
    icon: <Regex className="h-4 w-4" />,
    label: '正则',
    description: '手动输入正则表达式'
  }
];

export function AppFooter({
  mode,
  onModeChange,
  error,
  instruction,
  findPattern,
  replacePattern,
  inputRef,
  isEmpty,
  isReviewMode,
  isRenaming,
  isApplying,
  isUndoing,
  canUndo,
  // AI Session 新增
  aiSession,
  pendingDecision,
  onConfirmDecision,
  onDiscardDecision,
  onUpdatePendingRegex,
  // 原有回调
  onInstructionChange,
  onFindPatternChange,
  onReplacePatternChange,
  onUndo,
  onDiscard,
  onApply,
  onStop,
  onGenerate,
  showToast,
  history,
  onSelectHistory
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  error: string | null;
  instruction: string;
  findPattern: string;
  replacePattern: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isEmpty: boolean;
  isReviewMode: boolean;
  isRenaming: boolean;
  isApplying: boolean;
  isUndoing: boolean;
  canUndo: boolean;
  // AI Session 新增
  aiSession: AISessionState;
  pendingDecision: PendingDecision;
  onConfirmDecision: () => void;
  onDiscardDecision: () => void;
  onUpdatePendingRegex: (find: string, replace: string) => void;
  // 原有回调
  onInstructionChange: (next: string) => void;
  onFindPatternChange: (next: string) => void;
  onReplacePatternChange: (next: string) => void;
  onUndo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  onStop: () => void;
  onGenerate: () => void;
  showToast: (message: string, type: ToastType) => void;
  // Session History
  history: string[];
  onSelectHistory: (text: string) => void;
}): React.JSX.Element {
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const { presets, addPreset } = usePresets();

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetContent, setSavePresetContent] = useState('');
  const saveDetectedRef = useRef(false);

  const getSaveCommandContent = useCallback((text: string): string | null => {
    const rightTrimmed = text.replace(/\s+$/, '');
    const lower = rightTrimmed.toLowerCase();
    if (!lower.endsWith('/save')) return null;

    const idx = lower.lastIndexOf('/save');
    if (idx < 0) return null;
    if (idx > 0 && !/\s/.test(lower[idx - 1] ?? '')) return null;

    return rightTrimmed.slice(0, idx).trimEnd();
  }, []);

  const beginSavePreset = useCallback(
    (content: string) => {
      if (!content.trim()) {
        showToast('没有可保存的内容', 'error');
        return;
      }
      setIsSaveDialogOpen(true);
      setSavePresetName('');
      setSavePresetContent(content);
      setIsCommandMenuOpen(false);
      setCommandSelectedIndex(0);
    },
    [showToast]
  );

  const handleSaveDialogCancel = useCallback(() => {
    setIsSaveDialogOpen(false);
    setSavePresetName('');
    setSavePresetContent('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputRef]);

  const handleSaveDialogConfirm = useCallback(() => {
    const name = savePresetName.trim();
    if (!name) return;
    addPreset({ name, content: savePresetContent, type: 'prompt' });
    setIsSaveDialogOpen(false);
    setSavePresetName('');
    setSavePresetContent('');
    showToast('预设已保存', 'success');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [addPreset, inputRef, savePresetContent, savePresetName, showToast]);

  // Slash command 过滤
  const filteredPresets = useMemo(() => {
    if (!isCommandMenuOpen) return [];
    if (!instruction.startsWith('/')) return [];
    const query = instruction.slice(1).trim().toLowerCase();
    if (!query) return presets;
    return presets.filter(
      (p) =>
        p.id.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
    );
  }, [isCommandMenuOpen, instruction, presets]);

  // 过滤列表变化时重置选中索引
  const safeCommandSelectedIndex =
    filteredPresets.length === 0
      ? 0
      : Math.min(commandSelectedIndex, filteredPresets.length - 1);

  const handleCommandSelect = useCallback(
    (preset: Preset) => {
      if (preset.type === 'regex') {
        onModeChange('regex');
        onFindPatternChange(preset.content);
        onReplacePatternChange('');
        onInstructionChange('');
      } else {
        onInstructionChange(preset.content);
      }
      setIsCommandMenuOpen(false);
      setCommandSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [onInstructionChange, onModeChange, onFindPatternChange, onReplacePatternChange, inputRef]
  );

  // 点击外部关闭模式菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];
  const isDisabled = isRenaming || isApplying || isUndoing;
  const canSubmit = mode === 'regex' ? findPattern.trim() : instruction.trim();

  return (
    <>
      {isSaveDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/50"
            onClick={handleSaveDialogCancel}
          />
          <div className="relative z-10 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                保存为预设
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveDialogCancel}
                className="h-7 w-7"
                title="关闭"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-4 py-4 space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                预设名称
              </label>
              <Input
                value={savePresetName}
                onChange={(e) => setSavePresetName(e.target.value)}
                placeholder="例如：批量转小写"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveDialogConfirm();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleSaveDialogCancel();
                  }
                }}
              />
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                将保存当前输入内容为一个新的预设（AI 提示词）。
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
              <Button variant="secondary" onClick={handleSaveDialogCancel}>
                取消
              </Button>
              <Button
                onClick={handleSaveDialogConfirm}
                disabled={!savePresetName.trim()}
                className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 独立撤销按钮 - 悬浮在左侧 */}
      <Button
        onClick={onUndo}
        size="icon"
        variant="ghost"
        disabled={!canUndo || isDisabled}
        className={cn(
          'fixed bottom-6 left-6 z-50 h-10 w-10 rounded-full',
          'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl',
          'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
          'hover:bg-white dark:hover:bg-zinc-800',
          'transition-all duration-200',
          (!canUndo || isDisabled) && 'opacity-40'
        )}
        title={canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
      >
        {isUndoing ? (
          <LoaderIcon className="h-4 w-4 animate-spin" />
        ) : (
          <Undo2Icon className="h-4 w-4" />
        )}
      </Button>

      {/* 悬浮指令舱 - MorphingBar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'w-[680px] max-w-[90vw]',
          'bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl',
          'rounded-[20px] shadow-2xl',
          'ring-1 ring-black/5 dark:ring-white/10',
          'transition-all duration-300 ease-in-out',
          'overflow-visible'
        )}
      >
        {/* Session History 抽屉 - 仅在非正则模式下显示 */}
        {mode !== 'regex' && <HistoryDrawer history={history} onSelect={onSelectHistory} />}

        {/* 错误提示 */}
        {error && (
          <div className="px-4 pt-3 pb-0">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {/* Action Card - 智能模式下的 AI 决策预览卡片 */}
        {aiSession === 'review' && mode === 'auto' && pendingDecision && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50/80 to-blue-50/80 dark:from-purple-950/40 dark:to-blue-950/40 ring-1 ring-purple-200/50 dark:ring-purple-800/30">
            {pendingDecision.type === 'regex' ? (
              <>
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                  <Regex className="h-3.5 w-3.5" />
                  AI 生成了正则规则，可编辑微调
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">
                      查找
                    </label>
                    <input
                      type="text"
                      value={pendingDecision.find}
                      onChange={(e) =>
                        onUpdatePendingRegex(e.target.value, pendingDecision.replace)
                      }
                      className="flex-1 px-2.5 py-1.5 text-sm font-mono bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 focus:ring-purple-400 dark:focus:ring-purple-600 outline-none transition-all"
                      placeholder="正则表达式"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400 w-10 shrink-0">
                      替换
                    </label>
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
        )}

        {/* 非智能模式的审查模式操作栏 */}
        {isReviewMode && (mode !== 'auto' || aiSession !== 'review') && (
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              预览已就绪，确认应用更改？
            </span>
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
        )}

        {/* 主内容区 - 可变形 */}
        <div className="flex items-stretch">
          {/* 左侧：Mode Trigger */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              disabled={isDisabled}
              className={cn(
                'h-full px-4 py-3 flex items-center gap-2',
                'border-r border-zinc-200/50 dark:border-zinc-700/50',
                'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                'transition-colors',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {currentMode.icon}
              <span className="text-sm font-medium">{currentMode.label}</span>
              <ChevronDownIcon
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  isModeMenuOpen && 'rotate-180'
                )}
              />
            </button>

            {/* 模式下拉菜单 */}
            {isModeMenuOpen && (
              <div
                className={cn(
                  'absolute bottom-full left-0 mb-2 w-56',
                  'z-50',
                  'bg-white dark:bg-zinc-900 rounded-xl shadow-xl',
                  'ring-1 ring-black/5 dark:ring-white/10',
                  'py-1 overflow-hidden',
                  'animate-in fade-in-0 zoom-in-95 duration-150'
                )}
              >
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onModeChange(m.id);
                      setIsModeMenuOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 flex items-start gap-3 text-left',
                      'hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
                      mode === m.id && 'bg-zinc-50 dark:bg-zinc-800'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5',
                        mode === m.id
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-500'
                      )}
                    >
                      {m.icon}
                    </div>
                    <div>
                      <div
                        className={cn(
                          'text-sm font-medium',
                          mode === m.id
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-700 dark:text-zinc-300'
                        )}
                      >
                        {m.label}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {m.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 中间：输入区域 */}
          <div
            className={cn(
              'flex-1 relative',
              'transition-all duration-300 ease-in-out',
              mode === 'regex' ? 'min-h-[88px]' : 'min-h-[44px]'
            )}
          >

            {mode === 'regex' ? (
              // 正则模式：双行输入框
              <div className="h-full flex flex-col">
                <input
                  type="text"
                  placeholder="查找正则..."
                  value={findPattern}
                  onChange={(e) => onFindPatternChange(e.target.value)}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'flex-1 px-4 py-2.5 bg-transparent border-0 outline-none',
                    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                    'font-mono text-sm'
                  )}
                />
                <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 mx-4" />
                <input
                  type="text"
                  placeholder="替换为... (支持 ${i} ${i0} 序号)"
                  value={replacePattern}
                  onChange={(e) => onReplacePatternChange(e.target.value)}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'flex-1 px-4 py-2.5 bg-transparent border-0 outline-none',
                    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                    'font-mono text-sm'
                  )}
                />
              </div>
            ) : (
              // Auto/AI 模式：单行输入框 + Slash Command Menu
              <>
                {/* Slash Command 悬浮菜单 */}
                {isCommandMenuOpen && (
                  <CommandMenu
                    presets={filteredPresets}
                    selectedIndex={safeCommandSelectedIndex}
                    onSelect={handleCommandSelect}
                    query={instruction.startsWith('/') ? instruction.slice(1) : ''}
                  />
                )}
                <input
                  ref={inputRef as RefObject<HTMLInputElement>}
                  type="text"
                  placeholder={
                    isReviewMode
                      ? '不满意？修改指令后按回车重新生成...'
                      : '输入自然语言指令... 或 / 选择预设'
                  }
                  value={instruction}
                  onChange={(e) => {
                    const val = e.target.value;
                    const saveContent = getSaveCommandContent(val);
                    if (saveContent !== null && !isSaveDialogOpen && !saveDetectedRef.current) {
                      saveDetectedRef.current = true;
                      onInstructionChange(saveContent);
                      beginSavePreset(saveContent);
                      return;
                    }
                    saveDetectedRef.current = saveContent !== null;
                    onInstructionChange(val);
                    // 检测 "/" 触发
                    if (val.startsWith('/')) {
                      setIsCommandMenuOpen(true);
                    } else {
                      setIsCommandMenuOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    // ===== Slash Command 键盘导航（优先拦截）=====
                    if (isCommandMenuOpen && filteredPresets.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setCommandSelectedIndex(
                          (prev) => (prev + 1) % filteredPresets.length
                        );
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setCommandSelectedIndex(
                          (prev) =>
                            (prev - 1 + filteredPresets.length) % filteredPresets.length
                        );
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const selected = filteredPresets[safeCommandSelectedIndex];
                        if (selected) handleCommandSelect(selected);
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsCommandMenuOpen(false);
                        return;
                      }
                    }

                    // ===== 原有键盘逻辑 =====
                    // Enter: 发送指令（如果有文本）
                    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      const saveContent = getSaveCommandContent(instruction);
                      if (saveContent !== null) {
                        onInstructionChange(saveContent);
                        beginSavePreset(saveContent);
                        return;
                      }
                      if (instruction.trim()) onGenerate();
                    }
                    // Cmd/Ctrl + Enter: review 状态下确认应用
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (aiSession === 'review') {
                        onConfirmDecision();
                      }
                    }
                    // Esc: 放弃当前 AI 建议
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      if (aiSession === 'review') {
                        onDiscardDecision();
                      }
                    }
                  }}
                  disabled={isEmpty || isDisabled}
                  className={cn(
                    'w-full h-full pl-4 pr-4 py-3 bg-transparent border-0 outline-none',
                    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                    'text-sm'
                  )}
                />
              </>
            )}
          </div>

          {/* 右侧：Submit 按钮 */}
          <div className="flex items-center pr-3">
            {isRenaming || aiSession === 'loading' ? (
              // Loading 或 Renaming 状态：显示停止按钮或 Spinner
              aiSession === 'loading' ? (
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center',
                    'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500'
                  )}
                  title="生成中..."
                >
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <button
                  onClick={onStop}
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center',
                    'bg-red-500 text-white hover:bg-red-600',
                    'transition-all duration-200 hover:scale-105'
                  )}
                  title="停止生成"
                >
                  <SquareIcon className="h-3.5 w-3.5" />
                </button>
              )
            ) : aiSession === 'review' && mode === 'auto' && !instruction.trim() ? (
              // Review 状态且无文本：显示确认按钮
              <button
                onClick={onConfirmDecision}
                disabled={isApplying}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'transition-all duration-200',
                  !isApplying
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                )}
                title="确认应用 (Ctrl+Enter)"
              >
                {isApplying ? (
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
              </button>
            ) : (
              // 其他状态：显示发送按钮
              <button
                onClick={() => {
                  if (mode === 'regex' && isReviewMode) {
                    onApply();
                    return;
                  }
                  const saveContent = getSaveCommandContent(instruction);
                  if (saveContent !== null) {
                    onInstructionChange(saveContent);
                    beginSavePreset(saveContent);
                    return;
                  }
                  onGenerate();
                }}
                disabled={isEmpty || !canSubmit || isDisabled}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'transition-all duration-200',
                  canSubmit && !isEmpty && !isDisabled
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-105'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                )}
                title={mode === 'regex' ? '应用正则替换' : '生成'}
              >
                {isApplying ? (
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpIcon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
