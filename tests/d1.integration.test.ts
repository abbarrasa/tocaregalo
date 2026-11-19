import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository, GroupAccessError } from '../src/persistence/groups-repository.ts';

test('D1 binding persists ciphertext, enforces uniqueness and rolls back failed batches', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'test',
    modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-11-19',
    d1Databases: ['DB'],
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  // This initial migration contains plain DDL only, with no embedded semicolons.
  const sql = await readFile(new URL('../migrations/0001_draws.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  await db.prepare('INSERT INTO events VALUES (?, ?, ?)').bind('event', 1000, 0).run();
  const repository = new DrawRepository(db);
  const key = {
    id: 'v1',
    cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
  const draw = {
    id: 'draw', eventId: 'event', createdAtMs: 1000,
    assignments: [
      { giverId: 'owner', recipientId: 'a' },
      { giverId: 'a', recipientId: 'b' },
      { giverId: 'b', recipientId: 'owner' },
    ],
  };
  await repository.save(draw, key);
  const envelope = await repository.findRecipient('draw', 'owner');
  assert.ok(envelope);
  assert.equal(await decryptRecipient(new Map([[key.id, key]]),
    { drawId: 'draw', giverId: 'owner' }, envelope), 'a');
  await assert.rejects(repository.save({ ...draw, id: 'replacement' }, key));
  assert.deepEqual(await repository.findByEvent('event'), { id: 'draw', createdAtMs: 1000 });
  await db.prepare('INSERT INTO events VALUES (?, ?, ?)').bind('failed-event', null, 0).run();
  await db.prepare(`CREATE TRIGGER fail_assignment BEFORE INSERT ON assignments
    WHEN NEW.draw_id = 'failed-draw' AND NEW.giver_id = 'a'
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END`).run();
  await assert.rejects(repository.save({ ...draw, id: 'failed-draw', eventId: 'failed-event' }, key));
  assert.equal(await repository.findByEvent('failed-event'), null);
  assert.equal(await repository.findRecipient('failed-draw', 'owner'), null);
  assert.equal(await db.prepare('SELECT count(*) AS n FROM draw_participants WHERE draw_id = ?')
    .bind('failed-draw').first('n'), 0);
  await db.prepare('DELETE FROM events WHERE id = ?').bind('event').run();
  assert.equal(await repository.findRecipient('draw', 'owner'), null);
});

test('accounts, groups and membership checks work against D1 after upgrading existing data', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'groups-test', modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  async function migrate(name: string) {
    // Both migrations currently contain plain DDL, with no embedded semicolons.
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  }
  await migrate('0001_draws.sql');
  await db.prepare('INSERT INTO events VALUES (?, ?, ?)').bind('legacy-event', null, 0).run();
  await migrate('0002_accounts_groups.sql');
  await migrate('0003_sessions.sql');
  await migrate('0004_public_auth.sql');
  const accounts = new AccountsRepository(db);
  const groups = new GroupsRepository(db);
  const draws = new DrawRepository(db);

  await t.test('account provisioning normalizes emails and rejects duplicates and invalid values', async () => {
    for (const id of ['owner', 'member', 'other', 'third']) {
      await accounts.create({ id, email: `  ${id.toUpperCase()}@EXAMPLE.TEST `, displayName: ` ${id} `, createdAtMs: 0 });
    }
    assert.deepEqual(await accounts.findSelf('owner'), {
      id: 'owner', email: 'owner@example.test', displayName: 'owner', createdAtMs: 0,
      lastName: null, phone: null,
    });
    assert.equal(await accounts.findSelf('missing'), null);
    await assert.rejects(accounts.create({ id: 'duplicate', email: 'OWNER@example.test', displayName: 'Test', createdAtMs: 0 }));
    await assert.rejects(accounts.create({ id: 'invalid', email: 'invalid', displayName: 'Test', createdAtMs: 0 }), RangeError);
    await assert.rejects(accounts.create({ id: 'blank', email: 'blank@example.test', displayName: ' ', createdAtMs: 0 }), RangeError);
  });

  await t.test('group and owner membership are created atomically', async () => {
    await groups.create('owner', { id: 'group', name: ' Gifts ', createdAtMs: 0 });
    assert.deepEqual(await groups.findForAccount('group', 'owner'), {
      id: 'group', name: 'Gifts', ownerAccountId: 'owner', createdAtMs: 0,
    });
    await assert.rejects(groups.create('missing', { id: 'bad-owner', name: 'Test', createdAtMs: 0 }));
    await db.prepare(`CREATE TRIGGER fail_owner BEFORE INSERT ON group_members
      WHEN NEW.group_id = 'failed-group' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`).run();
    await assert.rejects(groups.create('owner', { id: 'failed-group', name: 'Test', createdAtMs: 0 }));
    assert.equal(await db.prepare('SELECT id FROM groups WHERE id = ?').bind('failed-group').first(), null);
    assert.equal(await groups.removeMember('group', 'owner', 'owner'), false);
    assert.ok(await groups.findForAccount('group', 'owner'));
  });

  await t.test('only owners add or remove members and create events', async () => {
    await groups.addMember('group', 'owner', 'member', 1);
    await groups.addMember('group', 'owner', 'third', 1);
    await groups.create('other', { id: 'other-group', name: 'Other group', createdAtMs: 0 });
    assert.equal(await groups.findForAccount('group', 'other'), null);
    await assert.rejects(groups.addMember('group', 'other', 'other', 1), GroupAccessError);
    await assert.rejects(groups.addMember('group', 'member', 'other', 1), GroupAccessError);
    await assert.rejects(groups.addMember('group', 'owner', 'missing', 1));
    await assert.rejects(groups.addMember('group', 'owner', 'member', 1));
    assert.equal(await groups.removeMember('group', 'other', 'member'), false);
    assert.equal(await groups.removeMember('group', 'member', 'third'), false);
    const event = { id: 'event', groupId: 'group', closureAtMs: 1000, createdAtMs: 0 };
    await assert.rejects(groups.createEvent('member', event), GroupAccessError);
    await assert.rejects(groups.createEvent('other', event), GroupAccessError);
    await groups.createEvent('owner', event);
    assert.deepEqual(await groups.findEventForAccount('event', 'member'), event);
    assert.equal(await groups.findEventForAccount('event', 'other'), null);
    assert.equal(await groups.findEventForAccount('legacy-event', 'owner'), null);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM events WHERE id = ?').bind('legacy-event').first('n'), 1);
  });

  await t.test('assignments are scoped to the session account and revoked on membership removal', async () => {
    const key = {
      id: 'v1',
      cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
      index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    };
    await draws.save({ id: 'draw', eventId: 'event', createdAtMs: 1000, assignments: [
      { giverId: 'owner', recipientId: 'member' },
      { giverId: 'member', recipientId: 'third' },
      { giverId: 'third', recipientId: 'owner' },
    ] }, key);
    const envelope = await draws.findRecipientForAccount('draw', 'member');
    assert.ok(envelope);
    assert.equal(await decryptRecipient(new Map([[key.id, key]]),
      { drawId: 'draw', giverId: 'member' }, envelope), 'third');
    assert.equal(await draws.findRecipientForAccount('draw', 'other'), null);
    assert.equal(await groups.removeMember('group', 'owner', 'member'), true);
    assert.equal(await groups.removeMember('group', 'owner', 'member'), false);
    assert.equal(await groups.findForAccount('group', 'member'), null);
    assert.equal(await groups.findEventForAccount('event', 'member'), null);
    assert.equal(await draws.findRecipientForAccount('draw', 'member'), null);
    assert.ok(await draws.findRecipientForAccount('draw', 'owner'));
    // Revoking access preserves the encrypted snapshot for domain deletion policy.
    assert.ok(await draws.findRecipient('draw', 'member'));
  });

  await t.test('foreign keys protect owners and cascade group data consistently', async () => {
    await assert.rejects(db.prepare('DELETE FROM accounts WHERE id = ?').bind('owner').run());
    await db.prepare('DELETE FROM groups WHERE id = ?').bind('group').run();
    assert.equal(await draws.findByEvent('event'), null);
    assert.equal(await draws.findRecipient('draw', 'owner'), null);
    assert.equal(await groups.findForAccount('group', 'owner'), null);
    assert.ok(await accounts.findSelf('owner'));
    assert.ok(await groups.findForAccount('other-group', 'other'));
  });
});
