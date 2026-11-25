import assert from 'node:assert/strict';
import test from 'node:test';
import { GroupInputError, groupNameInput, groupPageInput, type Group } from '../src/domain/groups.ts';
import { GroupService, type GroupStore } from '../src/application/group-service.ts';

test('group input uses existing name rules and bounded unambiguous page sizes', () => {
  assert.equal(groupNameInput({ name: ' Gifts ', ownerAccountId: 'ignored' }), 'Gifts');
  for (const input of [null, [], {}, { name: '' }, { name: '  ' }, { name: 1 }, { name: 'a'.repeat(101) }]) {
    assert.throws(() => groupNameInput(input), GroupInputError);
  }
  assert.deepEqual(groupPageInput(null, null), { limit: 20, cursor: null });
  assert.deepEqual(groupPageInput('50', 'last-id'), { limit: 50, cursor: 'last-id' });
  for (const limit of ['', '0', '-1', '51', '100', '1.5', '01', ' 2', 'Infinity']) {
    assert.throws(() => groupPageInput(limit, null), GroupInputError);
  }
  for (const cursor of ['', ' ', 'x'.repeat(513)]) assert.throws(() => groupPageInput(null, cursor), GroupInputError);
});

test('group service generates identity and time, propagates failures and emits cursors only for more rows', async () => {
  const saved: Group[] = [];
  const store: GroupStore = {
    async create(actor, group) { saved.push({ ...group, ownerAccountId: actor }); },
    async findForAccount(id, actor) { return saved.find(g => g.id === id && g.ownerAccountId === actor) ?? null; },
    async listForAccount(actor, limit, after) {
      return saved.filter(g => g.ownerAccountId === actor && (after === null || g.id > after))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, limit);
    },
  };
  const service = new GroupService(store, () => 1234);
  const first = await service.create('owner', ' First ');
  const second = await service.create('owner', 'Second');
  assert.equal(first.name, 'First');
  assert.equal(first.ownerAccountId, 'owner');
  assert.equal(first.createdAtMs, 1234);
  assert.match(first.id, /^[a-f0-9-]{36}$/);
  assert.notEqual(first.id, second.id);
  assert.equal(await service.find('other', first.id), null);
  const page = await service.list('owner', { limit: 1, cursor: null });
  assert.equal(page.groups.length, 1);
  assert.equal(page.nextCursor, page.groups[0].id);
  const next = await service.list('owner', { limit: 1, cursor: page.nextCursor });
  assert.equal(next.groups.length, 1);
  assert.equal(next.nextCursor, null);
  assert.notEqual(next.groups[0].id, page.groups[0].id);
  const failing = new GroupService({ ...store, async create() { throw new Error('storage failure'); } });
  await assert.rejects(failing.create('owner', 'Test'), /storage failure/);
});
