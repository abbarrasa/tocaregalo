import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { authObject } from '../src/domain/authentication.ts';

test('authenticated group API runs against the bundled Worker and D1', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-groups-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'groups-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'], bindings: { APP_ORIGIN: origin },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql']) {
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  }
  const accounts = new AccountsRepository(db);
  const groups = new GroupsRepository(db);
  const sessions = new SessionService(new SessionsRepository(db));
  const headers = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'member', 'other', 'pages', 'empty']) {
    await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
    const issued = await sessions.issueForVerifiedAccount(id, 86400000);
    headers.set(id, { Cookie: '__Host-tocaregalo_session=' + issued.token, 'X-CSRF-Token': issued.csrfToken });
  }
  const as = (id: string) => { const value = headers.get(id); assert.ok(value); return value; };
  const get = (path: string, id = 'owner') => mf.dispatchFetch(origin + path, { headers: as(id) });
  const post = (body: unknown, extra: Record<string, string> = {}) => mf.dispatchFetch(origin + '/api/groups', {
    method: 'POST', headers: { ...as('owner'), Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
  });
  let createdId = '';

  await t.test('creation derives owner, id and timestamps from trusted inputs and creates owner membership', async () => {
    const before = Date.now();
    const response = await post({ name: ' Gifts ', id: 'forged', ownerAccountId: 'other', actorAccountId: 'other', createdAtMs: 0 });
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const group = authObject(authObject(await response.json()).group);
    assert.ok(typeof group.id === 'string'); createdId = group.id;
    assert.notEqual(createdId, 'forged');
    assert.equal(group.name, 'Gifts');
    assert.equal(group.ownerAccountId, 'owner');
    assert.ok(typeof group.createdAtMs === 'number' && group.createdAtMs >= before && group.createdAtMs <= Date.now());
    assert.equal(response.headers.get('Location'), '/api/groups/' + createdId);
    assert.ok(await groups.findForAccount(createdId, 'owner'));
    assert.equal(await groups.findForAccount(createdId, 'other'), null);
    const count = await db.prepare('SELECT count(*) AS n FROM group_members WHERE group_id = ?').bind(createdId).first('n');
    assert.equal(count, 1);
  });

  await t.test('reads hide inaccessible resources and membership revocation takes effect immediately', async () => {
    const own = await get('/api/groups/' + createdId + '?actorAccountId=other');
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('Cache-Control'), 'no-store');
    const forbidden = await get('/api/groups/' + createdId, 'other');
    const missing = await get('/api/groups/missing', 'other');
    assert.equal(forbidden.status, 404);
    assert.equal(missing.status, 404);
    assert.deepEqual(await forbidden.json(), await missing.json());
    await groups.addMember(createdId, 'owner', 'member', 1);
    assert.equal((await get('/api/groups/' + createdId, 'member')).status, 200);
    assert.equal(await groups.removeMember(createdId, 'owner', 'member'), true);
    assert.equal((await get('/api/groups/' + createdId, 'member')).status, 404);
    const list = authObject(await (await get('/api/groups', 'member')).json());
    assert.deepEqual(list.groups, []);
    assert.equal(list.nextCursor, null);
  });

  await t.test('keyset pages are bounded and stable for tied timestamps, deletion and foreign cursors', async () => {
    // IDs deliberately differ from insertion order, all with the same timestamp.
    for (const id of ['page-03', 'page-01', 'page-05', 'page-02', 'page-04']) {
      await groups.create('pages', { id, name: id, createdAtMs: 0 });
    }
    const first = authObject(await (await get('/api/groups?limit=2', 'pages')).json());
    assert.deepEqual(first.groups, [
      { id: 'page-01', name: 'page-01', ownerAccountId: 'pages', createdAtMs: 0 },
      { id: 'page-02', name: 'page-02', ownerAccountId: 'pages', createdAtMs: 0 },
    ]);
    assert.equal(first.nextCursor, 'page-02');
    await db.prepare('DELETE FROM groups WHERE id = ?').bind('page-02').run();
    const second = authObject(await (await get('/api/groups?limit=2&cursor=page-02', 'pages')).json());
    assert.ok(Array.isArray(second.groups));
    assert.deepEqual(second.groups.map(g => authObject(g).id), ['page-03', 'page-04']);
    assert.equal(second.nextCursor, 'page-04');
    const last = authObject(await (await get('/api/groups?limit=2&cursor=page-04', 'pages')).json());
    assert.ok(Array.isArray(last.groups));
    assert.deepEqual(last.groups.map(g => authObject(g).id), ['page-05']);
    assert.equal(last.nextCursor, null);
    const foreign = authObject(await (await get('/api/groups?cursor=page-01&actorAccountId=pages', 'other')).json());
    assert.deepEqual(foreign.groups, []);
    const empty = authObject(await (await get('/api/groups', 'empty')).json());
    assert.deepEqual(empty, { groups: [], nextCursor: null });
    for (const limit of ['0', '51', '-1', '1.5', '01', '2&limit=3']) {
      assert.equal((await get('/api/groups?limit=' + limit)).status, 400);
    }
    assert.equal((await get('/api/groups?cursor=')).status, 400);
    assert.equal((await get('/api/groups?cursor=a&cursor=b')).status, 400);
    assert.equal((await get('/api/groups?limit=50')).status, 200);
    await assert.rejects(groups.listForAccount('owner', 52, null), RangeError);
    for (let n = 6; n <= 55; n++) {
      const id = 'page-' + String(n).padStart(2, '0');
      await groups.create('pages', { id, name: id, createdAtMs: 0 });
    }
    const maximum = authObject(await (await get('/api/groups?limit=50', 'pages')).json());
    assert.ok(Array.isArray(maximum.groups));
    assert.equal(maximum.groups.length, 50);
    assert.equal(maximum.nextCursor, 'page-51');
    const remaining = authObject(await (await get('/api/groups?limit=50&cursor=page-51', 'pages')).json());
    assert.ok(Array.isArray(remaining.groups));
    assert.deepEqual(remaining.groups.map(g => authObject(g).id), ['page-52', 'page-53', 'page-54', 'page-55']);
    assert.equal(remaining.nextCursor, null);
    const defaults = authObject(await (await get('/api/groups', 'pages')).json());
    assert.ok(Array.isArray(defaults.groups));
    assert.equal(defaults.groups.length, 20);
  });

  await t.test('authentication and write CSRF/origin protections reject forged or expired sessions', async () => {
    assert.equal((await mf.dispatchFetch(origin + '/api/groups')).status, 401);
    assert.equal((await mf.dispatchFetch(origin + '/api/groups/' + createdId)).status, 401);
    assert.equal((await post({ name: 'Test' }, { Cookie: '' })).status, 401);
    assert.equal((await post({ name: 'Test' }, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await post({ name: 'Test' }, { 'X-CSRF-Token': as('other')['X-CSRF-Token'] })).status, 403);
    assert.equal((await post({ name: 'Test' }, { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await post({ name: 'Test' }, { Origin: '' })).status, 403);
    const expired = await new SessionService(new SessionsRepository(db), () => 0).issueForVerifiedAccount('owner', 1000);
    assert.equal((await post({ name: 'Test' }, { Cookie: '__Host-tocaregalo_session=' + expired.token })).status, 401);
    const method = await mf.dispatchFetch(origin + '/api/groups/' + createdId, { method: 'DELETE', headers: as('owner') });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('Allow'), 'GET');
    assert.equal((await mf.dispatchFetch(origin + '/api/groups/' + createdId + '/members/unknown/extra', { headers: as('owner') })).status, 404);
  });

  await t.test('invalid JSON, names and oversized bodies cannot create groups', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM groups').first('n');
    for (const body of [null, [], {}, { name: ' ' }, { name: 1 }, { name: 'x'.repeat(101) }]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post({ name: 'Test' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ name: 'x'.repeat(17000) })).status, 413);
    assert.equal((await mf.dispatchFetch(origin + '/api/groups', {
      method: 'POST', headers: { ...as('owner'), Origin: origin, 'Content-Type': 'application/json' }, body: '{',
    })).status, 400);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM groups').first('n'), before);
  });

  await t.test('a membership insert failure rolls back group creation without leaking storage details', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM groups').first('n');
    await db.prepare(`CREATE TRIGGER reject_api_group BEFORE INSERT ON group_members
      WHEN NEW.account_id = 'owner' BEGIN SELECT RAISE(ABORT, 'synthetic private database detail'); END`).run();
    const response = await post({ name: 'Rollback' });
    assert.equal(response.status, 500);
    assert.equal((await response.text()).includes('synthetic private'), false);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM groups').first('n'), before);
    await db.prepare('DROP TRIGGER reject_api_group').run();
    const responses = await Promise.all([post({ name: 'Same name' }), post({ name: 'Same name' })]);
    assert.deepEqual(responses.map(r => r.status), [201, 201]);
    const first = authObject(authObject(await responses[0].json()).group);
    const second = authObject(authObject(await responses[1].json()).group);
    assert.notEqual(first.id, second.id);
  });
});
