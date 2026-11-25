import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { EventLifecycleRepository } from '../src/persistence/event-lifecycle-repository.ts';
import { EventLifecycleService, type EventLifecycleStore } from '../src/application/event-lifecycle-service.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { InvitationsRepository } from '../src/persistence/invitations-repository.ts';
import { createInvitationToken, hashInvitationToken } from '../src/domain/invitations.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import { authObject } from '../src/domain/authentication.ts';
import { applyMigration } from './helpers/migrations.ts';

test('event lifecycle versions complete draws atomically in the Worker and D1', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-lifecycle-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'lifecycle-test', modules: true,
    script: await readFile(join(output, 'worker.js'), 'utf8'), compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, DRAW_KEY_ID: 'synthetic', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) },
    outboundService: async () => { assert.fail('No mail expected'); },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql',
    '0008_event_creation_order.sql', '0009_group_invitations.sql']) await applyMigration(db, name);
  const accounts = new AccountsRepository(db); const groups = new GroupsRepository(db);
  const draws = new DrawRepository(db); const sessions = new SessionService(new SessionsRepository(db));
  const headers = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'a', 'b', 'c', 'outsider']) {
    await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
    const session = await sessions.issueForVerifiedAccount(id, 86400000);
    headers.set(id, { Cookie: '__Host-tocaregalo_session=' + session.token, 'X-CSRF-Token': session.csrfToken, Origin: origin });
  }
  await groups.create('owner', { id: 'group', name: 'Gifts', createdAtMs: 0 });
  await groups.addMember('group', 'owner', 'a', 0); await groups.addMember('group', 'owner', 'b', 0);
  const createEvent = (id: string, closureAtMs: number | null = null) => groups.createEvent('owner', {
    id, groupId: 'group', closureAtMs, createdAtMs: 0,
  });
  await createEvent('legacy');
  await db.prepare('INSERT INTO events (id, closure_at_ms, created_at_ms) VALUES (?, NULL, 0)').bind('unlinked').run();
  const legacyKey = { id: 'legacy-key',
    cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
  const legacyAssignments = [{ giverId: 'owner', recipientId: 'a' }, { giverId: 'a', recipientId: 'b' }, { giverId: 'b', recipientId: 'owner' }];
  await draws.save({ id: 'legacy-draw', eventId: 'legacy', createdAtMs: 10, assignments: legacyAssignments }, legacyKey);
  await createEvent('mismatched');
  await draws.save({ id: 'mismatched-draw', eventId: 'mismatched', createdAtMs: 11, assignments: [
    { giverId: 'owner', recipientId: 'a' }, { giverId: 'a', recipientId: 'absent' }, { giverId: 'absent', recipientId: 'owner' },
  ] }, legacyKey);
  const before = await draws.findRecipient('legacy-draw', 'owner'); assert.ok(before);
  await applyMigration(db, '0010_event_draw_lifecycle.sql');
  const repository = new EventLifecycleRepository(db);
  const state = async (id: string, actor = 'owner') => {
    const response = await mf.dispatchFetch(origin + '/api/events/' + id + '/draw', { headers: headers.get(actor) });
    assert.equal(response.status, 200); return authObject(authObject(await response.json()).event);
  };
  const post = (id: string, action = 'draw', actor = 'owner', extra: Record<string, string> = {}) =>
    mf.dispatchFetch(origin + '/api/events/' + id + '/' + action, { method: 'POST', headers: { ...headers.get(actor), ...extra } });
  const remove = (id: string) => mf.dispatchFetch(origin + '/api/groups/group/members/' + id, { method: 'DELETE', headers: headers.get('owner') });
  const count = async (event: string) => (await db.prepare('SELECT count(*) AS n FROM draws WHERE event_id = ?').bind(event).first<{ n: number }>())?.n;

  await t.test('upgrade preserves authenticated ciphertext, dates and foreign keys and adopts exact legacy snapshots', async () => {
    assert.deepEqual(await draws.findRecipient('legacy-draw', 'owner'), before);
    assert.equal(await decryptRecipient(new Map([[legacyKey.id, legacyKey]]), { drawId: 'legacy-draw', giverId: 'owner' }, before), 'a');
    assert.equal((await state('legacy')).drawId, 'legacy-draw');
    assert.equal((await state('mismatched')).drawId, null);
    assert.equal(await count('mismatched'), 1);
    assert.equal((await groups.findEventForAccount('legacy', 'owner'))?.createdAtMs, 0);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
    await assert.rejects(db.prepare('UPDATE events SET created_at_ms = 1 WHERE id = ?').bind('legacy').run());
    await assert.rejects(draws.save({ id: 'replace', eventId: 'legacy', createdAtMs: 20, assignments: legacyAssignments }, legacyKey));
  });

  await t.test('manual draw is idempotent for unchanged membership and manual closing can precede the schedule', async () => {
    await createEvent('scheduled', Date.now() + 86400000);
    const [one, two] = await Promise.all([post('scheduled'), post('scheduled')]);
    assert.equal(one.status, 200); assert.equal(two.status, 200);
    const first = authObject(authObject(await one.json()).event);
    const second = authObject(authObject(await two.json()).event);
    assert.equal(first.drawId, second.drawId); assert.equal(await count('scheduled'), 1);
    assert.equal((await post('scheduled', 'close')).status, 200);
    const closed = await state('scheduled'); assert.equal(closed.status, 'closed'); assert.equal(closed.drawId, first.drawId);
    assert.equal((await post('scheduled', 'close')).status, 409); assert.equal((await post('scheduled')).status, 409);
    await assert.rejects(db.prepare('UPDATE events SET closed_at_ms = NULL WHERE id = ?').bind('scheduled').run());
  });

  await t.test('invitation acceptance invalidates only open events and several joins need only one explicit draw', async () => {
    const invitation = new InvitationsRepository(db); const token = createInvitationToken();
    await invitation.issue('group', 'owner', 'c@example.test', await hashInvitationToken(token), Date.now(), Date.now() + 100000);
    assert.equal(await invitation.consume(await hashInvitationToken(token), 'c', Date.now()), true);
    assert.equal((await state('legacy')).status, 'pending'); assert.equal((await state('legacy')).drawId, null);
    assert.equal(await count('legacy'), 1); assert.equal((await state('scheduled')).status, 'closed');
    await groups.addMember('group', 'owner', 'outsider', 1);
    assert.equal((await post('legacy')).status, 200); assert.equal(await count('legacy'), 2);
    const current = await state('legacy'); assert.equal(current.status, 'ready');
    const participants = await db.prepare('SELECT member_id FROM draw_participants WHERE draw_id = ? ORDER BY member_id')
      .bind(current.drawId).all<{ member_id: string }>();
    assert.deepEqual(participants.results.map(row => row.member_id), ['a', 'b', 'c', 'outsider', 'owner']);
    assert.deepEqual(await draws.findRecipient('legacy-draw', 'owner'), before);
  });

  await t.test('removal redraws open events, preserves closed snapshots and leaves undersized events pending', async () => {
    const closed = await state('scheduled'); const old = await state('legacy');
    assert.equal((await remove('outsider')).status, 204); assert.notEqual((await state('legacy')).drawId, old.drawId);
    assert.deepEqual(await state('scheduled'), closed);
    assert.equal((await remove('c')).status, 204); assert.equal((await state('legacy')).status, 'ready');
    assert.equal((await remove('b')).status, 204);
    assert.equal((await state('legacy')).status, 'pending'); assert.equal((await state('legacy')).drawId, null);
    assert.equal((await post('legacy')).status, 409); assert.equal((await post('legacy', 'close')).status, 409);
    assert.equal((await state('legacy')).closedAtMs, null);
    await groups.addMember('group', 'owner', 'b', 2);
    assert.equal((await state('legacy')).status, 'pending');
    assert.equal((await post('legacy', 'close')).status, 200); assert.equal((await state('legacy')).status, 'closed');
  });

  await t.test('membership changes between encryption and publication cannot publish an obsolete snapshot', async () => {
    await createEvent('race'); let once = true;
    const racing: EventLifecycleStore = {
      snapshot: (...args) => repository.snapshot(...args), close: (...args) => repository.close(...args),
      pendingRedraws: (...args) => repository.pendingRedraws(...args),
      async publish(...args) {
        if (once) { once = false; await groups.addMember('group', 'owner', 'c', 3); }
        return repository.publish(...args);
      },
    };
    const service = new EventLifecycleService(racing, async () => legacyKey);
    assert.equal((await service.execute('owner', 'race', true)).kind, 'ok');
    assert.equal(await count('race'), 1);
    const current = await state('race');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM draw_participants WHERE draw_id = ?').bind(current.drawId).first<{ n: number }>())?.n, 4);
  });

  await t.test('failed publication rolls back every row and a failed post-removal redraw can resume safely', async () => {
    await createEvent('rollback');
    await db.prepare(`CREATE TRIGGER fail_lifecycle_assignment BEFORE INSERT ON assignments
      WHEN NEW.giver_id = 'a' BEGIN SELECT RAISE(ABORT, 'private injected failure'); END`).run();
    const response = await post('rollback', 'close'); assert.equal(response.status, 500);
    assert.equal((await response.text()).includes('injected'), false); assert.equal(await count('rollback'), 0);
    assert.equal((await state('rollback')).status, 'pending');
    const failedRemoval = await remove('c'); assert.equal(failedRemoval.status, 503);
    assert.equal(await groups.findForAccount('group', 'c'), null);
    assert.equal((await state('rollback')).drawId, null);
    await db.prepare('DROP TRIGGER fail_lifecycle_assignment').run();
    assert.equal((await remove('c')).status, 204); assert.equal((await state('rollback')).status, 'ready');
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  });

  await t.test('HTTP enforces owner mutations, membership reads, sessions, Origin, CSRF and method boundaries', async () => {
    for (const id of ['rollback', 'missing', 'unlinked']) {
      assert.equal((await post(id, 'draw', 'outsider')).status, 404);
    }
    assert.equal((await post('rollback', 'draw', 'a')).status, 404);
    assert.equal((await post('rollback', 'close', 'owner', { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await post('rollback', 'draw', 'owner', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await post('rollback', 'draw', 'owner', { Cookie: '' })).status, 401);
    assert.equal((await post('%E0%A4%A')).status, 400); assert.equal((await post('%20')).status, 400);
    const member = await state('rollback', 'a'); assert.deepEqual(Object.keys(member).sort(), ['closedAtMs', 'drawId', 'eventId', 'status']);
    assert.equal((await mf.dispatchFetch(origin + '/api/events/rollback/draw', { method: 'DELETE' })).status, 405);
    assert.equal((await mf.dispatchFetch(origin + '/api/events/rollback/close', { headers: headers.get('owner') })).status, 405);
    assert.equal((await post('rollback')).headers.get('Cache-Control'), 'no-store');
  });

  await t.test('concurrent closes commit one complete immutable snapshot and event deletion still cascades', async () => {
    await createEvent('close-race');
    const responses = await Promise.all([post('close-race', 'close'), post('close-race', 'close')]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal(await count('close-race'), 1);
    const closed = await state('close-race'); assert.equal(closed.status, 'closed');
    await db.prepare('DELETE FROM events WHERE id = ?').bind('close-race').run();
    assert.equal(await count('close-race'), 0);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM assignments WHERE draw_id = ?').bind(closed.drawId).first<{ n: number }>())?.n, 0);
  });

  await t.test('closing an existing draw rechecks membership before freezing its snapshot', async () => {
    await createEvent('ready-close-race'); assert.equal((await post('ready-close-race')).status, 200);
    let once = true;
    const racing: EventLifecycleStore = {
      snapshot: (...args) => repository.snapshot(...args), publish: (...args) => repository.publish(...args),
      pendingRedraws: (...args) => repository.pendingRedraws(...args),
      async close(...args) {
        if (once) { once = false; await groups.addMember('group', 'owner', 'outsider', 4); }
        return repository.close(...args);
      },
    };
    const result = await new EventLifecycleService(racing, async () => legacyKey).execute('owner', 'ready-close-race', true);
    assert.equal(result.kind, 'ok'); assert.equal(await count('ready-close-race'), 2);
    assert.equal((await state('ready-close-race')).status, 'closed');
    if (result.kind !== 'ok') assert.fail();
    assert.equal((await db.prepare('SELECT count(*) AS n FROM draw_participants WHERE draw_id = ?')
      .bind(result.state.drawId).first<{ n: number }>())?.n, 4);
    assert.equal((await remove('outsider')).status, 204);
  });

  await t.test('large redraw sets resume in bounded batches without rerolling completed events', async () => {
    for (let n = 0; n < 22; n++) await createEvent('batch-' + String(n).padStart(2, '0'));
    await groups.addMember('group', 'owner', 'c', 4);
    // More than twenty open events need redraws; the removal remains effective on a partial batch.
    assert.equal((await remove('c')).status, 503);
    assert.equal(await groups.findForAccount('group', 'c'), null);
    const completed = await state('batch-00'); assert.equal(completed.status, 'ready');
    assert.equal((await remove('c')).status, 204);
    assert.deepEqual(await state('batch-00'), completed);
    for (let n = 0; n < 22; n++) assert.equal((await state('batch-' + String(n).padStart(2, '0'))).status, 'ready');
  });
});
