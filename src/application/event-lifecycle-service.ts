import { drawRecipients } from '../domain/draw.ts';
import { drawState, type EventSnapshot, type EventDrawState, type LifecycleResult } from '../domain/event-lifecycle.ts';
import { encryptRecipient, type RecipientEnvelope, type RecipientKey } from '../domain/recipient-protection.ts';
import { requireTimestamp } from '../domain/validation.ts';

export type ProtectedAssignment = Readonly<{ giverId: string; envelope: RecipientEnvelope }>;
export interface EventLifecycleStore {
  snapshot(eventId: string, actorAccountId: string, ownerOnly: boolean): Promise<EventSnapshot | null>;
  publish(snapshot: EventSnapshot, actorAccountId: string, drawId: string,
    assignments: readonly ProtectedAssignment[], nowMs: number, close: boolean): Promise<boolean>;
  close(snapshot: EventSnapshot, actorAccountId: string, nowMs: number): Promise<boolean>;
  pendingRedraws(groupId: string, actorAccountId: string, afterId: string | null): Promise<string[]>;
}

export class EventLifecycleService {
  private readonly store: EventLifecycleStore;
  private readonly key: () => Promise<RecipientKey>;
  private readonly now: () => number;
  constructor(store: EventLifecycleStore, key: () => Promise<RecipientKey>, now = Date.now) {
    this.store = store; this.key = key; this.now = now;
  }

  async state(actorAccountId: string, eventId: string): Promise<EventDrawState | null> {
    const snapshot = await this.store.snapshot(eventId, actorAccountId, false);
    return snapshot ? drawState(snapshot) : null;
  }

  async execute(actorAccountId: string, eventId: string, close = false): Promise<LifecycleResult> {
    // Retry a membership race a bounded number of times; never overwrite another committed revision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const snapshot = await this.store.snapshot(eventId, actorAccountId, true);
      if (!snapshot) return { kind: 'not-found' };
      if (snapshot.closedAtMs !== null) return { kind: 'closed' };
      if (snapshot.memberIds.length < 3) return { kind: 'insufficient-members' };
      const nowMs = this.now(); requireTimestamp(nowMs);
      if (drawState(snapshot).status === 'ready') {
        if (!close) return { kind: 'ok', state: drawState(snapshot) };
        if (await this.store.close(snapshot, actorAccountId, nowMs)) {
          return { kind: 'ok', state: { ...drawState(snapshot), status: 'closed', closedAtMs: nowMs } };
        }
        continue;
      }
      const key = await this.key();
      const drawId = crypto.randomUUID();
      const assignments: ProtectedAssignment[] = [];
      // Bound concurrent crypto work without imposing a new product participant limit.
      const permutation = drawRecipients(snapshot.memberIds);
      for (let start = 0; start < permutation.length; start += 16) {
        assignments.push(...await Promise.all(permutation.slice(start, start + 16).map(async assignment => ({
          giverId: assignment.giverId,
          envelope: await encryptRecipient(key, { drawId, giverId: assignment.giverId }, assignment.recipientId),
        }))));
      }
      if (await this.store.publish(snapshot, actorAccountId, drawId, assignments, nowMs, close)) {
        return { kind: 'ok', state: { eventId, drawId, closedAtMs: close ? nowMs : null, status: close ? 'closed' : 'ready' } };
      }
    }
    return { kind: 'conflict' };
  }

  async redrawAfterRemoval(actorAccountId: string, groupId: string): Promise<void> {
    const ids = await this.store.pendingRedraws(groupId, actorAccountId, null);
    for (const id of ids) {
      const result = await this.execute(actorAccountId, id);
      if (result.kind === 'conflict') throw new Error('Concurrent membership changes prevented redraw.');
    }
    // Bound events processed per invocation, not the number of events in a group.
    // A retry of the idempotent removal resumes flags not cleared by successful publication.
    if (ids.length > 0 && (await this.store.pendingRedraws(groupId, actorAccountId, ids[ids.length - 1])).length > 0) {
      throw new Error('More event redraws remain pending.');
    }
  }
}
