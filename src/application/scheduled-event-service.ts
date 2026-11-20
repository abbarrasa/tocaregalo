import { eventProcessingRetry, type EventProcessingJob, type EventProcessingKind } from '../domain/event-processing.ts';
import type { LifecycleResult } from '../domain/event-lifecycle.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface EventProcessingStore {
  due(kind: EventProcessingKind, nowMs: number): Promise<EventProcessingJob[]>;
  defer(job: EventProcessingJob, retryStage: number, nextAttemptAtMs: number): Promise<void>;
  complete(job: EventProcessingJob): Promise<void>;
}

export interface ScheduledEventLifecycle {
  closeScheduled(ownerAccountId: string, eventId: string, dueAtMs: number): Promise<LifecycleResult>;
  execute(ownerAccountId: string, eventId: string): Promise<LifecycleResult>;
}

export class ScheduledEventService {
  private readonly store: EventProcessingStore;
  private readonly lifecycle: ScheduledEventLifecycle;
  private readonly now: () => number;
  constructor(store: EventProcessingStore, lifecycle: ScheduledEventLifecycle, now = Date.now) {
    this.store = store; this.lifecycle = lifecycle; this.now = now;
  }

  async run() {
    const cutoff = this.now(); requireTimestamp(cutoff);
    const report = { closed: 0, redrawn: 0, deferred: 0, failed: 0 };
    for (const kind of ['close', 'redraw'] as const) {
      const jobs = await this.store.due(kind, cutoff);
      for (const job of jobs) {
        let result: LifecycleResult;
        try {
          result = kind === 'close'
            ? await this.lifecycle.closeScheduled(job.ownerAccountId, job.eventId, cutoff)
            : await this.lifecycle.execute(job.ownerAccountId, job.eventId);
          if (result.kind === 'ok') await this.store.complete(job);
        } catch {
          const retry = eventProcessingRetry(job.retryStage, this.now());
          await this.store.defer(job, retry.retryStage, retry.nextAttemptAtMs);
          report.failed++; continue;
        }
        if (result.kind === 'conflict') {
          const retry = eventProcessingRetry(job.retryStage, this.now());
          await this.store.defer(job, retry.retryStage, retry.nextAttemptAtMs);
          report.deferred++;
        } else if (result.kind === 'ok') {
          if (kind === 'close') report.closed++; else report.redrawn++;
        } else {
          // Membership may shrink or a manual close may win after candidate selection.
          // Pending work remains durable, and ineligible jobs are filtered next time.
          report.deferred++;
        }
      }
    }
    return report;
  }
}
