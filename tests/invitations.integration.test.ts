import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, Response as MiniflareResponse, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { InvitationsRepository } from '../src/persistence/invitations-repository.ts';
import { InvitationService, InvitationDeliveryError } from '../src/application/invitation-service.ts';
import { createInvitationToken, hashInvitationToken } from '../src/domain/invitations.ts';
import { hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { authObject } from '../src/domain/authentication.ts';
import { AuthRateLimiter } from '../src/application/auth-rate-limiter.ts';
import { AuthCountersRepository } from '../src/persistence/auth-counters-repository.ts';
import { applyMigration } from './helpers/migrations.ts';

test('group invitations run through the bundled Worker and atomic D1 acceptance', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-invitations-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const messages: { email: string; token: string }[] = [];
  let providerStatus = 202;
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'invitations-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, SESSION_TTL_SECONDS: '86400', RESEND_API_KEY: 'synthetic-key', RESEND_FROM_EMAIL: 'sender@example.test', APP_ENV: 'development', RESEND_TEST_MODE: 'false' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.resend.com/emails');
      const body = authObject(await request.json());
      assert.ok(Array.isArray(body.to));
      const email = body.to[0]; assert.ok(typeof email === 'string');
      const text = body.text; assert.ok(typeof text === 'string');
      const token = text.match(/\b[a-f0-9]{64}\b/)?.[0]; assert.ok(token);
      messages.push({ email, token });
      return new MiniflareResponse(null, { status: providerStatus });
    },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql', '0008_event_creation_order.sql']) {
    await applyMigration(db, name);
  }
  const accounts = new AccountsRepository(db);
  const groups = new GroupsRepository(db);
  const sessions = new SessionService(new SessionsRepository(db));
  const credentials = new Map<string, Record<string, string>>();
  for (const id of ['owner', 'recipient', 'outsider', 'rollback', 'quota-owner']) {
    await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
    const session = await sessions.issueForVerifiedAccount(id, 86400000);
    credentials.set(id, { Cookie: '__Host-tocaregalo_session=' + session.token, 'X-CSRF-Token': session.csrfToken });
  }
  await groups.create('owner', { id: 'group', name: 'Friends', createdAtMs: 0 });
  await groups.create('quota-owner', { id: 'quota-group', name: 'Quotas', createdAtMs: 0 });
  await groups.createEvent('owner', { id: 'existing-event', groupId: 'group', closureAtMs: null, createdAtMs: 0 });
  const before = await db.prepare('SELECT * FROM group_members ORDER BY group_id, account_id').all();
  await applyMigration(db, '0009_group_invitations.sql');
  assert.deepEqual((await db.prepare('SELECT * FROM group_members ORDER BY group_id, account_id').all()).results, before.results);
  assert.ok(await groups.findEventForAccount('existing-event', 'owner'));
  const repository = new InvitationsRepository(db);
  const headers = (id: string) => { const value = credentials.get(id); assert.ok(value); return value; };
  const post = (path: string, body: unknown, actor = 'owner', extra: Record<string, string> = {}) => mf.dispatchFetch(origin + path, {
    method: 'POST', headers: { ...headers(actor), Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
  });
  const invite = (email: string, actor = 'owner', group = 'group') => post('/api/groups/' + group + '/invitations', { email }, actor);
  const accept = (token: string, actor = 'recipient') => post('/api/invitations/accept', { token, accountId: 'owner', email: 'owner@example.test' }, actor);
  const issue = async (email: string, created = 1000, expires = 2000, group = 'group') => {
    const token = createInvitationToken();
    assert.ok(await repository.issue(group, 'owner', email, await hashInvitationToken(token), created, expires));
    return token;
  };

  await t.test('only owners invite; raw codes are sent to the requested email and never returned or stored', async () => {
    const outsider = await invite('recipient@example.test', 'outsider');
    assert.equal(outsider.status, 404);
    assert.equal((await invite('recipient@example.test', 'owner', 'missing')).status, 404);
    assert.equal(messages.length, 0);
    const response = await post('/api/groups/group/invitations', { email: ' Recipient@EXAMPLE.TEST ', groupId: 'quota-group', actorAccountId: 'outsider', recipient: 'attacker@example.test' });
    assert.equal(response.status, 202, await response.clone().text());
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const message = messages.at(-1); assert.ok(message);
    assert.equal(message.email, 'recipient@example.test');
    assert.equal((await response.text()).includes(message.token), false);
    const row = await db.prepare('SELECT * FROM group_invitations WHERE group_id = ? AND email = ?').bind('group', message.email).first();
    assert.equal(JSON.stringify(row).includes(message.token), false);
    const stored = authObject(row);
    assert.ok(typeof stored.created_at_ms === 'number' && typeof stored.expires_at_ms === 'number');
    assert.equal(stored.expires_at_ms - stored.created_at_ms, 604800000);
    assert.equal(await groups.findForAccount('group', 'recipient'), null);
  });

  await t.test('resend supersedes tokens; concurrent acceptance has one winner and does not verify email', async () => {
    const old = messages.at(-1)?.token; assert.ok(old);
    assert.equal((await invite('recipient@example.test')).status, 202);
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.equal((await accept(old)).status, 400);
    assert.equal((await accept(token, 'outsider')).status, 400);
    const responses = await Promise.all([accept(token), accept(token)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [204, 400]);
    for (const response of responses) assert.equal(response.headers.get('Set-Cookie'), null);
    assert.ok(await groups.findForAccount('group', 'recipient'));
    assert.equal((await invite('outsider@example.test', 'recipient')).status, 404);
    assert.ok(await groups.findEventForAccount('existing-event', 'recipient'));
    assert.equal((await accounts.findSelf('recipient'))?.emailVerifiedAtMs, null);
    assert.equal((await accept(token)).status, 400);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM group_members WHERE group_id = ? AND account_id = ?').bind('group', 'recipient').first('n'), 1);
    const alreadyMember = await issue('recipient@example.test', Date.now(), Date.now() + 60000);
    assert.equal((await accept(alreadyMember)).status, 204);
    assert.equal(await groups.removeMember('group', 'owner', 'recipient'), true);
    assert.equal((await accept(alreadyMember)).status, 400);
    assert.equal(await groups.findForAccount('group', 'recipient'), null);
    assert.equal((await invite('outsider@example.test', 'recipient')).status, 404);
  });

  await t.test('invitations can precede registration and acceptance binds the session email', async () => {
    assert.equal((await invite('new@example.test')).status, 202);
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.equal((await accept(token)).status, 400);
    assert.equal(await db.prepare('SELECT id FROM accounts WHERE email = ?').bind('new@example.test').first(), null);
    const registered = await post('/api/register', { email: 'new@example.test', password: 'abcdef', name: 'New' });
    assert.equal(registered.status, 201);
    const accountId = authObject(authObject(await registered.json()).account).id;
    assert.ok(typeof accountId === 'string');
    assert.equal(await groups.findForAccount('group', accountId), null);
    const login = await post('/api/login', { identifier: 'new@example.test', password: 'abcdef' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('Set-Cookie'); assert.ok(cookie);
    const csrf = authObject(await login.json()).csrfToken; assert.ok(typeof csrf === 'string');
    const accepted = await post('/api/invitations/accept', { token }, 'owner', { Cookie: cookie.split(';')[0], 'X-CSRF-Token': csrf });
    assert.equal(accepted.status, 204);
    assert.ok(await groups.findForAccount('group', accountId));
    assert.equal((await accounts.findSelf(accountId))?.emailVerifiedAtMs, null);
  });

  await t.test('expiry boundaries, changed email, owner changes and other token purposes fail closed', async () => {
    const token = await issue('outsider@example.test');
    const hash = await hashInvitationToken(token);
    assert.equal(await repository.consume(hash, 'outsider', 999), false);
    assert.equal(await repository.consume(hash, 'outsider', 2000), false);
    await db.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind('changed@example.test', 'outsider').run();
    assert.equal(await repository.consume(hash, 'outsider', 1500), false);
    await db.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind('outsider@example.test', 'outsider').run();
    await db.prepare('UPDATE groups SET owner_account_id = ? WHERE id = ?').bind('outsider', 'group').run();
    assert.equal(await repository.consume(hash, 'outsider', 1500), false);
    assert.equal(await repository.issue('group', 'owner', 'outsider@example.test', await hashInvitationToken(createInvitationToken()), 1000, 2000), null);
    await db.prepare('UPDATE groups SET owner_account_id = ? WHERE id = ?').bind('owner', 'group').run();
    assert.equal(await repository.consume(hash, 'outsider', 1999), true);
    const verification = createInvitationToken();
    await db.prepare('INSERT INTO email_verifications (account_id,email,token_hash,created_at_ms,expires_at_ms) VALUES (?,?,?,?,?)')
      .bind('rollback', 'rollback@example.test', await hashEmailVerificationToken(verification), 0, Date.now() + 60000).run();
    assert.equal((await accept(verification, 'rollback')).status, 400);
  });

  await t.test('membership failure rolls back consumption and a later failed send cannot erase a resend', async () => {
    const token = await issue('rollback@example.test');
    await db.prepare(`CREATE TRIGGER reject_invited_member BEFORE INSERT ON group_members
      WHEN NEW.account_id = 'rollback' BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END`).run();
    await assert.rejects(repository.consume(await hashInvitationToken(token), 'rollback', 1500), /synthetic rollback/);
    assert.equal(await groups.findForAccount('group', 'rollback'), null);
    await db.prepare('DROP TRIGGER reject_invited_member').run();
    assert.equal(await repository.consume(await hashInvitationToken(token), 'rollback', 1500), true);
    let replacement = '';
    const service = new InvitationService(repository, { async send() {
      replacement = await issue('late@example.test'); throw new Error('synthetic provider failure');
    } }, { async allowInvitation() { return true; } }, () => 1000);
    await assert.rejects(service.request('owner', 'group', 'late@example.test'), InvitationDeliveryError);
    assert.equal(await db.prepare('SELECT token_hash FROM group_invitations WHERE email = ?').bind('late@example.test').first('token_hash'), await hashInvitationToken(replacement));
    providerStatus = 500;
    const failed = await invite('failure@example.test');
    assert.equal(failed.status, 503);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM group_invitations WHERE email = ?').bind('failure@example.test').first('n'), 0);
    providerStatus = 202;
  });

  await t.test('HTTP checks and owner/recipient quotas are enforced', async () => {
    const path = '/api/groups/group/invitations';
    assert.equal((await post(path, { email: 'x@example.test' }, 'owner', { Cookie: '' })).status, 401);
    assert.equal((await post('/api/invitations/accept', { token: createInvitationToken() }, 'owner', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await post(path, { email: 'x@example.test' }, 'owner', { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await post(path, { email: 'invalid' })).status, 400);
    assert.equal((await post(path, { email: 'x@example.test' }, 'owner', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(path, { email: 'x@example.test', padding: 'x'.repeat(17000) })).status, 413);
    const unsupported = await mf.dispatchFetch(origin + path, { method: 'PUT' });
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get('Allow'), 'GET, POST, DELETE');
    for (let n = 0; n < 5; n++) assert.equal((await invite('limited@example.test')).status, 202);
    const limited = await invite('limited@example.test');
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '900');
    const limiter = new AuthRateLimiter(new AuthCountersRepository(db), () => 0);
    const ownerResults = await Promise.all(Array.from({ length: 35 }, (_, n) => limiter.allowInvitation('quota-owner', 'quota-group', n + '@example.test')));
    assert.equal(ownerResults.filter(Boolean).length, 30);
    const recipientResults = await Promise.all(Array.from({ length: 10 }, () => limiter.allowInvitation('other-owner', 'other-group', 'same@example.test')));
    assert.equal(recipientResults.filter(Boolean).length, 5);
  });

  await t.test('owner lists paginate safely without leaking tokens and include pending, expired and accepted states', async () => {
    await groups.create('owner', { id: 'management-group', name: 'Management', createdAtMs: 0 });
    await groups.create('owner', { id: 'empty-management', name: 'Empty', createdAtMs: 0 });
    await groups.addMember('management-group', 'owner', 'outsider', 0);
    const mailCount = messages.length;
    for (let n = 55; n >= 1; n--) {
      const email = 'list-' + String(n).padStart(2, '0') + '@example.test';
      await issue(email, 1000, n === 2 || n === 3 ? 2000 : Date.now() + 600000, 'management-group');
      if (n === 3) await db.prepare('UPDATE group_invitations SET consumption_id = ? WHERE group_id = ? AND email = ?')
        .bind('synthetic-consumed', 'management-group', email).run();
    }
    const list = (group: string, actor = 'owner', query = '') => mf.dispatchFetch(origin + '/api/groups/' + group + '/invitations' + query,
      { headers: headers(actor) });
    const empty = await list('empty-management');
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { invitations: [], nextCursor: null });
    for (const group of ['management-group', 'missing', 'empty-management']) {
      const response = await list(group, 'outsider', '?actorAccountId=owner');
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    }
    const first = await list('management-group', 'owner', '?limit=3');
    assert.equal(first.status, 200); assert.equal(first.headers.get('Cache-Control'), 'no-store');
    const page = authObject(await first.json());
    assert.ok(Array.isArray(page.invitations));
    assert.deepEqual(page.invitations.map(i => authObject(i).status), ['pending', 'expired', 'accepted']);
    for (const invitation of page.invitations) {
      assert.deepEqual(Object.keys(authObject(invitation)).sort(), ['createdAtMs', 'email', 'expiresAtMs', 'status']);
    }
    assert.equal(page.nextCursor, 'list-03@example.test');
    await db.prepare('DELETE FROM group_invitations WHERE group_id = ? AND email = ?').bind('management-group', page.nextCursor).run();
    const next = authObject(await (await list('management-group', 'owner', '?limit=2&cursor=list-03%40example.test')).json());
    assert.ok(Array.isArray(next.invitations));
    assert.deepEqual(next.invitations.map(i => authObject(i).email), ['list-04@example.test', 'list-05@example.test']);
    const maximum = authObject(await (await list('management-group', 'owner', '?limit=50')).json());
    assert.ok(Array.isArray(maximum.invitations)); assert.equal(maximum.invitations.length, 50);
    assert.equal(maximum.nextCursor, 'list-51@example.test');
    const last = authObject(await (await list('management-group', 'owner', '?limit=50&cursor=list-51%40example.test')).json());
    assert.ok(Array.isArray(last.invitations)); assert.equal(last.invitations.length, 4); assert.equal(last.nextCursor, null);
    assert.deepEqual(await (await list('management-group', 'owner', '?cursor=zzz%40example.test')).json(), { invitations: [], nextCursor: null });
    const defaults = authObject(await (await list('management-group')).json());
    assert.ok(Array.isArray(defaults.invitations)); assert.equal(defaults.invitations.length, 20);
    assert.equal(messages.length, mailCount);
    const plan = await db.prepare(`EXPLAIN QUERY PLAN SELECT i.email FROM groups g LEFT JOIN group_invitations i
      ON i.group_id = g.id AND i.email > ? WHERE g.id = ? AND g.owner_account_id = ? ORDER BY i.email LIMIT ?`)
      .bind('list-03@example.test', 'management-group', 'owner', 51).all<{ detail: string }>();
    assert.equal(plan.results.some(row => row.detail.includes('TEMP B-TREE')), false);
    await assert.rejects(repository.listForOwner('management-group', 'owner', 52, null), RangeError);
  });

  await t.test('revocation is owner-only, idempotent and leaves consumed memberships and later reissues intact', async () => {
    const revoke = (email: string, actor = 'owner', group = 'group', extra: Record<string, string> = {}) => mf.dispatchFetch(origin + '/api/groups/' + group + '/invitations', {
      method: 'DELETE', headers: { ...headers(actor), Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ email }),
    });
    const token = await issue('recipient@example.test', Date.now(), Date.now() + 600000);
    assert.equal((await revoke('recipient@example.test', 'outsider')).status, 404);
    assert.equal((await revoke('recipient@example.test', 'owner', 'missing')).status, 404);
    assert.equal((await revoke(' Recipient@EXAMPLE.TEST ')).status, 204);
    assert.equal((await accept(token)).status, 400);
    assert.equal((await revoke('recipient@example.test')).status, 204);
    const newer = await issue('recipient@example.test', Date.now(), Date.now() + 600000);
    assert.equal((await accept(newer)).status, 204);
    assert.equal((await revoke('recipient@example.test')).status, 204);
    assert.ok(await groups.findForAccount('group', 'recipient'));
    const expired = await issue('expired@example.test');
    assert.equal((await revoke('expired@example.test')).status, 204);
    assert.equal(await db.prepare('SELECT token_hash FROM group_invitations WHERE group_id = ? AND email = ?')
      .bind('group', 'expired@example.test').first('token_hash'), await hashInvitationToken(expired));
    const raceToken = await issue('rollback@example.test', Date.now(), Date.now() + 600000);
    await groups.removeMember('group', 'owner', 'rollback');
    const [accepted, revoked] = await Promise.all([accept(raceToken, 'rollback'), revoke('rollback@example.test')]);
    assert.equal(revoked.status, 204);
    assert.ok(accepted.status === 204 || accepted.status === 400);
    assert.equal(!!await groups.findForAccount('group', 'rollback'), accepted.status === 204);
    const previous = await issue('recipient@example.test', Date.now(), Date.now() + 600000);
    const concurrentToken = createInvitationToken();
    const concurrentHash = await hashInvitationToken(concurrentToken);
    const [revocation] = await Promise.all([
      revoke('recipient@example.test'),
      repository.issue('group', 'owner', 'recipient@example.test', concurrentHash, Date.now(), Date.now() + 600000),
    ]);
    assert.equal(revocation.status, 204);
    assert.equal((await accept(previous)).status, 400);
    const currentHash = await db.prepare('SELECT token_hash FROM group_invitations WHERE group_id = ? AND email = ?')
      .bind('group', 'recipient@example.test').first('token_hash');
    assert.ok(currentHash === null || currentHash === concurrentHash);
    assert.equal(await repository.consume(concurrentHash, 'recipient', Date.now()), currentHash === concurrentHash);
    // An issuance strictly after the completed revocation always remains usable.
    const later = await issue('recipient@example.test', Date.now(), Date.now() + 600000);
    assert.equal((await accept(later)).status, 204);
    const mailCount = messages.length;
    assert.equal((await revoke('none@example.test', 'owner', 'group', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await revoke('none@example.test', 'owner', 'group', { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await revoke('none@example.test', 'owner', 'group', { Cookie: '' })).status, 401);
    assert.equal((await revoke('none@example.test', 'owner', 'group', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal(messages.length, mailCount);
  });

  await t.test('administration rejects invalid pages and sessions and rolls back a failed revocation', async () => {
    const path = origin + '/api/groups/management-group/invitations';
    assert.equal((await mf.dispatchFetch(path)).status, 401);
    for (const query of ['?limit=0', '?limit=51', '?limit=01', '?limit=2&limit=3', '?cursor=', '?cursor=invalid', '?cursor=a&cursor=b']) {
      assert.equal((await mf.dispatchFetch(path + query, { headers: headers('owner') })).status, 400);
    }
    const revoked = await sessions.issueForVerifiedAccount('owner', 86400000);
    await sessions.revoke(revoked.token);
    assert.equal((await mf.dispatchFetch(path, { headers: { Cookie: '__Host-tocaregalo_session=' + revoked.token } })).status, 401);
    const token = await issue('rollback-delete@example.test', Date.now(), Date.now() + 600000);
    await db.prepare(`CREATE TRIGGER reject_invitation_delete BEFORE DELETE ON group_invitations
      WHEN OLD.email = 'rollback-delete@example.test' BEGIN SELECT RAISE(ABORT, 'synthetic revoke failure'); END`).run();
    const failed = await mf.dispatchFetch(origin + '/api/groups/group/invitations', {
      method: 'DELETE', headers: { ...headers('owner'), Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rollback-delete@example.test' }),
    });
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes('synthetic revoke failure'), false);
    assert.equal(await db.prepare('SELECT token_hash FROM group_invitations WHERE email = ?').bind('rollback-delete@example.test').first('token_hash'), await hashInvitationToken(token));
    await db.prepare('DROP TRIGGER reject_invitation_delete').run();
  });
});
