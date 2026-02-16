import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBatchRequestId,
  buildBatches,
  clampInt,
  summarizeBatchErrors,
  type Batch,
  type BatchAIStatus,
  type BatchItem
} from '@/modes/shared/batch-runner';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_CONCURRENCY_LIMIT = 3;

export type UseBatchAIOptions = {
  batchSize?: number;
  concurrencyLimit?: number;
};

export type { Batch, BatchAIStatus, BatchItem };

export type UseBatchAIResult = {
  status: BatchAIStatus;
  batches: Batch[];
  totalFiles: number;
  completedFiles: number;
  progressPercent: number;
  errorSummary?: string;
  start: (params: {
    items: BatchItem[];
    runChunk: (chunk: {
      batchIndex: number;
      start: number;
      startIndex: number;
      requestId: string;
      items: BatchItem[];
      signal: AbortSignal;
    }) => Promise<string[]>;
    onBatchApplied: (batch: {
      start: number;
      items: { id: string }[];
      resultNames: string[];
    }) => void;
    onCancelRequest?: (requestId: string) => void;
    requestIdPrefix?: string;
  }) => void;
  cancel: () => void;
  retryBatch: (batchIndex: number) => void;
  retryFailed: () => void;
};

type StartParams = Parameters<UseBatchAIResult['start']>[0];

function isTerminalStatus(status: Batch['status']): boolean {
  return status === 'success' || status === 'error' || status === 'canceled';
}

function isProcessedStatus(status: Batch['status']): boolean {
  return status === 'success' || status === 'error' || status === 'canceled';
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
  const jobIdRef = useRef('');
  const startParamsRef = useRef<StartParams | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const schedulingRef = useRef(false);
  const batchesRef = useRef<Batch[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const setBatchesAndRefs = useCallback((next: Batch[]) => {
    batchesRef.current = next;
    setBatches(next);
    setCompletedFiles(
      next.reduce((sum, batch) => {
        return isProcessedStatus(batch.status) ? sum + batch.items.length : sum;
      }, 0)
    );
    setErrorSummary(summarizeBatchErrors(next));
  }, []);

  const progressPercent = useMemo(() => {
    if (totalFiles === 0) return 0;
    return Math.round((completedFiles / totalFiles) * 100);
  }, [completedFiles, totalFiles]);

  const finalizeIfSettled = useCallback((next: Batch[]) => {
    if (statusRef.current !== 'processing') return;
    const allSettled = next.every((batch) => isTerminalStatus(batch.status));
    if (!allSettled) return;

    const hasError = next.some((batch) => batch.status === 'error');
    if (hasError) {
      setStatus('error');
      return;
    }

    setStatus('idle');
    startParamsRef.current = null;
    abortControllerRef.current = null;
  }, []);

  const applyBatchSuccess = useCallback(
    (jobId: string, batchIndex: number, resultNames: string[]) => {
      if (jobIdRef.current !== jobId) return;
      if (abortControllerRef.current?.signal.aborted) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch) return;

      const next = current.slice();
      next[batchIndex] = {
        ...batch,
        status: 'success',
        resultNames,
        errorMessage: undefined
      };
      setBatchesAndRefs(next);
      finalizeIfSettled(next);
    },
    [finalizeIfSettled, setBatchesAndRefs]
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
      finalizeIfSettled(next);
    },
    [finalizeIfSettled, setBatchesAndRefs]
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
      finalizeIfSettled(next);
    },
    [finalizeIfSettled, setBatchesAndRefs]
  );

  const runBatch = useCallback(
    async (jobId: string, batchIndex: number) => {
      const params = startParamsRef.current;
      if (!params) return;
      if (jobIdRef.current !== jobId) return;

      const batch = batchesRef.current[batchIndex];
      if (!batch) return;
      if (batch.status !== 'in_flight') return;

      const signal = abortControllerRef.current?.signal;
      if (!signal) return;

      try {
        const names = await params.runChunk({
          batchIndex: batch.batchIndex,
          start: batch.start,
          startIndex: batch.startIndex,
          requestId: batch.requestId || '',
          items: batch.items,
          signal
        });

        if (jobIdRef.current !== jobId) return;
        if (abortControllerRef.current?.signal.aborted) {
          applyBatchCanceled(jobId, batchIndex);
          return;
        }

        if (!Array.isArray(names) || names.length !== batch.items.length) {
          throw new Error(
            `Batch ${batch.batchIndex + 1} 返回数量异常：${names?.length ?? 0} vs ${batch.items.length}`
          );
        }

        params.onBatchApplied({
          start: batch.start,
          items: batch.items.map((item) => ({ id: item.id })),
          resultNames: names
        });
        applyBatchSuccess(jobId, batchIndex, names);
      } catch (error) {
        if (abortControllerRef.current?.signal.aborted) {
          applyBatchCanceled(jobId, batchIndex);
          return;
        }
        const message = error instanceof Error ? error.message : '批次处理失败';
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
      if (abortControllerRef.current?.signal.aborted) return;

      while (true) {
        const current = batchesRef.current;
        const inFlightCount = current.filter((b) => b.status === 'in_flight').length;
        if (inFlightCount >= concurrencyLimit) return;

        const nextPendingIndex = current.findIndex((b) => b.status === 'pending');
        if (nextPendingIndex === -1) {
          finalizeIfSettled(current);
          return;
        }

        const params = startParamsRef.current;
        if (!params) return;

        const jobId = jobIdRef.current;
        const batch = current[nextPendingIndex];
        const requestId = buildBatchRequestId(
          params.requestIdPrefix || 'batch',
          jobId,
          batch.batchIndex
        );

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
      schedulingRef.current = false;
    }
  }, [concurrencyLimit, finalizeIfSettled, runBatch, setBatchesAndRefs]);

  useEffect(() => {
    if (status !== 'processing') return;
    schedule();
  }, [status, batches, schedule]);

  const start = useCallback<UseBatchAIResult['start']>(
    ({ items, runChunk, onBatchApplied, onCancelRequest, requestIdPrefix }) => {
      abortControllerRef.current?.abort();

      const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      jobIdRef.current = jobId;
      abortControllerRef.current = new AbortController();
      startParamsRef.current = {
        items,
        runChunk,
        onBatchApplied,
        onCancelRequest,
        requestIdPrefix
      };

      setTotalFiles(items.length);

      const initial = buildBatches(jobId, items, batchSize);
      setBatchesAndRefs(initial);

      setStatus(items.length === 0 ? 'idle' : 'processing');
    },
    [batchSize, setBatchesAndRefs]
  );

  const cancel = useCallback(() => {
    if (statusRef.current === 'idle') return;

    setStatus('idle');
    abortControllerRef.current?.abort();

    const params = startParamsRef.current;
    const current = batchesRef.current;
    const next: Batch[] = current.map((batch) => {
      if (batch.status === 'in_flight') {
        if (params?.onCancelRequest && batch.requestId) {
          params.onCancelRequest(batch.requestId);
        }
        return { ...batch, status: 'canceled' };
      }
      if (batch.status === 'pending') {
        return { ...batch, status: 'canceled' };
      }
      return batch;
    });
    setBatchesAndRefs(next);
    startParamsRef.current = null;
    abortControllerRef.current = null;
  }, [setBatchesAndRefs]);

  const retryBatch = useCallback(
    (batchIndex: number) => {
      if (statusRef.current !== 'error') return;
      if (batchIndex < 0 || batchIndex >= batchesRef.current.length) return;
      if (!startParamsRef.current) return;

      const current = batchesRef.current;
      const batch = current[batchIndex];
      if (!batch || batch.status !== 'error') return;

      const next = current.slice();
      next[batchIndex] = {
        ...batch,
        status: 'pending',
        errorMessage: undefined,
        resultNames: undefined,
        requestId: undefined
      };
      setBatchesAndRefs(next);
      if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
        abortControllerRef.current = new AbortController();
      }
      setStatus('processing');
    },
    [setBatchesAndRefs]
  );

  const retryFailed = useCallback(() => {
    if (statusRef.current !== 'error') return;
    if (!startParamsRef.current) return;

    const current = batchesRef.current;
    const next: Batch[] = current.map((batch) => {
      if (batch.status !== 'error') return batch;
      return {
        ...batch,
        status: 'pending',
        errorMessage: undefined,
        resultNames: undefined,
        requestId: undefined
      };
    });
    setBatchesAndRefs(next);
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
