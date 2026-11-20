import assert from 'node:assert/strict';
import test from 'node:test';
import { eventProcessingRetry, type EventProcessingJob } from '../src/domain/event-processing.ts';
import { ScheduledEventService, type EventProcessingStore } from '../src/application/scheduled-event-service.ts';
import { EventLifecycleService, type EventLifecycleStore } from '../src/application/event-lifecycle-service.ts';
import type { EventSnapshot } from '../src/domain/event-lifecycle.ts';

test('event retries increase from one to fifteen minutes without abandoning work', () => {
  let stage = 0;
  for (const minutes of [1, 2, 4, 8, 15, 15, 15, 15]) {
    const retry = eventProcessingRetry(stage, 1000);
    assert.equal(retry.nextAttemptAtMs, 1000 + minutes * 60000); stage = retry.retryStage;
  }
  for (const invalid of [-1, 6, 0.5, NaN]) assert.throws(() => eventProcessingRetry(invalid, 0), RangeError);
  assert.throws(() => eventProcessingRetry(0, Number.MAX_SAFE_INTEGER), RangeError);
});

test('scheduled processing isolates failures, persists retries and continues to redraw work', async () => {
  const deferred: Array<{ eventId: string; stage: number; at: number }> = []; const completed: string[] = [];
  const job = (eventId: string, kind: 'close' | 'redraw'): EventProcessingJob => ({
    eventId, kind, ownerAccountId: 'owner', revision: 1, version: 0, retryStage: 0,
  });
  const store: EventProcessingStore = {
    async due(kind, now) {
      assert.equal(now, 1000);
      return kind === 'close' ? ['failed', 'conflict', 'closed', 'undersized'].map(id => job(id, kind)) : [job('redrawn', kind)];
    },
    async defer(value, stage, at) { deferred.push({ eventId: value.eventId, stage, at }); },
    async complete(value) { completed.push(value.eventId); },
  };
  const service = new ScheduledEventService(store, {
    async closeScheduled(owner, id, cutoff) {
      assert.equal(owner, 'owner'); assert.equal(cutoff, 1000);
      if (id === 'failed') throw new Error('Private provider/configuration detail');
      if (id === 'conflict') return { kind: 'conflict' };
      if (id === 'undersized') return { kind: 'insufficient-members' };
      return { kind: 'ok', state: { eventId: id, status: 'closed', drawId: 'draw', closedAtMs: 1000 } };
    },
    async execute(owner, id) { assert.equal(owner, 'owner'); return { kind: 'ok', state: { eventId: id, status: 'ready', drawId: 'draw', closedAtMs: null } }; },
  }, () => 1000);
  assert.deepEqual(await service.run(), { closed: 1, redrawn: 1, deferred: 2, failed: 1 });
  assert.deepEqual(deferred, [{ eventId: 'failed', stage: 1, at: 61000 }, { eventId: 'conflict', stage: 1, at: 61000 }]);
  assert.deepEqual(completed, ['closed', 'redrawn']);
});

test('scheduler does not hide a failure to persist retry state', async () => {
  const service = new ScheduledEventService({
    async due() { return [{ eventId: 'event', kind: 'close', ownerAccountId: 'owner', revision: 1, version: 0, retryStage: 0 }]; },
    async defer() { throw new Error('Persistence unavailable'); }, async complete() { assert.fail(); },
  }, { async closeScheduled() { throw new Error('Encryption unavailable'); }, async execute() { assert.fail(); } }, () => 0);
  await assert.rejects(service.run(), /Persistence unavailable/);
});

test('scheduled lifecycle never closes null/future schedules or trusts a future supplied cutoff', async () => {
  let snapshot: EventSnapshot = { eventId: 'event', groupId: 'group', revision: 1, closureAtMs: null,
    closedAtMs: null, currentDrawId: 'draw', drawRevision: 1, memberIds: ['owner', 'a', 'b'] };
  let writes = 0;
  const store: EventLifecycleStore = {
    async snapshot() { return snapshot; }, async publish() { assert.fail(); }, async pendingRedraws() { return []; },
    async close(_snapshot, _actor, now, dueAt) { assert.equal(now, 1000); assert.equal(dueAt, 1000); writes++; return true; },
  };
  const lifecycle = new EventLifecycleService(store, async () => { assert.fail('Existing draw needs no new key'); }, () => 1000);
  assert.equal((await lifecycle.closeScheduled('owner', 'event', 1000)).kind, 'not-due');
  snapshot = { ...snapshot, closureAtMs: 1001 };
  assert.equal((await lifecycle.closeScheduled('owner', 'event', 2000)).kind, 'not-due');
  assert.equal(writes, 0);
  snapshot = { ...snapshot, closureAtMs: 1000 };
  assert.equal((await lifecycle.closeScheduled('owner', 'event', 1000)).kind, 'ok'); assert.equal(writes, 1);
});
