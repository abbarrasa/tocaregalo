import { requireTimestamp } from './validation.ts';

export const eventProcessingBatchSize = 20;
export type EventProcessingKind = 'close' | 'redraw';
export type EventProcessingJob = Readonly<{
  eventId: string; ownerAccountId: string; revision: number; kind: EventProcessingKind;
  version: number; retryStage: number;
}>;

// Unlike email delivery, event processing never abandons a pending event.
export function eventProcessingRetry(retryStage: number, failedAtMs: number): { retryStage: number; nextAttemptAtMs: number } {
  requireTimestamp(failedAtMs);
  if (!Number.isSafeInteger(retryStage) || retryStage < 0 || retryStage > 5) throw new RangeError('Invalid event retry stage.');
  const delay = Math.min(60_000 * 2 ** Math.min(retryStage, 4), 15 * 60_000);
  const nextAttemptAtMs = failedAtMs + delay; requireTimestamp(nextAttemptAtMs);
  return { retryStage: Math.min(retryStage + 1, 5), nextAttemptAtMs };
}
