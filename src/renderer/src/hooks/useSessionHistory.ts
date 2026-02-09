import { useState, useCallback } from 'react';

const MAX_HISTORY_LENGTH = 20;

interface UseSessionHistoryResult {
  /** 历史记录列表，最新在前 */
  history: string[];
  /** 最近一条记录 */
  latestEntry: string | undefined;
  /** 将指令添加到历史记录头部（去重连续相同项，限制最大长度） */
  addToHistory: (instruction: string) => void;
  /** 清空历史记录 */
  clearHistory: () => void;
}

export function useSessionHistory(): UseSessionHistoryResult {
  const [history, setHistory] = useState<string[]>([]);

  const addToHistory = useCallback((instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // 连续相同指令不重复添加
      if (prev[0] === trimmed) return prev;
      const next = [trimmed, ...prev];
      // 限制最大长度
      if (next.length > MAX_HISTORY_LENGTH) next.length = MAX_HISTORY_LENGTH;
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    latestEntry: history[0],
    addToHistory,
    clearHistory
  };
}
