import assert from 'node:assert/strict';
import test from 'node:test';
import { drawRecipients, shuffled } from '../src/domain/draw.ts';
import { isClosedAt, isClosureOnTime, nextDeliveryAt } from '../src/domain/timing.ts';

test('draw gives every member exactly one different recipient', () => {
  for (const count of [3, 4, 7, 40]) {
    const members = Array.from({ length: count }, (_, i) => 'member-' + i);
    for (let attempt = 0; attempt < 30; attempt++) {
      const assignments = drawRecipients(members);
      assert.deepEqual(assignments.map(({ giverId }) => giverId), members);
      assert.deepEqual(new Set(assignments.map(({ recipientId }) => recipientId)), new Set(members));
      assert.ok(assignments.every(({ giverId, recipientId }) => giverId !== recipientId));
    }
  }
});

test('all 24 equally probable shuffle paths yield unique permutations and 9 valid draws', () => {
  const members = ['owner', 'member-a', 'member-b', 'member-c'];
  const all = new Set<string>();
  const valid = new Set<string>();
  for (let fourth = 0; fourth < 4; fourth++) {
    for (let third = 0; third < 3; third++) {
      for (let second = 0; second < 2; second++) {
        const choices = [fourth, third, second];
        const order = shuffled(members, () => choices.shift()!);
        all.add(order.join(','));
        if (order.every((member, i) => member !== members[i])) valid.add(order.join(','));
      }
    }
  }
  assert.equal(all.size, 24);
  assert.equal(valid.size, 9);
});

test('the draw rejects a fixed point and retries the whole permutation', () => {
  const members = ['owner', 'a', 'b'];
  const choices = [2, 1, 0, 0];
  assert.deepEqual(drawRecipients(members, () => choices.shift()!), [
    { giverId: 'owner', recipientId: 'a' },
    { giverId: 'a', recipientId: 'b' },
    { giverId: 'b', recipientId: 'owner' },
  ]);
  assert.equal(choices.length, 0);
  assert.throws(() => drawRecipients(['owner', 'a']), RangeError);
  assert.throws(() => drawRecipients(['owner', 'a', 'a']), RangeError);
});

test('the closure boundary is inclusive and background processing has a 60-second budget', () => {
  const closure = 50_000;
  assert.equal(isClosedAt(null, closure), false);
  assert.equal(isClosedAt(closure, closure - 1), false);
  assert.equal(isClosedAt(closure, closure), true);
  assert.equal(isClosedAt(closure, closure + 1), true);
  assert.equal(isClosureOnTime(closure, closure - 1), false);
  assert.equal(isClosureOnTime(closure, closure + 60_000), true);
  assert.equal(isClosureOnTime(closure, closure + 60_001), false);
});

test('delivery retries are scheduled from each preceding failure and stop after six attempts', () => {
  const failedAt = 8_000_000;
  for (const [i, delay] of [30, 60, 120, 240, 480].entries()) {
    assert.equal(nextDeliveryAt(i + 1, failedAt, 30_000), failedAt + delay * 1_000);
  }
  assert.equal(nextDeliveryAt(1, failedAt, 17), failedAt + 17);
  assert.equal(nextDeliveryAt(6, failedAt, 30_000), null);
  assert.throws(() => nextDeliveryAt(0, failedAt, 30_000), RangeError);
  assert.throws(() => nextDeliveryAt(1, failedAt, 0), RangeError);
});
