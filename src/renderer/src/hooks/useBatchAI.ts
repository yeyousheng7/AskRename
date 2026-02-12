import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIChatSettings, ChatMessage } from '@shared/ipc-types';
import { electronApi } from '@/lib/electron-api';
import { AI_SYSTEM_PROMPT } from '@/lib/ai-service';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_CONCURRENCY_LIMIT = 3;

export type UseBatchAIOptions = {
  /** 每批处理多少个文件名（>= 1） */
  batchSize?: number;
  /** 并发批次数量上限（>= 1） */
  concurrencyLimit?: number;
};

export type BatchAIStatus = 'idle' | 'processing' | 'paused' | 'error';
export type BatchStatus = 'pending' | 'in_flight' | 'success' | 'error' | 'canceled';

export type BatchItem = { id: string; original: string };

export type Batch = {
  batchId: string;
  batchIndex: number;
  start: number;
  end: number;
  startIndex: number; // 1-based
  items: BatchItem[];
  status: BatchStatus;
  attempts: number;
  errorMessage?: string;
  resultNames?: string[];
  requestId?: string;
};

export type UseBatchAIResult = {
  status: BatchAIStatus;
  batches: Batch[];
  totalFiles: number;
  completedFiles: number;
  progressPercent: number;
  errorSummary?: string;
  start: (params: {
    items: BatchItem[];
    instruction: string;
    settings: AIChatSettings;
    onBatchApplied: (batch: {
      start: number;
      items: { id: string }[];
      resultNames: string[];
    }) => void;
  }) => void;
  cancel: () => void;
  retryBatch: (batchIndex: number) => void;
  retryFailed: () => void;
};

type StartParams = Parameters<UseBatchAIResult['start']>[0];

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const v = Math.floor(Number(value));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

function buildBatches(jobId: string, items: BatchItem[], batchSize: number): Batch[] {
  const batches: Batch[] = [];
  for (let start = 0, batchIndex = 0; start < items.length; start += batchSize, batchIndex++) {
    const end = Math.min(start + batchSize, items.length);
    batches.push({
      batchId: `${jobId}:${batchIndex}`,
      batchIndex,
      start,
      end,
      startIndex: start + 1,
      items: items.slice(start, end),
      status: 'pending',
      attempts: 0
    });
  }
  return batches;
}

function parseNameList(content: string, expectedLength: number): string[] {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI 返回格式错误：无法解析 JSON。原始输出: ${content.slice(0, 100)}...`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回格式错误：必须是字符串数组');
  }
  if (parsed.length !== expectedLength) {
    throw new Error(`AI 返回数量不匹配：${parsed.length} vs ${expectedLength}`);
  }
  return parsed.map((v, i) => {
    if (typeof v !== 'string') throw new Error(`AI 返回格式错误：第 ${i + 1} 项不是字符串`);
    return v;
  });
}

function buildBatchMessages(
  instruction: string,
  originals: string[],
  startIndex: number
): ChatMessage[] {
  const injectedSystem = `${AI_SYSTEM_PROMPT}\n\nCurrent batch starts at index ${startIndex}. If using sequential numbering, start from this number.`;
  const userMessage = `文件列表：${JSON.stringify(originals)}\n\n修改指令：${instruction}`;
  return [
    { role: 'system', content: injectedSystem },
    { role: 'user', content: userMessage }
  ];
}

function summarizeErrors(batches: Batch[]): string | undefined {
  const errors = batches
    .filter((b) => b.status === 'error' && b.errorMessage)
    .map((b) => `Batch ${b.batchIndex + 1}: ${b.errorMessage}`);
  if (errors.length === 0) return undefined;
  return errors.slice(0, 5).join('\n');
}

export function useBatchAI(options?: UseBatchAIOptions): UseBatchAIResult {
  const batchSize = useMemo(
    () => clampInt(options?.batchSize ?? DEFAULT_BATCH_SIZE, 1, 50, DEFAULT_BATCH_SIZE),
    [options?.batchSize]
  );
  const concurrencyLimit = useMemo(
    () =>
      clampInt(
        options?.concurrencyLimit ?? DEFAULT_CONCURRENCY_LIMIT,
        1,
        10,
        DEFAULT_CONCURRENCY_LIMIT
      ),
    [options?.concurrencyLimit]
  );

  const [status, setStatus] = useState<BatchAIStatus>('idle');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedFiles, setCompletedFiles] = useState(0);
  const [errorSummary, setErrorSummary] = useState<string | undefined>(undefined);

  const statusRef = useRef<BatchAIStatus>('idle');
  const jobIdRef = useRef<string>('');
  const startParamsRef = useRef<StartParams | null>(null);
  const haltSchedulingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const schedulingRef = useRef(false);
  const batchesRef = useRef<Batch[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const setBatchesAndRefs = useCallback((next: Batch[]) => {
    batchesRef.current = next;
    setBatches(next);
    setErrorSummary(summarizeErrors(next));
  }, []);

  const progressPercent = useMemo(() => {
    if (totalFiles === 0) return 0;
    return Math.round((completedFiles / totalFiles) * 100);
  }, [completedFiles, totalFiles]);

  const applyBatchSuccess = useCallback(
    (jobId: string, batchIndex: number, resultNames: string[]) => {
      if (jobIdRef.current !== jobId) return;
      if (abortControllerRef.current?.signal.aborted) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch) return;

      const next = current.slice();
      next[batchIndex] = { ...batch, status: 'success', resultNames, errorMessage: undefined };
      setBatchesAndRefs(next);
      setCompletedFiles((prev) => prev + batch.items.length);

      const allDone = next.every((b) => b.status === 'success' || b.status === 'canceled');
      const hasError = next.some((b) => b.status === 'error');
      const inFlightCount = next.filter((b) => b.status === 'in_flight').length;

      if (allDone && !hasError) {
        setStatus('idle');
        haltSchedulingRef.current = false;
        startParamsRef.current = null;
        abortControllerRef.current = null;
      } else if (haltSchedulingRef.current && inFlightCount === 0 && hasError) {
        setStatus('error');
      }
    },
    [setBatchesAndRefs]
  );

  const applyBatchError = useCallback(
    (jobId: string, batchIndex: number, message: string) => {
      if (jobIdRef.current !== jobId) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch) return;

      const next = current.slice();
      next[batchIndex] = { ...batch, status: 'error', errorMessage: message };
      setBatchesAndRefs(next);

      haltSchedulingRef.current = true;

      const inFlightCount = next.filter((b) => b.status === 'in_flight').length;
      if (inFlightCount === 0) {
        setStatus('error');
      }
    },
    [setBatchesAndRefs]
  );

  const applyBatchCanceled = useCallback(
    (jobId: string, batchIndex: number) => {
      if (jobIdRef.current !== jobId) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch) return;

      const next = current.slice();
      next[batchIndex] = { ...batch, status: 'canceled', errorMessage: undefined };
      setBatchesAndRefs(next);

      const inFlightCount = next.filter((b) => b.status === 'in_flight').length;
      if (statusRef.current === 'paused' && inFlightCount === 0) {
        startParamsRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [setBatchesAndRefs]
  );

  const runBatch = useCallback(
    async (jobId: string, batchIndex: number) => {
      const params = startParamsRef.current;
      if (!params) return;
      if (jobIdRef.current !== jobId) return;

      const batch = batchesRef.current[batchIndex];
      if (!batch) return;
      if (batch.status !== 'in_flight') return;

      const originals = batch.items.map((i) => i.original);
      const messages = buildBatchMessages(params.instruction, originals, batch.startIndex);

      try {
        const response = await electronApi.askAI(params.settings, messages, batch.requestId);

        if (jobIdRef.current !== jobId) return;
        if (abortControllerRef.current?.signal.aborted) {
          applyBatchCanceled(jobId, batchIndex);
          return;
        }

        if (!response.success) {
          throw new Error(response.error || 'AI 服务发生未知错误');
        }
        if (!response.content) {
          throw new Error('AI 返回内容为空');
        }

        const names = parseNameList(response.content, originals.length);

        if (jobIdRef.current !== jobId) return;
        if (abortControllerRef.current?.signal.aborted) {
          applyBatchCanceled(jobId, batchIndex);
          return;
        }

        params.onBatchApplied({
          start: batch.start,
          items: batch.items.map((it) => ({ id: it.id })),
          resultNames: names
        });
        applyBatchSuccess(jobId, batchIndex, names);
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          applyBatchCanceled(jobId, batchIndex);
          return;
        }
        const message = err instanceof Error ? err.message : '批次处理失败';
        applyBatchError(jobId, batchIndex, message);
      }
    },
    [applyBatchCanceled, applyBatchError, applyBatchSuccess]
  );

  const schedule = useCallback(() => {
    if (schedulingRef.current) return;
    schedulingRef.current = true;
    try {
      if (statusRef.current !== 'processing') return;
      if (haltSchedulingRef.current) return;
      if (abortControllerRef.current?.signal.aborted) return;

      // loop-start: fill concurrency slots
      while (true) {
        const current = batchesRef.current;
        const inFlightCount = current.filter((b) => b.status === 'in_flight').length;
        if (inFlightCount >= concurrencyLimit) return;

        const nextPendingIndex = current.findIndex((b) => b.status === 'pending');
        if (nextPendingIndex === -1) {
          const hasError = current.some((b) => b.status === 'error');
          const allDone = current.every((b) => b.status === 'success' || b.status === 'canceled');
          if (allDone && !hasError) setStatus('idle');
          return;
        }

        const jobId = jobIdRef.current;
        const batch = current[nextPendingIndex];
        const requestId = `ai:${jobId}:${batch.batchIndex}:${Date.now()}`;

        const next = current.slice();
        next[nextPendingIndex] = {
          ...batch,
          status: 'in_flight',
          attempts: batch.attempts + 1,
          requestId,
          errorMessage: undefined
        };
        setBatchesAndRefs(next);

        void runBatch(jobId, nextPendingIndex);
      }
    } finally {
      // In case we returned early without launching a batch, release scheduling lock.
      schedulingRef.current = false;
    }
  }, [concurrencyLimit, runBatch, setBatchesAndRefs]);

  useEffect(() => {
    if (status !== 'processing') return;
    schedule();
  }, [status, batches, schedule]);

  const start = useCallback<UseBatchAIResult['start']>(
    ({ items, instruction, settings, onBatchApplied }) => {
      // Start always overrides any existing job.
      abortControllerRef.current?.abort();
      haltSchedulingRef.current = false;

      const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      jobIdRef.current = jobId;
      abortControllerRef.current = new AbortController();
      startParamsRef.current = { items, instruction, settings, onBatchApplied };

      setTotalFiles(items.length);
      setCompletedFiles(0);

      const initial = buildBatches(jobId, items, batchSize);
      setBatchesAndRefs(initial);

      setStatus(items.length === 0 ? 'idle' : 'processing');
    },
    [batchSize, setBatchesAndRefs]
  );

  const cancel = useCallback(() => {
    if (statusRef.current === 'idle') return;

    setStatus('paused');
    haltSchedulingRef.current = true;
    abortControllerRef.current?.abort();

    const current = batchesRef.current;
    const next: Batch[] = current.map((b): Batch => {
      if (b.status === 'in_flight') {
        if (b.requestId) void electronApi.cancelAI(b.requestId);
        return { ...b, status: 'canceled' };
      }
      if (b.status === 'pending') {
        return { ...b, status: 'canceled' };
      }
      return b;
    });
    setBatchesAndRefs(next);
  }, [setBatchesAndRefs]);

  const retryBatch = useCallback(
    (batchIndex: number) => {
      if (statusRef.current !== 'error' && statusRef.current !== 'paused') return;
      if (batchIndex < 0 || batchIndex >= batchesRef.current.length) return;
      if (!startParamsRef.current) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch) return;

      const next = current.slice();
      next[batchIndex] = {
        ...batch,
        status: 'pending',
        errorMessage: undefined,
        resultNames: undefined,
        requestId: undefined
      };
      setBatchesAndRefs(next);
      haltSchedulingRef.current = false;
      if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
        abortControllerRef.current = new AbortController();
      }
      setStatus('processing');
    },
    [setBatchesAndRefs]
  );

  const retryFailed = useCallback(() => {
    if (statusRef.current !== 'error' && statusRef.current !== 'paused') return;
    if (!startParamsRef.current) return;

    const current = batchesRef.current;
    const next: Batch[] = current.map((b): Batch => {
      if (b.status !== 'error') return b;
      return {
        ...b,
        status: 'pending',
        errorMessage: undefined,
        resultNames: undefined,
        requestId: undefined
      };
    });
    setBatchesAndRefs(next);
    haltSchedulingRef.current = false;
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    setStatus('processing');
  }, [setBatchesAndRefs]);

  return {
    status,
    batches,
    totalFiles,
    completedFiles,
    progressPercent,
    errorSummary,
    start,
    cancel,
    retryBatch,
    retryFailed
  };
}
