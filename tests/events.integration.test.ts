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
import { eventCursor } from '../src/domain/events.ts';
import { applyMigration } from './helpers/migrations.ts';

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
    await applyMigration(db, name);
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
    const deleteCollection = await mf.dispatchFetch(origin + '/api/groups/group/events', { method: 'DELETE', headers: headers('owner') });
    assert.equal(deleteCollection.status, 405);
    assert.equal(deleteCollection.headers.get('Allow'), 'GET, POST');
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

  await t.test('listing index upgrades existing events and avoids a temporary cursor sort', async () => {
    await groups.create('owner', { id: 'listing-group', name: 'Listing', createdAtMs: 0 });
    await groups.create('owner', { id: 'empty-group', name: 'Empty', createdAtMs: 0 });
    await groups.addMember('listing-group', 'owner', 'member', 1);
    for (let n = 55; n >= 1; n--) {
      await groups.createEvent('owner', { id: 'list-' + String(n).padStart(2, '0'), groupId: 'listing-group',
        closureAtMs: n % 2 === 0 ? null : 1000, createdAtMs: n === 2 ? 999 : 1000 - n });
    }
    const before = await db.prepare('SELECT * FROM events ORDER BY id').all();
    await applyMigration(db, '0007_event_listing_index.sql');
    await applyMigration(db, '0008_event_creation_order.sql');
    assert.deepEqual((await db.prepare('SELECT * FROM events ORDER BY id').all()).results, before.results);
    const plan = await db.prepare(`EXPLAIN QUERY PLAN SELECT e.id, e.group_id, e.closure_at_ms, e.created_at_ms
      FROM group_members m LEFT JOIN events e ON e.group_id = m.group_id AND (e.created_at_ms, e.id) < (?, ?)
      WHERE m.group_id = ? AND m.account_id = ? ORDER BY e.created_at_ms DESC, e.id DESC LIMIT ?`)
      .bind(999, 'list-01', 'listing-group', 'member', 51).all<{ detail: string }>();
    assert.ok(plan.results.some(row => row.detail.includes('events_by_group_creation')));
    assert.equal(plan.results.some(row => row.detail.includes('TEMP B-TREE')), false);
  });

  await t.test('creation timestamps remain immutable, including legacy events and transactional updates', async () => {
    for (const id of ['legacy-event', eventId, 'list-02']) {
      const before = await db.prepare('SELECT created_at_ms FROM events WHERE id = ?').bind(id).first('created_at_ms');
      assert.ok(typeof before === 'number');
      await assert.rejects(db.prepare('UPDATE events SET created_at_ms = ? WHERE id = ?').bind(before + 1, id).run(), /immutable/);
      assert.equal(await db.prepare('SELECT created_at_ms FROM events WHERE id = ?').bind(id).first('created_at_ms'), before);
      await db.prepare('UPDATE events SET created_at_ms = created_at_ms WHERE id = ?').bind(id).run();
    }
    const original = await db.prepare('SELECT closure_at_ms FROM events WHERE id = ?').bind(eventId).first('closure_at_ms');
    await assert.rejects(db.batch([
      db.prepare('UPDATE events SET closure_at_ms = ? WHERE id = ?').bind(12345, eventId),
      db.prepare('UPDATE events SET created_at_ms = created_at_ms + 1 WHERE id = ?').bind(eventId),
    ]), /immutable/);
    assert.equal(await db.prepare('SELECT closure_at_ms FROM events WHERE id = ?').bind(eventId).first('closure_at_ms'), original);
    // Other fields remain independently mutable internally; there is no public update endpoint.
    await db.prepare('UPDATE events SET closure_at_ms = ? WHERE id = ?').bind(12345, eventId).run();
    await db.prepare('UPDATE events SET closure_at_ms = ? WHERE id = ?').bind(original, eventId).run();
  });

  await t.test('member event lists distinguish authorized empty pages from inaccessible groups', async () => {
    const list = (group: string, actor = 'owner', query = '') => mf.dispatchFetch(origin + '/api/groups/' + group + '/events' + query,
      { headers: headers(actor) });
    const empty = await list('empty-group');
    assert.equal(empty.status, 200);
    assert.equal(empty.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await empty.json(), { events: [], nextCursor: null });
    for (const group of ['listing-group', 'missing', 'empty-group']) {
      const inaccessible = await list(group, 'other', '?actorAccountId=owner');
      assert.equal(inaccessible.status, 404);
      assert.deepEqual(await inaccessible.json(), { error: 'Not found' });
    }
    const first = await list('listing-group', 'member', '?limit=2');
    assert.equal(first.status, 200);
    const page = authObject(await first.json());
    assert.ok(Array.isArray(page.events));
    assert.deepEqual(page.events.map(e => authObject(e).id), ['list-02', 'list-01']);
    assert.deepEqual(page.events.map(e => authObject(e).createdAtMs), [999, 999]);
    assert.deepEqual(page.events.map(e => authObject(e).closureAtMs), [null, 1000]);
    const cursorQuery = (createdAtMs: number, id: string) => encodeURIComponent(eventCursor({ createdAtMs, id }));
    assert.equal(page.nextCursor, eventCursor({ createdAtMs: 999, id: 'list-01' }));
    const tied = authObject(await (await list('listing-group', 'member', '?limit=1')).json());
    assert.equal(tied.nextCursor, eventCursor({ createdAtMs: 999, id: 'list-02' }));
    const tiedNext = authObject(await (await list('listing-group', 'member', '?limit=1&cursor=' + cursorQuery(999, 'list-02'))).json());
    assert.ok(Array.isArray(tiedNext.events));
    assert.deepEqual(tiedNext.events.map(e => authObject(e).id), ['list-01']);
    // The cursor is a position, not a required existing row or a permission token.
    await db.prepare('DELETE FROM events WHERE id = ?').bind('list-01').run();
    const next = authObject(await (await list('listing-group', 'member', '?limit=2&cursor=' + cursorQuery(999, 'list-01'))).json());
    assert.ok(Array.isArray(next.events));
    assert.deepEqual(next.events.map(e => authObject(e).id), ['list-03', 'list-04']);
    const defaults = authObject(await (await list('listing-group', 'member')).json());
    assert.ok(Array.isArray(defaults.events));
    assert.equal(defaults.events.length, 20);
    const maximum = authObject(await (await list('listing-group', 'member', '?limit=50')).json());
    assert.ok(Array.isArray(maximum.events));
    assert.equal(maximum.events.length, 50);
    assert.equal(maximum.nextCursor, eventCursor({ createdAtMs: 949, id: 'list-51' }));
    const last = authObject(await (await list('listing-group', 'member', '?limit=50&cursor=' + cursorQuery(949, 'list-51'))).json());
    assert.ok(Array.isArray(last.events));
    assert.deepEqual(last.events.map(e => authObject(e).id), ['list-52', 'list-53', 'list-54', 'list-55']);
    assert.equal(last.nextCursor, null);
    assert.deepEqual(await (await list('listing-group', 'member', '?cursor=' + cursorQuery(-1, 'end'))).json(), { events: [], nextCursor: null });
    const foreign = authObject(await (await list('group', 'owner', '?cursor=' + cursorQuery(999, 'list-01'))).json());
    assert.ok(Array.isArray(foreign.events));
    assert.equal(foreign.events.some(e => authObject(e).groupId !== 'group'), false);
    assert.equal(await groups.removeMember('listing-group', 'owner', 'member'), true);
    assert.equal((await list('listing-group', 'member', '?cursor=' + cursorQuery(999, 'list-02'))).status, 404);
    assert.deepEqual(await groups.listEventsForAccount('empty-group', 'owner', 51, null), []);
    assert.equal(await groups.listEventsForAccount('empty-group', 'other', 51, null), null);
    await assert.rejects(groups.listEventsForAccount('listing-group', 'owner', 52, null), RangeError);
  });

  await t.test('event list sessions and pagination inputs are enforced without exposing legacy events', async () => {
    const path = origin + '/api/groups/listing-group/events';
    assert.equal((await mf.dispatchFetch(path)).status, 401);
    const issued = await sessions.issueForVerifiedAccount('owner', 86400000);
    await sessions.revoke(issued.token);
    assert.equal((await mf.dispatchFetch(path, { headers: { Cookie: '__Host-tocaregalo_session=' + issued.token } })).status, 401);
    const expired = await new SessionService(new SessionsRepository(db), () => 0).issueForVerifiedAccount('owner', 1000);
    assert.equal((await mf.dispatchFetch(path, { headers: { Cookie: '__Host-tocaregalo_session=' + expired.token } })).status, 401);
    for (const query of ['?limit=0', '?limit=51', '?limit=1.5', '?limit=01', '?limit=2&limit=3',
      '?cursor=', '?cursor=a&cursor=b', '?cursor=list-01', '?cursor=' + 'x'.repeat(513)]) {
      assert.equal((await mf.dispatchFetch(path + query, { headers: headers('owner') })).status, 400);
    }
    const all = authObject(await (await mf.dispatchFetch(path + '?limit=50', { headers: headers('owner') })).json());
    assert.ok(Array.isArray(all.events));
    assert.equal(all.events.some(e => authObject(e).id === 'legacy-event'), false);
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
