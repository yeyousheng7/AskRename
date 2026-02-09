import type { AIDecision } from '@shared/ipc-types';

export type AISessionState = 'idle' | 'loading' | 'review';
export type PendingDecision = AIDecision | null;

export type { AIDecision };
