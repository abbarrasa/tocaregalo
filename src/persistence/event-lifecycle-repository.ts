import type { EventLifecycleStore, ProtectedAssignment } from '../application/event-lifecycle-service.ts';
import type { EventSnapshot } from '../domain/event-lifecycle.ts';
import type { PersistenceDatabase } from './d1.ts';

export class EventLifecycleRepository implements EventLifecycleStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async snapshot(eventId: string, actorAccountId: string, ownerOnly: boolean): Promise<EventSnapshot | null> {
    const rows = (await this.db.prepare(`SELECT e.id AS eventId, e.group_id AS groupId,
      e.closed_at_ms AS closedAtMs, e.current_draw_id AS currentDrawId, e.closure_at_ms AS closureAtMs,
      e.draw_membership_revision AS drawRevision, g.membership_revision AS revision,
      ${ownerOnly ? 'm.account_id' : 'NULL'} AS memberId
      FROM events e JOIN groups g ON g.id = e.group_id ${ownerOnly ? 'JOIN group_members m ON m.group_id = g.id' : ''}
      WHERE e.id = ? AND ${ownerOnly ? 'g.owner_account_id = ?' :
        'EXISTS (SELECT 1 FROM group_members actor WHERE actor.group_id = g.id AND actor.account_id = ?)'}
      ${ownerOnly ? 'ORDER BY m.account_id' : ''}`).bind(eventId, actorAccountId)
      .all<Omit<EventSnapshot, 'memberIds'> & { memberId: string | null }>()).results;
    if (rows.length === 0) return null;
    const { memberId: _, ...metadata } = rows[0];
    // Metadata reads do not load the full participant snapshot needed by mutations.
    return { ...metadata, memberIds: rows.flatMap(row => row.memberId === null ? [] : [row.memberId]) };
  }

  async publish(snapshot: EventSnapshot, actorAccountId: string, drawId: string,
    assignments: readonly ProtectedAssignment[], nowMs: number, close: boolean, dueAtMs: number | null = null): Promise<boolean> {
    const statements = [this.db.prepare(`INSERT INTO draws (id, event_id, created_at_ms, membership_revision)
      SELECT ?, e.id, ?, g.membership_revision FROM events e JOIN groups g ON g.id = e.group_id
      WHERE e.id = ? AND e.group_id = ? AND g.owner_account_id = ? AND g.membership_revision = ? AND e.closed_at_ms IS NULL
      AND (? IS NULL OR (e.closure_at_ms IS NOT NULL AND e.closure_at_ms <= ?))
      AND (e.draw_membership_revision IS NULL OR e.draw_membership_revision <> g.membership_revision)`)
      .bind(drawId, nowMs, snapshot.eventId, snapshot.groupId, actorAccountId, snapshot.revision, dueAtMs, dueAtMs)];
    for (const { giverId, envelope } of assignments) {
      statements.push(this.db.prepare(`INSERT INTO draw_participants (draw_id, member_id)
        SELECT id, ? FROM draws WHERE id = ?`).bind(giverId, drawId));
      statements.push(this.db.prepare(`INSERT INTO assignments (draw_id, giver_id, key_id, iv, ciphertext, recipient_index)
        SELECT id, ?, ?, ?, ?, ? FROM draws WHERE id = ?`)
        .bind(giverId, envelope.keyId, envelope.iv, envelope.ciphertext, envelope.recipientIndex, drawId));
    }
    statements.push(this.db.prepare(`UPDATE events SET current_draw_id = ?, draw_membership_revision = ?,
      closed_at_ms = ?, redraw_required = 0 WHERE id = ? AND closed_at_ms IS NULL
      AND EXISTS (SELECT 1 FROM draws WHERE id = ? AND event_id = events.id)
      RETURNING id`).bind(drawId, snapshot.revision, close ? nowMs : null, snapshot.eventId, drawId));
    const result = await this.db.batch(statements);
    return result[result.length - 1].results.length === 1;
  }

  async close(snapshot: EventSnapshot, actorAccountId: string, nowMs: number, dueAtMs: number | null = null): Promise<boolean> {
    return (await this.db.prepare(`UPDATE events SET closed_at_ms = ?, redraw_required = 0
      WHERE id = ? AND group_id = ? AND closed_at_ms IS NULL AND current_draw_id = ? AND draw_membership_revision = ?
      AND (? IS NULL OR (closure_at_ms IS NOT NULL AND closure_at_ms <= ?))
      AND EXISTS (SELECT 1 FROM groups g WHERE g.id = events.group_id
        AND g.owner_account_id = ? AND g.membership_revision = ?)
      RETURNING id`).bind(nowMs, snapshot.eventId, snapshot.groupId, snapshot.currentDrawId, snapshot.revision,
        dueAtMs, dueAtMs, actorAccountId, snapshot.revision).first()) !== null;
  }

  async pendingRedraws(groupId: string, actorAccountId: string, afterId: string | null): Promise<string[]> {
    const rows = await this.db.prepare(`SELECT e.id FROM events e JOIN groups g ON g.id = e.group_id
      WHERE e.group_id = ? AND g.owner_account_id = ? AND e.closed_at_ms IS NULL AND e.redraw_required = 1
      AND EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id LIMIT 1 OFFSET 2)
      AND (? IS NULL OR e.id > ?) ORDER BY e.id LIMIT 20`).bind(groupId, actorAccountId, afterId, afterId).all<{ id: string }>();
    return rows.results.map(row => row.id);
  }
}
