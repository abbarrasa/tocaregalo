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
    bindings: { APP_ORIGIN: origin, SESSION_TTL_SECONDS: '86400', SENDGRID_API_KEY: 'synthetic-key', SENDGRID_FROM_EMAIL: 'sender@example.test' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
      const body = authObject(await request.json());
      assert.ok(Array.isArray(body.personalizations));
      const to = authObject(body.personalizations[0]).to; assert.ok(Array.isArray(to));
      const email = authObject(to[0]).email; assert.ok(typeof email === 'string');
      assert.ok(Array.isArray(body.content));
      const text = authObject(body.content[0]).value; assert.ok(typeof text === 'string');
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
    assert.equal((await mf.dispatchFetch(origin + path)).status, 405);
    for (let n = 0; n < 5; n++) assert.equal((await invite('limited@example.test')).status, 202);
    const limited = await invite('limited@example.test');
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '900');
    const limiter = new AuthRateLimiter(new AuthCountersRepository(db), () => 0);
    const ownerResults = await Promise.all(Array.from({ length: 35 }, (_, n) => limiter.allowInvitation('quota-owner', 'quota-group', n + '@example.test')));
    assert.equal(ownerResults.filter(Boolean).length, 30);
    const recipientResults = await Promise.all(Array.from({ length: 10 }, () => limiter.allowInvitation('other-owner', 'other-group', 'same@example.test')));
    assert.equal(recipientResults.filter(Boolean).length, 5);
  });
});
