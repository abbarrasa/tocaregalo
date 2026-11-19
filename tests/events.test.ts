import assert from 'node:assert/strict';
import test from 'node:test';
import { EventInputError, eventCreationInput, type GroupEvent } from '../src/domain/events.ts';
import { EventService, type EventStore } from '../src/application/event-service.ts';
import { GroupAccessError } from '../src/domain/groups.ts';

test('event input requires an explicit nullable safe-integer closure without coercion', () => {
  assert.deepEqual(eventCreationInput({ closureAtMs: null }), { closureAtMs: null });
  assert.deepEqual(eventCreationInput({ closureAtMs: 1234, groupId: 'ignored' }), { closureAtMs: 1234 });
  for (const input of [null, [], {}, { closureAtMs: undefined }, { closureAtMs: '1234' },
    { closureAtMs: true }, { closureAtMs: 1.5 }, { closureAtMs: NaN }, { closureAtMs: Infinity },
    { closureAtMs: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => eventCreationInput(input), EventInputError);
  }
});

test('event service checks the exact creation boundary and generates trusted fields before owner-scoped insertion', async () => {
  const saved: GroupEvent[] = [];
  const store: EventStore = {
    async createEvent(actor, event) {
      if (actor !== 'owner') throw new GroupAccessError();
      saved.push(event);
    },
    async findEventForAccount(id, actor) { return actor === 'owner' ? saved.find(e => e.id === id) ?? null : null; },
  };
  let now = 1000;
  const service = new EventService(store, () => now);
  for (const closureAtMs of [999, 1000]) {
    await assert.rejects(service.create('owner', 'group', { closureAtMs }), EventInputError);
  }
  assert.equal(saved.length, 0);
  const scheduled = await service.create('owner', 'group', { closureAtMs: 1001 });
  assert.equal(scheduled.groupId, 'group');
  assert.equal(scheduled.createdAtMs, 1000);
  assert.equal(scheduled.closureAtMs, 1001);
  assert.match(scheduled.id, /^[a-f0-9-]{36}$/);
  const manual = await service.create('owner', 'group', { closureAtMs: null });
  assert.equal(manual.closureAtMs, null);
  assert.notEqual(manual.id, scheduled.id);
  now = 1001;
  await assert.rejects(service.create('owner', 'group', { closureAtMs: 1001 }), EventInputError);
  await assert.rejects(service.create('member', 'group', { closureAtMs: null }), GroupAccessError);
  assert.equal(await service.find('owner', scheduled.id), scheduled);
  assert.equal(await service.find('other', scheduled.id), null);
});
