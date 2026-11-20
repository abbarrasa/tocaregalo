import assert from 'node:assert/strict';
import test from 'node:test';
import { MemberInputError, memberPageInput } from '../src/domain/members.ts';
import { MemberService, type MemberStore } from '../src/application/member-service.ts';

test('member pagination preserves bounds and typed input failures', () => {
  assert.deepEqual(memberPageInput(null, null), { limit: 20, cursor: null });
  assert.deepEqual(memberPageInput('50', 'member-id'), { limit: 50, cursor: 'member-id' });
  for (const limit of ['0', '51', '01', '1.5', '-1']) assert.throws(() => memberPageInput(limit, null), MemberInputError);
  for (const cursor of ['', ' ', 'x'.repeat(513)]) assert.throws(() => memberPageInput(null, cursor), MemberInputError);
});

test('member service distinguishes inaccessible lists and delegates removal with server time', async () => {
  const store: MemberStore = {
    async listForMember(group, actor, limit, after) {
      if (actor !== 'owner') return null;
      if (group === 'empty') return [];
      assert.equal(limit, 2); assert.equal(after, null);
      return [
        { accountId: 'a', displayName: 'Alice', joinedAtMs: 0, isOwner: false },
        { accountId: 'owner', displayName: 'Owner', joinedAtMs: 0, isOwner: true },
      ];
    },
    async removeForOwner(group, actor, target, now) {
      assert.equal(group, 'group'); assert.equal(now, 1000);
      return actor !== 'owner' ? 'not-found' : target === actor ? 'owner-protected' : 'ok';
    },
  };
  const service = new MemberService(store, () => 1000);
  assert.equal(await service.list('other', 'group', { limit: 1, cursor: null }), null);
  assert.deepEqual(await service.list('owner', 'empty', { limit: 1, cursor: null }), { members: [], nextCursor: null });
  assert.deepEqual(await service.list('owner', 'group', { limit: 1, cursor: null }), {
    members: [{ accountId: 'a', displayName: 'Alice', joinedAtMs: 0, isOwner: false }], nextCursor: 'a',
  });
  assert.equal(await service.remove('owner', 'group', 'member'), 'ok');
  assert.equal(await service.remove('owner', 'group', 'owner'), 'owner-protected');
  assert.equal(await service.remove('other', 'group', 'member'), 'not-found');
});
