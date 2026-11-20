import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { MembersRepository } from '../src/persistence/members-repository.ts';
import { InvitationsRepository } from '../src/persistence/invitations-repository.ts';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { createInvitationToken, hashInvitationToken } from '../src/domain/invitations.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import { authObject } from '../src/domain/authentication.ts';
import { applyMigration } from './helpers/migrations.ts';

test('group member HTTP uses scoped D1 reads and atomic removal with invitation cancellation', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-members-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'members-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'], bindings: { APP_ORIGIN: origin,
      DRAW_KEY_ID: 'synthetic', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) },
    outboundService: async () => { assert.fail('Member operations must never send mail'); },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql',
    '0008_event_creation_order.sql', '0009_group_invitations.sql', '0010_event_draw_lifecycle.sql']) await applyMigration(db, name);
  const accounts = new AccountsRepository(db);
  const groups = new GroupsRepository(db);
  const members = new MembersRepository(db);
  const invitations = new InvitationsRepository(db);
  const draws = new DrawRepository(db);
  const sessions = new SessionService(new SessionsRepository(db));
  const credentials = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'member', 'third', 'other', 'racer', 'rollback', 'page-owner']) {
    await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
    const session = await sessions.issueForVerifiedAccount(id, 86400000);
    credentials.set(id, { Cookie: '__Host-tocaregalo_session=' + session.token, 'X-CSRF-Token': session.csrfToken });
  }
  await groups.create('owner', { id: 'group', name: 'Gifts', createdAtMs: 0 });
  await groups.create('third', { id: 'other-group', name: 'Other', createdAtMs: 0 });
  for (const id of ['member', 'third', 'rollback']) await groups.addMember('group', 'owner', id, 1234);
  await groups.addMember('other-group', 'third', 'member', 1234);
  await groups.createEvent('owner', { id: 'event', groupId: 'group', closureAtMs: null, createdAtMs: 0 });
  const key = { id: 'test-key',
    cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
  await draws.save({ id: 'draw', eventId: 'event', createdAtMs: 1000, assignments: [
    { giverId: 'owner', recipientId: 'member' }, { giverId: 'member', recipientId: 'third' }, { giverId: 'third', recipientId: 'owner' },
  ] }, key);
  const headers = (id: string) => { const value = credentials.get(id); assert.ok(value); return value; };
  const get = (path: string, actor = 'owner') => mf.dispatchFetch(origin + path, { headers: headers(actor) });
  const remove = (id: string, actor = 'owner', group = 'group', extra: Record<string, string> = {}) => mf.dispatchFetch(origin + '/api/groups/' + group + '/members/' + id, {
    method: 'DELETE', headers: { ...headers(actor), Origin: origin, ...extra },
  });
  const issue = async (id: string) => {
    const token = createInvitationToken();
    assert.ok(await invitations.issue('group', 'owner', id + '@example.test', await hashInvitationToken(token), Date.now(), Date.now() + 600000));
    return token;
  };
  const accept = (id: string, token: string) => mf.dispatchFetch(origin + '/api/invitations/accept', {
    method: 'POST', headers: { ...headers(id), Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  });

  await t.test('current members see only minimal membership fields and outsiders cannot enumerate groups', async () => {
    const response = await get('/api/groups/group/members?actorAccountId=other', 'member');
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const page = authObject(await response.json()); assert.ok(Array.isArray(page.members));
    assert.deepEqual(page.members.map(m => authObject(m).accountId), ['member', 'owner', 'rollback', 'third']);
    for (const row of page.members) assert.deepEqual(Object.keys(authObject(row)).sort(), ['accountId', 'displayName', 'isOwner', 'joinedAtMs']);
    const owner = page.members.map(authObject).find(m => m.accountId === 'owner'); assert.equal(owner?.isOwner, true);
    const member = page.members.map(authObject).find(m => m.accountId === 'member'); assert.equal(member?.joinedAtMs, 1234);
    for (const group of ['group', 'missing']) {
      const inaccessible = await get('/api/groups/' + group + '/members?actorAccountId=owner', 'other');
      assert.equal(inaccessible.status, 404); assert.deepEqual(await inaccessible.json(), { error: 'Not found' });
    }
  });

  await t.test('only owners remove and the owner is protected even from their own request', async () => {
    assert.equal((await remove('member', 'third')).status, 404);
    assert.equal((await remove('member', 'other')).status, 404);
    assert.equal((await remove('member', 'owner', 'missing')).status, 404);
    assert.equal((await remove('owner')).status, 409);
    assert.ok(await groups.findForAccount('group', 'owner'));
    assert.ok(await groups.findForAccount('group', 'member'));
    assert.equal((await remove('missing')).status, 204);
  });

  await t.test('removal revokes scoped reads and pending invitation codes but preserves encrypted draw snapshots', async () => {
    const token = await issue('member');
    const encrypted = await draws.findRecipient('draw', 'member'); assert.ok(encrypted);
    assert.equal((await remove('member')).status, 204);
    assert.equal((await remove('member')).status, 204);
    for (const path of ['/api/groups/group', '/api/groups/group/members', '/api/groups/group/events', '/api/events/event']) {
      assert.equal((await get(path, 'member')).status, 404);
    }
    assert.equal((await get('/api/me', 'member')).status, 200);
    assert.equal((await get('/api/groups/other-group', 'member')).status, 200);
    assert.equal((await accept('member', token)).status, 400);
    assert.equal(await draws.findRecipientForAccount('draw', 'member'), null);
    assert.deepEqual(await draws.findRecipient('draw', 'member'), encrypted);
    assert.equal(await decryptRecipient(new Map([[key.id, key]]), { drawId: 'draw', giverId: 'member' }, encrypted), 'third');
    assert.ok(await draws.findByEvent('event'));
    const newToken = await issue('member');
    assert.equal((await accept('member', newToken)).status, 204);
    assert.ok(await draws.findRecipientForAccount('draw', 'member'));
  });

  await t.test('a failed membership delete rolls back pending invitation cancellation', async () => {
    const token = await issue('rollback');
    await db.prepare(`CREATE TRIGGER reject_member_removal BEFORE DELETE ON group_members
      WHEN OLD.account_id = 'rollback' BEGIN SELECT RAISE(ABORT, 'synthetic private rollback'); END`).run();
    const failed = await remove('rollback');
    assert.equal(failed.status, 500); assert.equal((await failed.text()).includes('synthetic private'), false);
    assert.ok(await groups.findForAccount('group', 'rollback'));
    assert.equal(await db.prepare('SELECT token_hash FROM group_invitations WHERE group_id = ? AND email = ?')
      .bind('group', 'rollback@example.test').first('token_hash'), await hashInvitationToken(token));
    await db.prepare('DROP TRIGGER reject_member_removal').run();
    assert.equal((await remove('rollback')).status, 204);
  });

  await t.test('an old invitation cannot win a race with removal; a strictly later invitation can rejoin', async () => {
    const token = await issue('racer');
    const [accepted, removed] = await Promise.all([accept('racer', token), remove('racer')]);
    assert.ok(accepted.status === 204 || accepted.status === 400); assert.equal(removed.status, 204);
    assert.equal(await groups.findForAccount('group', 'racer'), null);
    assert.equal((await accept('racer', token)).status, 400);
    const later = await issue('racer');
    assert.equal((await accept('racer', later)).status, 204);
    assert.ok(await groups.findForAccount('group', 'racer'));
    // A resend may commit after removal captured its clock but before its batch executes.
    const capturedAt = Date.now();
    const duringRemoval = createInvitationToken();
    const duringHash = await hashInvitationToken(duringRemoval);
    await invitations.issue('group', 'owner', 'racer@example.test', duringHash, capturedAt + 10, capturedAt + 600000);
    assert.equal(await members.removeForOwner('group', 'owner', 'racer', capturedAt), 'ok');
    assert.equal(await invitations.consume(duringHash, 'racer', capturedAt + 20), false);
    assert.equal(await groups.findForAccount('group', 'racer'), null);
  });

  await t.test('keyset member pages use existing indexes and remain bounded after a cursor member leaves', async () => {
    await groups.create('page-owner', { id: 'page-group', name: 'Pages', createdAtMs: 0 });
    for (let n = 55; n >= 1; n--) {
      const id = 'list-' + String(n).padStart(2, '0');
      await accounts.create({ id, email: id + '@example.test', displayName: 'Member ' + n, createdAtMs: 0 });
      await groups.addMember('page-group', 'page-owner', id, 1000);
    }
    const first = authObject(await (await get('/api/groups/page-group/members?limit=2', 'page-owner')).json());
    assert.ok(Array.isArray(first.members)); assert.deepEqual(first.members.map(m => authObject(m).accountId), ['list-01', 'list-02']);
    assert.equal(first.nextCursor, 'list-02');
    assert.equal((await remove('list-02', 'page-owner', 'page-group')).status, 204);
    const second = authObject(await (await get('/api/groups/page-group/members?limit=2&cursor=list-02', 'page-owner')).json());
    assert.ok(Array.isArray(second.members)); assert.deepEqual(second.members.map(m => authObject(m).accountId), ['list-03', 'list-04']);
    const maximum = authObject(await (await get('/api/groups/page-group/members?limit=50', 'page-owner')).json());
    assert.ok(Array.isArray(maximum.members)); assert.equal(maximum.members.length, 50); assert.equal(maximum.nextCursor, 'list-51');
    const last = authObject(await (await get('/api/groups/page-group/members?limit=50&cursor=list-51', 'page-owner')).json());
    assert.ok(Array.isArray(last.members)); assert.deepEqual(last.members.map(m => authObject(m).accountId), ['list-52', 'list-53', 'list-54', 'list-55', 'page-owner']);
    assert.equal(last.nextCursor, null);
    assert.deepEqual(await (await get('/api/groups/page-group/members?cursor=zzzz', 'page-owner')).json(), { members: [], nextCursor: null });
    const defaults = authObject(await (await get('/api/groups/page-group/members', 'page-owner')).json());
    assert.ok(Array.isArray(defaults.members)); assert.equal(defaults.members.length, 20);
    const plan = await db.prepare(`EXPLAIN QUERY PLAN SELECT m.account_id FROM group_members actor
      JOIN groups g ON g.id = actor.group_id LEFT JOIN group_members m ON m.group_id = g.id AND m.account_id > ?
      LEFT JOIN accounts a ON a.id = m.account_id WHERE actor.group_id = ? AND actor.account_id = ? ORDER BY m.account_id LIMIT ?`)
      .bind('list-02', 'page-group', 'page-owner', 51).all<{ detail: string }>();
    assert.equal(plan.results.some(row => row.detail.includes('TEMP B-TREE')), false);
    await assert.rejects(members.listForMember('group', 'owner', 52, null), RangeError);
  });

  await t.test('HTTP boundaries reject invalid pages, malformed IDs, sessions, CSRF and methods', async () => {
    const path = origin + '/api/groups/group/members';
    assert.equal((await mf.dispatchFetch(path)).status, 401);
    for (const query of ['?limit=0', '?limit=51', '?limit=1.5', '?limit=2&limit=3', '?cursor=', '?cursor=a&cursor=b']) {
      assert.equal((await get('/api/groups/group/members' + query)).status, 400);
    }
    assert.equal((await remove('third', 'owner', 'group', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await remove('third', 'owner', 'group', { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await remove('third', 'owner', 'group', { Cookie: '' })).status, 401);
    const expired = await new SessionService(new SessionsRepository(db), () => 0).issueForVerifiedAccount('owner', 1000);
    assert.equal((await remove('third', 'owner', 'group', { Cookie: '__Host-tocaregalo_session=' + expired.token })).status, 401);
    assert.equal((await remove('%E0%A4%A')).status, 400);
    assert.equal((await remove('%20')).status, 400);
    const unsupported = await mf.dispatchFetch(path, { method: 'POST' });
    assert.equal(unsupported.status, 405); assert.equal(unsupported.headers.get('Allow'), 'GET');
    assert.equal((await get('/api/groups/group/members/third')).status, 405);
    assert.ok(await groups.findForAccount('group', 'third'));
  });
});
