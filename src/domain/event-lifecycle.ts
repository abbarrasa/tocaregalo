export type EventSnapshot = Readonly<{
  eventId: string; groupId: string; revision: number; closedAtMs: number | null;
  currentDrawId: string | null; drawRevision: number | null; memberIds: readonly string[];
  closureAtMs: number | null;
}>;

export type EventDrawState = Readonly<{
  eventId: string; closedAtMs: number | null; drawId: string | null;
  status: 'pending' | 'ready' | 'closed';
}>;

export type LifecycleResult =
  | { kind: 'ok'; state: EventDrawState }
  | { kind: 'not-found' | 'closed' | 'insufficient-members' | 'conflict' | 'not-due' };

export function drawState(snapshot: EventSnapshot): EventDrawState {
  const closed = snapshot.closedAtMs !== null;
  const valid = snapshot.currentDrawId !== null && (closed || snapshot.drawRevision === snapshot.revision);
  return { eventId: snapshot.eventId, closedAtMs: snapshot.closedAtMs,
    drawId: valid ? snapshot.currentDrawId : null, status: closed ? 'closed' : valid ? 'ready' : 'pending' };
}
