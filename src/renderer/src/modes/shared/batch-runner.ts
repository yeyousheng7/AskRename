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

export type BatchChunkMeta = {
  batchIndex: number;
  start: number;
  startIndex: number;
  requestId: string;
};

export function clampInt(value: number, min: number, max: number, fallback: number): number {
  const v = Math.floor(Number(value));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

export function buildBatches(jobId: string, items: BatchItem[], batchSize: number): Batch[] {
  const batches: Batch[] = [];
  for (let start = 0, batchIndex = 0; start < items.length; start += batchSize, batchIndex += 1) {
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

export function summarizeBatchErrors(batches: Batch[]): string | undefined {
  const errors = batches
    .filter((b) => b.status === 'error' && b.errorMessage)
    .map((b) => `Batch ${b.batchIndex + 1}: ${b.errorMessage}`);
  if (errors.length === 0) return undefined;
  return errors.slice(0, 5).join('\n');
}

export function buildBatchRequestId(prefix: string, jobId: string, batchIndex: number): string {
  return `${prefix}:${jobId}:${batchIndex}:${Date.now()}`;
}
