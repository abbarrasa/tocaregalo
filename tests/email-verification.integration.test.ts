import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, Response as MiniflareResponse, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { EmailVerificationsRepository } from '../src/persistence/email-verifications-repository.ts';
import { EmailVerificationService, VerificationDeliveryError } from '../src/application/email-verification-service.ts';
import { createEmailVerificationToken, hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { authObject } from '../src/domain/authentication.ts';

test('email verification uses the bundled Worker, atomic D1 consumption and simulated Resend only', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-email-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const messages: { email: string; token: string }[] = [];
  let providerStatus = 202;
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'verification-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, SESSION_TTL_SECONDS: '86400', EMAIL_VERIFICATION_TTL_SECONDS: '86400',
      RESEND_API_KEY: 'synthetic-test-key', RESEND_FROM_EMAIL: 'sender@example.test', APP_ENV: 'development', RESEND_TEST_MODE: 'false' },
    outboundService: async request => {
      // Never forward requests to the network: capture only the expected Resend operation.
      assert.equal(request.url, 'https://api.resend.com/emails');
      assert.equal(request.headers.get('Authorization'), 'Bearer synthetic-test-key');
      const body = authObject(await request.json());
      assert.ok(Array.isArray(body.to));
      const email = body.to[0];
      assert.ok(typeof email === 'string');
      const text = body.text;
      assert.ok(typeof text === 'string');
      const token = text.match(/\b[a-f0-9]{64}\b/)?.[0];
      assert.ok(token);
      messages.push({ email, token });
      return new MiniflareResponse(null, { status: providerStatus });
    },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql', '0005_email_verification.sql']) {
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    // Plain DDL migrations only, with no embedded semicolons.
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    if (name === '0004_public_auth.sql') {
      await db.prepare('INSERT INTO accounts (id, email, display_name, created_at_ms) VALUES (?, ?, ?, ?)')
        .bind('legacy', 'legacy@example.test', 'Legacy', 0).run();
    }
  }
  const accounts = new AccountsRepository(db);
  const sessions = new SessionService(new SessionsRepository(db));
  const repository = new EmailVerificationsRepository(db);
  assert.equal((await accounts.findSelf('legacy'))?.emailVerifiedAtMs, null);
  for (const id of ['alice', 'bob', 'failure', 'limited', 'expiry', 'changed', 'rollback', 'send-race']) {
    await accounts.create({ id, email: `${id}@example.test`, displayName: id, createdAtMs: 0 });
  }
  const credentials = new Map<string, { Cookie: string; 'X-CSRF-Token': string }>();
  for (const id of ['alice', 'bob', 'failure', 'limited']) {
    const issued = await sessions.issueForVerifiedAccount(id, 86_400_000);
    credentials.set(id, { Cookie: '__Host-tocaregalo_session=' + issued.token, 'X-CSRF-Token': issued.csrfToken });
  }
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => mf.dispatchFetch(origin + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const requestCode = (id: string, body: unknown = {}) => {
    const headers = credentials.get(id); assert.ok(headers);
    return post('/api/email-verification/request', body, headers);
  };
  const confirm = (token: string) => post('/api/email-verification/confirm', { token });

  await t.test('session, CSRF and origin checks prevent unauthenticated requests and recipient overrides', async () => {
    assert.equal((await post('/api/email-verification/request', {})).status, 401);
    const headers = credentials.get('alice'); assert.ok(headers);
    assert.equal((await post('/api/email-verification/request', {}, { Cookie: headers.Cookie })).status, 403);
    assert.equal((await post('/api/email-verification/request', {}, { ...headers, Origin: 'https://evil.example.test' })).status, 403);
    assert.equal(messages.length, 0);
    const response = await requestCode('alice', { email: 'attacker@example.test', accountId: 'bob' });
    assert.equal(response.status, 202, await response.clone().text());
    assert.equal(messages.at(-1)?.email, 'alice@example.test');
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.equal((await response.text()).includes(token), false);
    const row = await db.prepare('SELECT * FROM email_verifications WHERE account_id = ?').bind('alice').first();
    assert.equal(JSON.stringify(row).includes(token), false);
    assert.equal((await accounts.findSelf('alice'))?.emailVerifiedAtMs, null);
  });

  await t.test('resend invalidates the previous code and confirmation is one-use without creating a session', async () => {
    const old = messages.at(-1)?.token; assert.ok(old);
    assert.equal((await requestCode('alice')).status, 202);
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.notEqual(token, old);
    assert.equal((await confirm(old)).status, 400);
    const count = await db.prepare('SELECT count(*) AS n FROM sessions').first('n');
    const response = await confirm(token);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM sessions').first('n'), count);
    assert.equal(typeof (await accounts.findSelf('alice'))?.emailVerifiedAtMs, 'number');
    assert.equal((await accounts.findSelf('bob'))?.emailVerifiedAtMs, null);
    assert.equal((await confirm(token)).status, 400);
    const sent = messages.length;
    assert.equal((await requestCode('alice')).status, 204);
    assert.equal(messages.length, sent);
    const headers = credentials.get('alice'); assert.ok(headers);
    const me = await mf.dispatchFetch(origin + '/api/me', { headers });
    const account = authObject(authObject(await me.json()).account);
    assert.ok(typeof account.emailVerifiedAtMs === 'number');
  });

  await t.test('parallel confirmation has exactly one winner and invalid origins cannot consume tokens', async () => {
    assert.equal((await requestCode('bob')).status, 202);
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.equal((await post('/api/email-verification/confirm', { token }, { Origin: 'https://evil.example.test' })).status, 403);
    const responses = await Promise.all([confirm(token), confirm(token)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [204, 400]);
    assert.ok(typeof (await accounts.findSelf('bob'))?.emailVerifiedAtMs === 'number');
    assert.equal((await confirm('0'.repeat(64))).status, 400);
    assert.equal((await confirm('invalid')).status, 400);
    assert.equal((await mf.dispatchFetch(origin + '/api/email-verification/confirm')).status, 405);
  });

  await t.test('provider failures return 503 and revoke only the failed challenge', async () => {
    providerStatus = 500;
    const failed = await requestCode('failure');
    assert.equal(failed.status, 503);
    const token = messages.at(-1)?.token; assert.ok(token);
    assert.equal(await db.prepare('SELECT token_hash FROM email_verifications WHERE account_id = ?').bind('failure').first(), null);
    assert.equal((await confirm(token)).status, 400);
    assert.equal((await accounts.findSelf('failure'))?.emailVerifiedAtMs, null);
    providerStatus = 202;
    assert.equal((await requestCode('failure')).status, 202);
  });

  await t.test('requests are limited per account even across valid authenticated calls', async () => {
    const sent = messages.length;
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await requestCode('limited')).status, 202);
    assert.equal(messages.length, sent + 5);
    const blocked = await requestCode('limited');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('Retry-After'), '900');
    assert.equal(messages.length, sent + 5);
  });

  await t.test('exact expiry boundaries and changed email snapshots cannot verify stale contacts', async () => {
    const token = createEmailVerificationToken(); const hash = await hashEmailVerificationToken(token);
    await repository.issue('expiry', hash, 1000, 2000);
    assert.equal(await repository.consume(hash, 999), false);
    assert.equal(await repository.consume(hash, 2000), false);
    assert.equal(await repository.consume(hash, 1999), true);
    const changed = await hashEmailVerificationToken(createEmailVerificationToken());
    await repository.issue('changed', changed, 1000, 2000);
    await db.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind('new-changed@example.test', 'changed').run();
    assert.equal(await repository.consume(changed, 1500), false);
    assert.equal((await accounts.findSelf('changed'))?.emailVerifiedAtMs, null);
  });

  await t.test('a failed account update rolls token consumption back in the same transaction', async () => {
    const hash = await hashEmailVerificationToken(createEmailVerificationToken());
    await repository.issue('rollback', hash, 1000, 2000);
    await db.prepare(`CREATE TRIGGER fail_verification BEFORE UPDATE OF email_verified_at_ms ON accounts
      WHEN NEW.id = 'rollback' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`).run();
    await assert.rejects(repository.consume(hash, 1500));
    assert.equal((await accounts.findSelf('rollback'))?.emailVerifiedAtMs, null);
    assert.equal(await db.prepare('SELECT consumed_at_ms FROM email_verifications WHERE account_id = ?')
      .bind('rollback').first('consumed_at_ms'), null);
    await db.prepare('DROP TRIGGER fail_verification').run();
    assert.equal(await repository.consume(hash, 1500), true);
  });

  await t.test('a delayed failed send cannot erase a newer concurrently issued code', async () => {
    let failFirst: (error: Error) => void = () => { throw new Error('Not initialized.'); };
    const pending = new Promise<void>((_resolve, reject) => { failFirst = reject; });
    let entered: () => void = () => {};
    const firstEntered = new Promise<void>(resolve => { entered = resolve; });
    const tokens: string[] = [];
    const service = new EmailVerificationService(repository, { async send(message) {
      tokens.push(message.token);
      if (tokens.length === 1) { entered(); await pending; }
    } }, () => 1000);
    const firstResult = service.request('send-race', 1000).then(() => null, error => error);
    await firstEntered;
    assert.equal(await service.request('send-race', 1000), true);
    failFirst(new VerificationDeliveryError());
    assert.ok(await firstResult instanceof VerificationDeliveryError);
    assert.equal(await service.confirm(tokens[0]), false);
    assert.equal(await service.confirm(tokens[1]), true);
  });

  await t.test('public login remains available before email verification', async () => {
    const input = { email: 'unverified@example.test', name: 'Unverified', password: 'abcdef' };
    assert.equal((await post('/api/register', input)).status, 201);
    const response = await post('/api/login', { identifier: input.email, password: input.password });
    assert.equal(response.status, 200);
    assert.equal(await db.prepare('SELECT email_verified_at_ms FROM accounts WHERE email = ?')
      .bind(input.email).first('email_verified_at_ms'), null);
  });
});
