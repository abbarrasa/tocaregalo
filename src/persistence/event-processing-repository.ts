import type { EventProcessingStore } from '../application/scheduled-event-service.ts';
import { eventProcessingBatchSize, type EventProcessingJob, type EventProcessingKind } from '../domain/event-processing.ts';
import type { PersistenceDatabase } from './d1.ts';

export class EventProcessingRepository implements EventProcessingStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async due(kind: EventProcessingKind, nowMs: number): Promise<EventProcessingJob[]> {
    return (await this.db.prepare(`SELECT j.event_id AS eventId, j.kind, j.version, j.retry_stage AS retryStage,
      g.owner_account_id AS ownerAccountId, g.membership_revision AS revision
      FROM event_processing_jobs j JOIN events e ON e.id = j.event_id JOIN groups g ON g.id = e.group_id
      WHERE j.kind = ? AND j.next_attempt_at_ms <= ? AND e.closed_at_ms IS NULL
      AND ${kind === 'close' ? 'e.closure_at_ms IS NOT NULL AND e.closure_at_ms <= ?' : 'e.redraw_required = 1'}
      AND EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = e.group_id LIMIT 1 OFFSET 2)
      ORDER BY j.next_attempt_at_ms, j.event_id LIMIT ?`)
      .bind(...(kind === 'close' ? [kind, nowMs, nowMs, eventProcessingBatchSize] : [kind, nowMs, eventProcessingBatchSize]))
      .all<EventProcessingJob>()).results;
  }

  async defer(job: EventProcessingJob, retryStage: number, nextAttemptAtMs: number): Promise<void> {
    // Compare-and-set prevents overlapping failures or an older membership generation
    // from postponing a newly queued job. Completed jobs are removed transactionally.
    await this.db.prepare(`UPDATE event_processing_jobs SET version = version + 1, retry_stage = ?, next_attempt_at_ms = ?
      WHERE event_id = ? AND kind = ? AND version = ? AND EXISTS (
        SELECT 1 FROM events e JOIN groups g ON g.id = e.group_id
        WHERE e.id = event_processing_jobs.event_id AND e.closed_at_ms IS NULL AND g.membership_revision = ?)`)
      .bind(retryStage, nextAttemptAtMs, job.eventId, job.kind, job.version, job.revision).first();
  }

  async complete(job: EventProcessingJob): Promise<void> {
    // Usually publication already cleared the job. Handle an already-current draw
    // without leaving redundant work if an internal caller queued it again.
    if (job.kind === 'redraw') await this.db.prepare(`UPDATE events SET redraw_required = 0
      WHERE id = ? AND closed_at_ms IS NULL AND current_draw_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM groups g WHERE g.id = events.group_id
        AND g.membership_revision = events.draw_membership_revision AND g.membership_revision = ?)`)
      .bind(job.eventId, job.revision).first();
  }
}
