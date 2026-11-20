import assert from 'node:assert/strict';
import test from 'node:test';
import { EventLifecycleService, type EventLifecycleStore } from '../src/application/event-lifecycle-service.ts';
import { drawState, type EventSnapshot } from '../src/domain/event-lifecycle.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import { loadRecipientKey, RecipientKeyUnavailable } from '../src/infrastructure/recipient-key.ts';

const snapshot: EventSnapshot = { eventId: 'event', groupId: 'group', revision: 1,
  closedAtMs: null, currentDrawId: null, drawRevision: null, memberIds: ['owner', 'a', 'b'] };

test('draw state hides stale assignments and keeps closed snapshots independent of current membership', () => {
  assert.equal(drawState(snapshot).status, 'pending');
  const ready = { ...snapshot, currentDrawId: 'draw', drawRevision: 1 };
  assert.equal(drawState(ready).drawId, 'draw');
  assert.equal(drawState({ ...ready, revision: 2 }).drawId, null);
  assert.deepEqual(drawState({ ...ready, revision: 2, closedAtMs: 100 }), {
    eventId: 'event', drawId: 'draw', status: 'closed', closedAtMs: 100,
  });
});

test('lifecycle encrypts a complete permutation, retries stale publication and bounds contention', async () => {
  const key = {
    id: 'synthetic', cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
  let writes = 0;
  const store: EventLifecycleStore = {
    async snapshot() { return snapshot; },
    async publish(value, actor, drawId, assignments, now, close) {
      assert.equal(actor, 'owner'); assert.equal(now, 1000); assert.equal(close, false);
      assert.deepEqual(assignments.map(a => a.giverId), value.memberIds);
      const recipients = [];
      for (const assignment of assignments) {
        const recipient = await decryptRecipient(new Map([[key.id, key]]),
          { drawId, giverId: assignment.giverId }, assignment.envelope);
        assert.notEqual(recipient, assignment.giverId); recipients.push(recipient);
      }
      assert.deepEqual(new Set(recipients), new Set(snapshot.memberIds));
      return ++writes === 2;
    },
    async close() { assert.fail('No close expected'); },
    async pendingRedraws() { return []; },
  };
  const service = new EventLifecycleService(store, async () => key, () => 1000);
  assert.equal((await service.execute('owner', 'event')).kind, 'ok'); assert.equal(writes, 2);
  writes = 10;
  assert.equal((await service.execute('owner', 'event')).kind, 'conflict'); assert.equal(writes, 13);
});

test('lifecycle refuses missing, closed or undersized events without loading keys', async () => {
  let value: EventSnapshot | null = null;
  const store: EventLifecycleStore = {
    async snapshot() { return value; }, async publish() { assert.fail(); },
    async close() { assert.fail(); }, async pendingRedraws() { return []; },
  };
  const service = new EventLifecycleService(store, async () => { assert.fail('No crypto needed'); });
  assert.equal((await service.execute('owner', 'event')).kind, 'not-found');
  value = { ...snapshot, closedAtMs: 0 };
  assert.equal((await service.execute('owner', 'event', true)).kind, 'closed');
  value = { ...snapshot, memberIds: ['owner', 'a'] };
  assert.equal((await service.execute('owner', 'event', true)).kind, 'insufficient-members');
  value = { ...snapshot, currentDrawId: 'draw', drawRevision: 1 };
  assert.equal((await service.execute('owner', 'event')).kind, 'ok');
});

test('recipient key configuration fails closed and imports separate nonextractable write keys', async () => {
  for (const settings of [{}, { DRAW_KEY_ID: 'v1', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '01'.repeat(32) },
    { DRAW_KEY_ID: 'v1', DRAW_CIPHER_KEY_HEX: 'bad', DRAW_INDEX_KEY_HEX: '02'.repeat(32) }]) {
    await assert.rejects(loadRecipientKey(settings), RecipientKeyUnavailable);
  }
  const key = await loadRecipientKey({ DRAW_KEY_ID: 'v1', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) });
  assert.equal(key.id, 'v1'); assert.equal(key.cipher.extractable, false); assert.equal(key.index.extractable, false);
});
