import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, Response as MiniflareResponse, convertV4MiniflareOptions } from 'miniflare';
import { CredentialsRepository } from '../src/persistence/credentials-repository.ts';
import { PasswordRecoveriesRepository } from '../src/persistence/password-recoveries-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { AuthenticationService } from '../src/application/authentication-service.ts';
import { PasswordRecoveryService } from '../src/application/password-recovery-service.ts';
import { createPasswordRecoveryToken, hashPasswordRecoveryToken } from '../src/domain/password-recovery.ts';
import { createEmailVerificationToken, hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { authObject } from '../src/domain/authentication.ts';
import { Argon2PasswordHasher } from '../src/infrastructure/argon2-password-hasher.ts';

test('password recovery runs through the bundled Worker and atomic D1 mutations', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-recovery-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const messages: { email: string; token: string }[] = [];
  let providerStatus = 202;
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'recovery-test', modules: true, script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, SESSION_TTL_SECONDS: '86400', PASSWORD_RECOVERY_TTL_SECONDS: '1800',
      RESEND_API_KEY: 'synthetic-key', RESEND_FROM_EMAIL: 'sender@example.test', APP_ENV: 'development', RESEND_TEST_MODE: 'false',
      LOCAL_COUNTRY_PHONE_PREFIX: '+1' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.resend.com/emails');
      const body = authObject(await request.json());
      assert.ok(Array.isArray(body.to));
      const email = body.to[0];
      assert.ok(typeof email === 'string');
      const text = body.text;
      assert.ok(typeof text === 'string');
      const token = text.match(/\b[a-f0-9]{64}\b/)?.[0]; assert.ok(token);
      messages.push({ email, token });
      return new MiniflareResponse(null, { status: providerStatus });
    },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql', '0005_email_verification.sql', '0006_password_recovery.sql']) {
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  }
  const credentials = new CredentialsRepository(db);
  const aliceHash = await new Argon2PasswordHasher().hash('abcdef');
  for (const id of ['alice', 'expiry', 'rollback', 'race', 'send-race', 'changed', 'us']) {
    await credentials.create({ id, email: id + '@example.test', displayName: id, lastName: null,
      phone: id === 'alice' ? '+34612345678' : id === 'us' ? '+12025550100' : null, createdAtMs: 0 }, id === 'alice' ? aliceHash : 'old-hash');
  }
  await db.prepare('INSERT INTO accounts (id,email,display_name,created_at_ms) VALUES (?,?,?,?)')
    .bind('legacy', 'legacy@example.test', 'Legacy', 0).run();
  await db.prepare('INSERT INTO accounts (id,email,display_name,created_at_ms) VALUES (?,?,?,?)')
    .bind('credentialless', 'credentialless@example.test', 'Credentialless', 0).run();
  await db.prepare(`INSERT INTO password_recoveries
    (account_id,email,credential_revision,token_hash,created_at_ms,expires_at_ms,consumption_id)
    VALUES (?,?,?,?,?,?,NULL)`)
    .bind('alice', 'alice@example.test', 99, 'd'.repeat(64), 1000, 2000).run();
  const migration14 = await readFile(new URL('../migrations/0014_password_recovery_credentialless.sql', import.meta.url), 'utf8');
  await db.batch(migration14.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM password_recovery_migration_quarantine').first('n'), 1);
  assert.equal(await db.prepare('SELECT count(*) AS n FROM password_recoveries WHERE token_hash=?').bind('d'.repeat(64)).first('n'), 0);
  const sessions = new SessionService(new SessionsRepository(db));
  const oldSession = await sessions.issueForVerifiedAccount('alice', 86400000);
  // Upgrade populated state: pre-existing credentials, sessions and nullable verification must survive.
  assert.ok(await sessions.authenticate(oldSession.token));
  assert.equal((await credentials.findCredential('alice@example.test'))?.passwordHash, aliceHash);
  const repository = new PasswordRecoveriesRepository(db);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => mf.dispatchFetch(origin + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const eventually = async (condition: () => Promise<boolean> | boolean) => {
    for (let n = 0; n < 200; n++) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Background recovery did not complete within the test deadline');
  };
  const requestCode = async (identifier: string, extra: Record<string, string> = {}, expectedEmail?: string) => {
    const before = messages.length;
    const response = await post('/api/password-recovery/request', { identifier, ...extra });
    if (expectedEmail) await eventually(() => messages.slice(before).some(message => message.email === expectedEmail));
    return response;
  };
  const confirm = (token: string, newPassword = '😀😀😀😀😀😀') => post('/api/password-recovery/confirm', { token, newPassword });
  const issue = async (id: string, now = 1000, ttl = 1000) => {
    const token = createPasswordRecoveryToken();
    await repository.issue(id + '@example.test', await hashPasswordRecoveryToken(token), now, now + ttl);
    return token;
  };

  await t.test('public responses do not disclose existence, legacy credentials or provider failure', async () => {
    const known = await requestCode(' ALICE@example.test ', { email: 'attacker@example.test', accountId: 'legacy' }, 'alice@example.test');
    assert.equal(known.status, 202);
    assert.equal(known.headers.get('Cache-Control'), 'no-store');
    assert.equal(messages.at(-1)?.email, 'alice@example.test');
    const count = messages.length;
    for (const identifier of ['absent@example.test', 'legacy@example.test']) {
      const response = await requestCode(identifier, {}, identifier === 'legacy@example.test' ? identifier : undefined);
      assert.equal(response.status, known.status);
      assert.deepEqual(await response.json(), await known.clone().json());
    }
    const credentialless = await requestCode('credentialless@example.test', {}, 'credentialless@example.test');
    assert.equal(credentialless.status, 202);
    const credentiallessMessage = messages.find(message => message.email === 'credentialless@example.test');
    assert.ok(credentiallessMessage);
    const credentiallessToken = credentiallessMessage.token;
    assert.ok(credentiallessToken);
    assert.equal((await confirm(credentiallessToken, 'new-password')).status, 204);
    assert.ok(await db.prepare('SELECT password_hash FROM password_credentials WHERE account_id=?')
      .bind('credentialless').first('password_hash'));
    const us = await requestCode('2025550100', {}, 'us@example.test');
    assert.equal(us.status, 202);
    assert.equal(messages.at(-1)?.email, 'us@example.test');
    assert.ok(messages.length >= count + 2);
    const usToken = messages.at(-1)?.token;
    assert.ok(usToken);
    assert.equal(await repository.isActive(await hashPasswordRecoveryToken(usToken), Date.now()), true);
    providerStatus = 500;
    const failed = await requestCode('changed@example.test', {}, 'changed@example.test');
    assert.equal(failed.status, 202);
    assert.deepEqual(await failed.json(), await known.json());
    await eventually(async () => await db.prepare('SELECT count(*) AS n FROM password_recoveries WHERE account_id = ?').bind('changed').first('n') === 0);
    providerStatus = 202;
  });

  await t.test('phone request uses stored email, resend replaces code, and reset revokes every session', async () => {
    const oldToken = messages[0].token;
    const secondSession = await sessions.issueForVerifiedAccount('alice', 86400000);
    assert.equal((await requestCode('+34 (612) 345-678', {}, 'alice@example.test')).status, 202);
    const message = messages.at(-1); assert.ok(message);
    assert.equal(message.email, 'alice@example.test');
    assert.equal((await confirm(oldToken)).status, 400);
    const record = await db.prepare('SELECT * FROM password_recoveries WHERE account_id = ?').bind('alice').first();
    assert.equal(JSON.stringify(record).includes(message.token), false);
    assert.equal((await confirm(message.token, '12345')).status, 400);
    const responses = await Promise.all([confirm(message.token), confirm(message.token)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [204, 400]);
    for (const response of responses) assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(await sessions.authenticate(oldSession.token), null);
    assert.equal(await sessions.authenticate(secondSession.token), null);
    const login = (password: string) => post('/api/login', { identifier: 'alice@example.test', password });
    assert.equal((await login('abcdef')).status, 401);
    assert.equal((await login('😀😀😀😀😀😀')).status, 200);
    assert.equal(await db.prepare('SELECT email_verified_at_ms FROM accounts WHERE id = ?').bind('alice').first('email_verified_at_ms'), null);
  });

  await t.test('expiry is inclusive, email changes invalidate recovery and verification tokens cannot reset passwords', async () => {
    const token = await issue('expiry');
    const hash = await hashPasswordRecoveryToken(token);
    assert.equal(await repository.isActive(hash, 999), false);
    assert.equal(await repository.isActive(hash, 1999), true);
    assert.equal(await repository.consume(hash, 'new-hash', 2000), false);
    const changedToken = await issue('changed');
    await db.prepare('UPDATE accounts SET email = ? WHERE id = ?').bind('new@example.test', 'changed').run();
    assert.equal(await repository.consume(await hashPasswordRecoveryToken(changedToken), 'new-hash', 1500), false);
    const verification = createEmailVerificationToken();
    await db.prepare(`INSERT INTO email_verifications (account_id,email,token_hash,created_at_ms,expires_at_ms)
      VALUES (?,?,?,?,?)`).bind('race', 'race@example.test', await hashEmailVerificationToken(verification), 0, Date.now() + 10000).run();
    assert.equal((await confirm(verification)).status, 400);
  });

  await t.test('failed password update rolls back token consumption and session revocation', async () => {
    const token = await issue('rollback');
    const session = await sessions.issueForVerifiedAccount('rollback', 86400000);
    await db.prepare(`CREATE TRIGGER reject_reset BEFORE UPDATE OF password_hash ON password_credentials
      WHEN NEW.account_id = 'rollback' BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END`).run();
    const hash = await hashPasswordRecoveryToken(token);
    await assert.rejects(repository.consume(hash, 'new-hash', 1500), /synthetic rollback/);
    assert.equal(await repository.isActive(hash, 1500), true);
    assert.ok(await sessions.authenticate(session.token));
    assert.equal((await credentials.findCredential('rollback@example.test'))?.passwordHash, 'old-hash');
    await db.prepare('DROP TRIGGER reject_reset').run();
    assert.equal(await repository.consume(hash, 'new-hash', 1500), true);
  });

  await t.test('a login paused after checking an old password cannot create a session after reset', async () => {
    const token = await issue('race');
    const auth = new AuthenticationService(credentials, {
      async hash() { return 'unused'; },
      async verify() {
        assert.equal(await repository.consume(await hashPasswordRecoveryToken(token), 'new-hash', 1500), true);
        return true;
      },
    }, sessions);
    assert.equal(await auth.login('race@example.test', 'old-password', 86400000), null);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM sessions WHERE account_id = ?').bind('race').first('n'), 0);
  });

  await t.test('a failed send cannot delete a newer concurrent challenge', async () => {
    let replacement = '';
    const service = new PasswordRecoveryService(repository, {
      async hash() { return 'unused'; }, async verify() { return false; },
    }, { async send() { replacement = await issue('send-race'); throw new Error('synthetic send failure'); } }, () => 1000);
    await assert.rejects(service.request('send-race@example.test', 1000), /synthetic send failure/);
    assert.equal(await repository.isActive(await hashPasswordRecoveryToken(replacement), 1500), true);
  });

  await t.test('origin, JSON, methods, request quotas and confirmation quotas are enforced', async () => {
    assert.equal((await post('/api/password-recovery/request', { identifier: 'x@example.test' }, { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await post('/api/password-recovery/request', {}, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await mf.dispatchFetch(origin + '/api/password-recovery/request')).status, 405);
    for (let n = 0; n < 5; n++) assert.equal((await requestCode('limited@example.test')).status, 202);
    assert.equal((await requestCode('limited@example.test')).status, 429);
    for (let n = 0; n < 30; n++) {
      assert.equal((await post('/api/password-recovery/confirm', { token: 'invalid', newPassword: 'abcdef' }, { 'CF-Connecting-IP': 'confirm-limit' })).status, 400);
    }
    assert.equal((await post('/api/password-recovery/confirm', { token: 'invalid', newPassword: 'abcdef' }, { 'CF-Connecting-IP': 'confirm-limit' })).status, 429);
  });
});
