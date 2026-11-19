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

test('owner-created events and member-scoped reads run in the bundled Worker with D1', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-events-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'events-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'], bindings: { APP_ORIGIN: origin },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql']) {
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    if (name === '0001_draws.sql') {
      await db.prepare('INSERT INTO events (id,closure_at_ms,created_at_ms) VALUES (?,?,?)').bind('legacy-event', null, 0).run();
    }
  }
  const accounts = new AccountsRepository(db);
  const groups = new GroupsRepository(db);
  const sessions = new SessionService(new SessionsRepository(db));
  const credentials = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'member', 'other']) {
    await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
    const issued = await sessions.issueForVerifiedAccount(id, 86400000);
    credentials.set(id, { Cookie: '__Host-tocaregalo_session=' + issued.token, 'X-CSRF-Token': issued.csrfToken });
  }
  await groups.create('owner', { id: 'group', name: 'Gifts', createdAtMs: 0 });
  await groups.create('other', { id: 'other-group', name: 'Other', createdAtMs: 0 });
  await groups.addMember('group', 'owner', 'member', 1);
  const headers = (id: string) => { const value = credentials.get(id); assert.ok(value); return value; };
  const create = (body: unknown, actor = 'owner', group = 'group', extra: Record<string, string> = {}) => mf.dispatchFetch(origin + '/api/groups/' + group + '/events', {
    method: 'POST', headers: { ...headers(actor), Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
  });
  const read = (id: string, actor = 'owner', query = '') => mf.dispatchFetch(origin + '/api/events/' + id + query, { headers: headers(actor) });
  let eventId = '';

  await t.test('owner creation preserves nullable closure and generates ID, group and timestamp on the server', async () => {
    const before = Date.now();
    const response = await create({ closureAtMs: null, id: 'forged', groupId: 'other-group', createdAtMs: 0, actorAccountId: 'other' });
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Set-Cookie'), null);
    const event = authObject(authObject(await response.json()).event);
    assert.ok(typeof event.id === 'string'); eventId = event.id;
    assert.notEqual(eventId, 'forged');
    assert.equal(event.groupId, 'group');
    assert.equal(event.closureAtMs, null);
    assert.ok(typeof event.createdAtMs === 'number' && event.createdAtMs >= before && event.createdAtMs <= Date.now());
    assert.equal(response.headers.get('Location'), '/api/events/' + eventId);
    assert.deepEqual(await groups.findEventForAccount(eventId, 'owner'), event);
    const future = Date.now() + 60000;
    const scheduled = await create({ closureAtMs: future });
    assert.equal(scheduled.status, 201);
    assert.equal(authObject(authObject(await scheduled.json()).event).closureAtMs, future);
  });

  await t.test('only the owner creates events and missing/inaccessible groups have the same response', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM events').first('n');
    const responses = await Promise.all([
      create({ closureAtMs: null }, 'member'), create({ closureAtMs: null }, 'other'),
      create({ closureAtMs: null }, 'owner', 'missing'), create({ closureAtMs: null }, 'owner', 'other-group'),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    }
    assert.equal(await db.prepare('SELECT count(*) AS n FROM events').first('n'), before);
  });

  await t.test('detail reads enforce current membership, ignore browser identity and hide legacy events', async () => {
    assert.equal((await read(eventId, 'owner')).status, 200);
    const response = await read(eventId, 'member', '?actorAccountId=other');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(authObject(authObject(await response.json()).event).id, eventId);
    for (const id of [eventId, 'missing', 'legacy-event']) {
      const inaccessible = await read(id, 'other', '?actorAccountId=owner');
      assert.equal(inaccessible.status, 404);
      assert.deepEqual(await inaccessible.json(), { error: 'Not found' });
    }
    assert.equal((await read('legacy-event', 'owner')).status, 404);
    assert.equal(await groups.removeMember('group', 'owner', 'member'), true);
    assert.equal((await read(eventId, 'member')).status, 404);
    assert.equal((await read(eventId, 'owner')).status, 200);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM events WHERE id = ?').bind('legacy-event').first('n'), 1);
  });

  await t.test('sessions, CSRF, Origin and HTTP methods protect the event routes', async () => {
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { Cookie: '' })).status, 401);
    assert.equal((await mf.dispatchFetch(origin + '/api/events/' + eventId)).status, 401);
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { 'X-CSRF-Token': headers('other')['X-CSRF-Token'] })).status, 403);
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { Origin: '' })).status, 403);
    const expired = await new SessionService(new SessionsRepository(db), () => 0).issueForVerifiedAccount('owner', 1000);
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { Cookie: '__Host-tocaregalo_session=' + expired.token })).status, 401);
    const temporary = await sessions.issueForVerifiedAccount('owner', 86400000);
    await sessions.revoke(temporary.token);
    assert.equal((await mf.dispatchFetch(origin + '/api/events/' + eventId, { headers: { Cookie: '__Host-tocaregalo_session=' + temporary.token } })).status, 401);
    const getCollection = await mf.dispatchFetch(origin + '/api/groups/group/events', { headers: headers('owner') });
    assert.equal(getCollection.status, 405);
    assert.equal(getCollection.headers.get('Allow'), 'POST');
    const postDetail = await mf.dispatchFetch(origin + '/api/events/' + eventId, { method: 'POST', headers: headers('owner') });
    assert.equal(postDetail.status, 405);
    assert.equal(postDetail.headers.get('Allow'), 'GET');
    assert.equal((await read(eventId + '/assignments')).status, 404);
    assert.equal((await read('%E0%A4%A')).status, 400);
  });

  await t.test('invalid, missing, past and unsafe closure values are rejected without a write', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM events').first('n');
    for (const body of [null, [], {}, { closureAtMs: '1234' }, { closureAtMs: true }, { closureAtMs: 1.5 },
      { closureAtMs: 0 }, { closureAtMs: Date.now() - 1000 }, { closureAtMs: Number.MAX_SAFE_INTEGER + 1 }]) {
      assert.equal((await create(body)).status, 400);
    }
    assert.equal((await create({ closureAtMs: null }, 'owner', 'group', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await create({ closureAtMs: null, padding: 'x'.repeat(17000) })).status, 413);
    assert.equal((await mf.dispatchFetch(origin + '/api/groups/group/events', {
      method: 'POST', headers: { ...headers('owner'), Origin: origin, 'Content-Type': 'application/json' }, body: '{',
    })).status, 400);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM events').first('n'), before);
  });

  await t.test('storage failure is generic and leaves no event, while parallel creation generates distinct IDs', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM events').first('n');
    await db.prepare(`CREATE TRIGGER reject_api_event BEFORE INSERT ON events
      WHEN NEW.group_id = 'group' BEGIN SELECT RAISE(ABORT, 'synthetic private storage detail'); END`).run();
    const failed = await create({ closureAtMs: null });
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes('synthetic private'), false);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM events').first('n'), before);
    await db.prepare('DROP TRIGGER reject_api_event').run();
    const responses = await Promise.all([create({ closureAtMs: null }), create({ closureAtMs: null })]);
    assert.deepEqual(responses.map(r => r.status), [201, 201]);
    const first = authObject(authObject(await responses[0].json()).event);
    const second = authObject(authObject(await responses[1].json()).event);
    assert.notEqual(first.id, second.id);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM draws').first('n'), 0);
  });
});
