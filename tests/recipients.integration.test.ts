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
import { RecipientsRepository } from '../src/persistence/recipients-repository.ts';
import { EventLifecycleRepository } from '../src/persistence/event-lifecycle-repository.ts';
import { MembersRepository } from '../src/persistence/members-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { EventLifecycleService } from '../src/application/event-lifecycle-service.ts';
import { RecipientService } from '../src/application/recipient-service.ts';
import { loadRecipientDecryptionKey, loadRecipientKey } from '../src/infrastructure/recipient-key.ts';
import { authObject } from '../src/domain/authentication.ts';
import { applyMigration } from './helpers/migrations.ts';

test('private recipient HTTP scopes current versions, decrypts retained keys and rechecks concurrent changes in D1', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-recipients-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const script = await readFile(join(output, 'worker.js'), 'utf8');
  const origin = 'https://app.example.test';
  const active = { DRAW_KEY_ID: 'active', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) };
  const old = { DRAW_KEY_ID: 'old', DRAW_CIPHER_KEY_HEX: '03'.repeat(32), DRAW_INDEX_KEY_HEX: '04'.repeat(32) };
  const keys = { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: JSON.stringify([{ id: 'old', cipherHex: old.DRAW_CIPHER_KEY_HEX }]) };
  const databaseId = crypto.randomUUID();
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'recipients', bindings: { APP_ORIGIN: origin, ...keys } },
    { name: 'without-old-key', bindings: { APP_ORIGIN: origin, ...active } },
    { name: 'invalid-keys', bindings: { APP_ORIGIN: origin, ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: 'private-invalid-json' } },
  ].map(worker => ({ ...worker, modules: true, script, compatibilityDate: '2026-11-19',
    d1Databases: { DB: databaseId }, outboundService: async () => { assert.fail('Private reads must not send mail'); },
  })) }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB', 'recipients');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql',
    '0008_event_creation_order.sql', '0009_group_invitations.sql']) await applyMigration(db, name);
  const accounts = new AccountsRepository(db); const groups = new GroupsRepository(db);
  const draws = new DrawRepository(db); const sessions = new SessionService(new SessionsRepository(db));
  const headers = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'a', 'b', 'c', 'outsider']) {
    await accounts.create({ id, email: id + '@example.test', displayName: 'Name ' + id, createdAtMs: 0 });
    const session = await sessions.issueForVerifiedAccount(id, 86400000);
    headers.set(id, { Cookie: '__Host-tocaregalo_session=' + session.token });
  }
  await db.prepare('UPDATE accounts SET last_name = ?, phone = ? WHERE id = ?').bind('Private surname', '+34123456789', 'a').run();
  const group = async (id: string) => {
    await groups.create('owner', { id, name: id, createdAtMs: 0 });
    for (const member of ['a', 'b']) await groups.addMember(id, 'owner', member, 0);
    await groups.createEvent('owner', { id: id + '-event', groupId: id, closureAtMs: null, createdAtMs: 0 });
    return id + '-event';
  };
  const legacy = await group('legacy');
  const oldKey = await loadRecipientKey(old);
  await draws.save({ id: 'old-draw', eventId: legacy, createdAtMs: 1, assignments: [
    { giverId: 'owner', recipientId: 'a' }, { giverId: 'a', recipientId: 'b' }, { giverId: 'b', recipientId: 'owner' },
  ] }, oldKey);
  await db.prepare('INSERT INTO events (id, closure_at_ms, created_at_ms) VALUES (?, NULL, 0)').bind('unlinked').run();
  await applyMigration(db, '0010_event_draw_lifecycle.sql');
  const repository = new RecipientsRepository(db);
  const lifecycle = new EventLifecycleService(new EventLifecycleRepository(db), () => loadRecipientKey(active));
  const read = (event: string, actor = 'owner', query = '', extra: Record<string, string> = {}) => mf.dispatchFetch(
    origin + '/api/events/' + event + '/recipient' + query, { headers: { ...headers.get(actor), ...extra } });
  const body = async (event: string, actor = 'owner', query = '') => {
    const response = await read(event, actor, query); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(response.headers.get('Set-Cookie'), null);
    return authObject(await response.json());
  };

  await t.test('each participant, including the owner, sees only their own recipient with minimal fields', async () => {
    for (const [actor, recipient] of [['owner', 'a'], ['a', 'b'], ['b', 'owner']]) {
      const result = await body(legacy, actor, '?actorAccountId=b&giverId=b&drawId=forged&recipientId=outsider');
      assert.deepEqual(result, { drawId: 'old-draw', recipient: { accountId: recipient, displayName: 'Name ' + recipient } });
      assert.deepEqual(Object.keys(result).sort(), ['drawId', 'recipient']);
      assert.deepEqual(Object.keys(authObject(result.recipient)).sort(), ['accountId', 'displayName']);
    }
    for (const event of [legacy, 'missing', 'unlinked']) {
      const response = await read(event, 'outsider'); assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    }
    await groups.create('outsider', { id: 'foreign', name: 'Foreign', createdAtMs: 0 });
    await groups.createEvent('outsider', { id: 'foreign-event', groupId: 'foreign', closureAtMs: null, createdAtMs: 0 });
    assert.equal((await read('foreign-event')).status, 404);
  });

  await t.test('absent or stale draws return conflict and archived IDs cannot select an assignment', async () => {
    const event = await group('open');
    assert.equal((await read(event)).status, 409);
    const drawn = await lifecycle.execute('owner', event); assert.equal(drawn.kind, 'ok');
    const first = await body(event);
    await groups.addMember('open', 'owner', 'c', 2);
    const pending = await read(event, 'owner', '?drawId=' + first.drawId);
    assert.equal(pending.status, 409); assert.deepEqual(await pending.json(), { error: 'Recipient assignment pending' });
    assert.equal((await read(event, 'c')).status, 409);
    assert.equal((await lifecycle.execute('owner', event)).kind, 'ok');
    const current = await body(event, 'owner', '?drawId=' + first.drawId + '&giverId=a');
    assert.notEqual(current.drawId, first.drawId);
    assert.equal((await read(event, 'c')).status, 200);
    assert.ok(await draws.findRecipient(String(first.drawId), 'owner'));
  });

  await t.test('closed participants retain their assignment; new members cannot consult a closed snapshot', async () => {
    const result = await lifecycle.execute('owner', legacy, true); assert.equal(result.kind, 'ok');
    const previous = await body(legacy);
    await groups.addMember('legacy', 'owner', 'c', 2);
    assert.equal((await read(legacy, 'c')).status, 404);
    assert.equal(await groups.removeMember('legacy', 'owner', 'a'), true);
    assert.equal((await read(legacy, 'a')).status, 404);
    // The recipient may have left the group; closed assignments and their account names remain.
    assert.deepEqual(await body(legacy), previous);
    await groups.addMember('legacy', 'owner', 'a', 3);
    assert.equal((await read(legacy, 'a')).status, 200);
  });

  await t.test('retained keys decrypt old snapshots while missing and malformed keys fail generically', async () => {
    const retired = await mf.getWorker('without-old-key');
    const response = await retired.fetch(origin + '/api/events/' + legacy + '/recipient', { headers: headers.get('owner') });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Recipient unavailable' });
    assert.equal((await body(legacy)).drawId, 'old-draw');
    const activeRead = await retired.fetch(origin + '/api/events/open-event/recipient', { headers: headers.get('owner') });
    assert.equal(activeRead.status, 200);
    const invalid = await mf.getWorker('invalid-keys');
    const malformed = await invalid.fetch(origin + '/api/events/open-event/recipient', { headers: headers.get('owner') });
    assert.equal(malformed.status, 503); assert.deepEqual(await malformed.json(), { error: 'Recipient unavailable' });
    // Authorization runs before key loading, so key configuration cannot reveal another group's state.
    assert.equal((await invalid.fetch(origin + '/api/events/' + legacy + '/recipient', { headers: headers.get('outsider') })).status, 404);
  });

  await t.test('removal, invalidation or a new draw during decryption never returns an obsolete recipient', async () => {
    for (const change of ['remove', 'invalidate', 'redraw']) {
      const event = await group('race-' + change);
      assert.equal((await lifecycle.execute('owner', event)).kind, 'ok');
      const service = new RecipientService(repository, async id => {
        if (change === 'remove') await new MembersRepository(db).removeForOwner('race-' + change, 'owner', 'a', Date.now());
        else {
          await groups.addMember('race-' + change, 'owner', 'c', 3);
          if (change === 'redraw') assert.equal((await lifecycle.execute('owner', event)).kind, 'ok');
        }
        return loadRecipientDecryptionKey(keys, id);
      });
      assert.deepEqual(await service.find('a', event), { kind: change === 'remove' ? 'not-found' : 'pending' });
    }
  });

  await t.test('authenticated scope and ciphertext tampering fails closed without returning cryptographic details', async () => {
    const event = await group('tamper'); assert.equal((await lifecycle.execute('owner', event)).kind, 'ok');
    const selected = await repository.select(event, 'owner'); assert.equal(selected.kind, 'ready');
    if (selected.kind !== 'ready') assert.fail();
    const corrupted = new Uint8Array(selected.envelope.ciphertext.slice(0)); corrupted[0] ^= 1;
    await db.prepare('UPDATE assignments SET ciphertext = ? WHERE draw_id = ? AND giver_id = ?')
      .bind(corrupted, selected.drawId, 'owner').run();
    const response = await read(event); assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Internal server error' });
    // Transplant a valid different giver's envelope: AES-GCM authentication still rejects it.
    await db.prepare(`UPDATE assignments SET iv = (SELECT iv FROM assignments WHERE draw_id = ? AND giver_id = 'a'),
      ciphertext = (SELECT ciphertext FROM assignments WHERE draw_id = ? AND giver_id = 'a')
      WHERE draw_id = ? AND giver_id = 'owner'`).bind(selected.drawId, selected.drawId, selected.drawId).run();
    assert.equal((await read(event)).status, 500);
    assert.equal((await read(event, 'a')).status, 200);
  });

  await t.test('rejoining during decryption does not grant participation in a different closed snapshot', async () => {
    const event = await group('race-rejoin'); assert.equal((await lifecycle.execute('owner', event)).kind, 'ok');
    const service = new RecipientService(repository, async id => {
      await new MembersRepository(db).removeForOwner('race-rejoin', 'owner', 'a', Date.now());
      await groups.addMember('race-rejoin', 'owner', 'c', 3);
      assert.equal((await lifecycle.execute('owner', event, true)).kind, 'ok');
      await groups.addMember('race-rejoin', 'owner', 'a', 4);
      return loadRecipientDecryptionKey(keys, id);
    });
    assert.deepEqual(await service.find('a', event), { kind: 'not-found' });
    assert.equal((await read(event, 'a')).status, 404);
    assert.equal((await read(event, 'c')).status, 200);
  });

  await t.test('session, malformed IDs, method and cache boundaries are enforced without mutating draw state', async () => {
    const before = await db.prepare('SELECT count(*) AS n FROM draws').first<{ n: number }>();
    assert.equal((await read(legacy, 'owner', '', { Cookie: '' })).status, 401);
    assert.equal((await read(legacy, 'owner', '', { Cookie: '__Host-tocaregalo_session=invalid' })).status, 401);
    const expired = await new SessionService(new SessionsRepository(db), () => 0).issueForVerifiedAccount('owner', 1000);
    assert.equal((await read(legacy, 'owner', '', { Cookie: '__Host-tocaregalo_session=' + expired.token })).status, 401);
    assert.equal((await read('%E0%A4%A')).status, 400); assert.equal((await read('%20')).status, 400);
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      const response = await mf.dispatchFetch(origin + '/api/events/' + legacy + '/recipient', { method });
      assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'GET');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    const revoked = await sessions.issueForVerifiedAccount('owner', 60000); await sessions.revoke(revoked.token);
    assert.equal((await read(legacy, 'owner', '', { Cookie: '__Host-tocaregalo_session=' + revoked.token })).status, 401);
    const counts = await db.prepare('SELECT count(*) AS n FROM draws').first<{ n: number }>();
    assert.deepEqual(counts, before);
    assert.equal((await read(legacy)).headers.get('Access-Control-Allow-Origin'), null);
  });
});
