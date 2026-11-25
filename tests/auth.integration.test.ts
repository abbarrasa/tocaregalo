import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { CredentialsRepository } from '../src/persistence/credentials-repository.ts';
import { RegistrationConflictError } from '../src/application/authentication-service.ts';
import { AuthCountersRepository } from '../src/persistence/auth-counters-repository.ts';
import { AuthRateLimiter, authWindowMs } from '../src/application/auth-rate-limiter.ts';
import { authObject } from '../src/domain/authentication.ts';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { Argon2PasswordHasher } from '../src/infrastructure/argon2-password-hasher.ts';
import { ProfileConflictError } from '../src/application/profile-service.ts';

async function accountFrom(response: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  return authObject(authObject(await response.json()).account);
}

test('bundled Worker registration and login run real Argon2id against D1', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-auth-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'auth-test', modules: true,
    script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, SESSION_TTL_SECONDS: '86400' },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql', '0005_email_verification.sql', '0006_password_recovery.sql', '0013_social_auth.sql']) {
    // These migrations are plain DDL without embedded semicolons.
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    if (name === '0003_sessions.sql') {
      await db.prepare('INSERT INTO accounts (id, email, display_name, created_at_ms) VALUES (?, ?, ?, ?)')
        .bind('legacy', 'legacy@example.test', 'Legacy', 0).run();
    }
  }
  const post = (path: string, data: unknown, headers: Record<string, string> = {}) => mf.dispatchFetch(origin + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
  });
  const alice = { email: ' Alice@EXAMPLE.TEST ', name: ' Alice ', password: 'abcdef' };
  let aliceId = '';
  let storedHash = '';
  let aliceCookie = '';
  let csrfToken = '';

  await t.test('register creates profile and salted credential atomically, without granting a session', async () => {
    const response = await post('/api/register', { ...alice, id: 'legacy', role: 'owner' });
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal(response.headers.get('Set-Cookie'), null);
    const account = await accountFrom(response);
    assert.ok(typeof account.id === 'string');
    aliceId = account.id;
    assert.notEqual(aliceId, 'legacy');
    assert.equal(account.email, 'alice@example.test');
    assert.equal(account.displayName, 'Alice');
    assert.equal(account.phone, null);
    assert.equal(account.lastName, null);
    const row = await db.prepare('SELECT password_hash FROM password_credentials WHERE account_id = ?')
      .bind(aliceId).first<{ password_hash: string }>();
    assert.ok(row);
    storedHash = row.password_hash;
    assert.match(storedHash, /^\$argon2id\$/);
    assert.equal(storedHash.includes(alice.password), false);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM sessions').first('n'), 0);
    assert.equal((await post('/api/register', { ...alice, email: 'alice@example.test' })).status, 409);
    assert.equal((await post('/api/register', { ...alice, email: 'legacy@example.test' })).status, 409);
  });

  await t.test('email login, protected me and logout work through the real Worker', async () => {
    const response = await post('/api/login', { identifier: ' ALICE@EXAMPLE.TEST ', password: alice.password });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.get('Set-Cookie');
    assert.ok(cookie);
    assert.match(cookie, /Secure; HttpOnly; SameSite=Lax/);
    assert.match(cookie, /Max-Age=86[0-9]{3}/);
    aliceCookie = cookie.split(';')[0];
    const csrf = authObject(await response.json()).csrfToken;
    assert.ok(typeof csrf === 'string');
    csrfToken = csrf;
    const me = await mf.dispatchFetch(origin + '/api/me?accountId=legacy', { headers: { Cookie: aliceCookie } });
    assert.equal(me.status, 200);
    assert.equal((await accountFrom(me)).id, aliceId);
    const logout = await post('/api/logout', {}, { Cookie: aliceCookie, 'X-CSRF-Token': csrfToken });
    assert.equal(logout.status, 204);
    assert.equal((await mf.dispatchFetch(origin + '/api/me', { headers: { Cookie: aliceCookie } })).status, 401);
    const bad = await post('/api/login', { identifier: alice.email, password: 'wrong-password' });
    const unknown = await post('/api/login', { identifier: 'unknown@example.test', password: 'wrong-password' });
    const legacy = await post('/api/login', { identifier: 'legacy@example.test', password: 'wrong-password' });
    assert.equal(bad.status, 401);
    assert.equal(bad.headers.get('Set-Cookie'), null);
    assert.equal(unknown.status, 401);
    assert.equal(legacy.status, 401);
    assert.equal(await bad.text(), await unknown.text());
  });

  await t.test('optional surname and canonical phone are persisted and phone login uses the password', async () => {
    const result = await post('/api/register', {
      email: 'bob@example.test', name: 'Bob', lastName: ' Example ', phone: '+34 (612) 345-678', password: '123456',
    });
    assert.equal(result.status, 201);
    const account = await accountFrom(result);
    assert.equal(account.phone, '+34612345678');
    assert.equal(account.lastName, 'Example');
    const loggedIn = await post('/api/login', { identifier: '+34 612-345-678', password: '123456' });
    assert.equal(loggedIn.status, 200);
    const national = await post('/api/login', { identifier: '612345678', password: '123456' });
    assert.equal(national.status, 200);
    const countryPrefix = await post('/api/login', { identifier: '34 612345678', password: '123456' });
    assert.equal(countryPrefix.status, 200);
    assert.equal((await post('/api/login', { identifier: '612345678abc', password: '123456' })).status, 400);
    const bobCookie = loggedIn.headers.get('Set-Cookie')?.split(';')[0];
    assert.ok(bobCookie);
    const me = await mf.dispatchFetch(origin + '/api/me', { headers: { Cookie: bobCookie } });
    assert.equal((await accountFrom(me)).phone, '+34612345678');
    assert.equal((await post('/api/register', {
      ...alice, email: 'duplicate-phone@example.test', phone: '+34612345678',
    })).status, 409);
  });

  await t.test('authenticated profile updates use session identity, CSRF and credential revocation', async () => {
    const login = await post('/api/login', { identifier: alice.email, password: alice.password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('Set-Cookie')?.split(';')[0];
    assert.ok(cookie);
    const csrf = authObject(await login.json()).csrfToken;
    assert.ok(typeof csrf === 'string');
    const patch = (body: unknown, extraHeaders: Record<string, string> = {}) => mf.dispatchFetch(origin + '/api/me/profile', {
      method: 'PATCH',
      headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
    });
    assert.equal((await patch({
      name: ' Alice Updated ',
      email: 'alice-updated@example.test',
      phone: '+34 (612) 345-679',
    })).status, 200);
    const me = await mf.dispatchFetch(origin + '/api/me', { headers: { Cookie: cookie } });
    const updated = await accountFrom(me);
    assert.equal(updated.displayName, 'Alice Updated');
    assert.equal(updated.email, 'alice-updated@example.test');
    assert.equal(updated.phone, '+34612345679');
    assert.equal(updated.emailVerifiedAtMs, null);
    assert.equal((await patch({
      name: 'Alice Updated',
      email: 'alice-updated@example.test',
      currentPassword: alice.password,
      newPassword: 'new-password',
    })).status, 200);
    assert.equal((await mf.dispatchFetch(origin + '/api/me', { headers: { Cookie: cookie } })).status, 401);
    assert.equal((await post('/api/login', {
      identifier: 'alice-updated@example.test', password: 'new-password',
    })).status, 200);
  });

  await t.test('a stale email snapshot rejects the entire profile update', async () => {
    const repository = new AccountsRepository(db);
    await repository.create({ id: 'race-email', email: 'race-email-a@example.test', displayName: 'Race', createdAtMs: 0 });
    await db.prepare('UPDATE accounts SET email = ?, email_verified_at_ms = ? WHERE id = ?')
      .bind('race-email-b@example.test', 1234, 'race-email').run();
    await db.prepare(`INSERT INTO email_verifications
      (account_id,email,token_hash,created_at_ms,expires_at_ms,consumed_at_ms,consumption_id)
      VALUES (?,?,?,?,?,NULL,NULL)`)
      .bind('race-email', 'race-email-b@example.test', 'b'.repeat(64), 1000, 2000).run();
    const raceHash = await (new Argon2PasswordHasher()).hash('race-password');
    await db.prepare('INSERT INTO password_credentials (account_id,password_hash,created_at_ms,revision) VALUES (?,?,?,0)')
      .bind('race-email', raceHash, 0).run();
    await db.prepare(`INSERT INTO password_recoveries
      (account_id,email,credential_revision,token_hash,created_at_ms,expires_at_ms,consumption_id)
      VALUES (?,?,?,?,?,?,NULL)`)
      .bind('race-email', 'race-email-b@example.test', 0, 'c'.repeat(64), 1000, 2000).run();
    await assert.rejects(repository.update('race-email', {
      name: 'Race Restored',
      email: 'race-email-a@example.test',
      lastName: null,
      phone: null,
      currentPassword: null,
      newPassword: null,
    }, null, null, 'race-email-a@example.test', 100), ProfileConflictError);
    const account = await repository.findSelf('race-email');
    assert.equal(account?.email, 'race-email-b@example.test');
    assert.equal(account?.displayName, 'Race');
    assert.equal(account?.emailVerifiedAtMs, 1234);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM email_verifications WHERE account_id=?').bind('race-email').first('n'), 1);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM password_recoveries WHERE account_id=?').bind('race-email').first('n'), 1);
  });

  await t.test('a stale credential snapshot rejects an entire profile password update', async () => {
    const repository = new AccountsRepository(db);
    await repository.create({ id: 'race-profile', email: 'race-profile@example.test', displayName: 'Race', createdAtMs: 0 });
    const passwords = new Argon2PasswordHasher();
    const oldHash = await passwords.hash('old-password');
    await db.prepare('INSERT INTO password_credentials (account_id, password_hash, created_at_ms, revision) VALUES (?, ?, ?, 0)')
      .bind('race-profile', oldHash, 0).run();
    const snapshot = await repository.findCredential('race-profile');
    assert.ok(snapshot);
    const newHash = await passwords.hash('changed-elsewhere');
    await db.prepare('UPDATE password_credentials SET password_hash = ?, revision = revision + 1 WHERE account_id = ?')
      .bind(newHash, 'race-profile').run();
    await assert.rejects(repository.update('race-profile', {
      name: 'Race Updated',
      email: 'race-profile-updated@example.test',
      lastName: null,
      phone: null,
      currentPassword: 'old-password',
      newPassword: 'new-password',
    }, await passwords.hash('new-password'), snapshot, 'race-profile@example.test', 100),
    (error: unknown) => error instanceof ProfileConflictError
      && error.fields.currentPassword !== undefined
      && error.fields.email === undefined);
    const account = await repository.findSelf('race-profile');
    assert.equal(account?.displayName, 'Race');
    assert.equal(account?.email, 'race-profile@example.test');
  });

  await t.test('minimum six and no password-specific maximum are honored by HTTP', async () => {
    assert.equal((await post('/api/register', { ...alice, password: '12345' })).status, 400);
    assert.equal((await post('/api/register', { email: 'missing@example.test', password: '123456' })).status, 400);
    for (const [index, password] of ['      ', '😀😀😀😀😀😀', 'a'.repeat(1024)].entries()) {
      const email = `policy-${index}@example.test`;
      assert.equal((await post('/api/register', { email, name: 'Policy', password })).status, 201);
      assert.equal((await post('/api/login', { identifier: email, password })).status, 200);
    }
  });

  await t.test('invalid registration and profile inputs expose field-scoped public errors', async () => {
    const registration = await post('/api/register', {
      email: 'invalid', name: '', phone: '612345678', password: '123',
    });
    assert.equal(registration.status, 400);
    const body = authObject(await registration.json());
    assert.equal(body.code, 'validation_error');
    assert.deepEqual(authObject(body.fields).name, 'El nombre debe tener entre 1 y 100 caracteres.');
  });

  await t.test('wrong origins, methods and malformed or oversized JSON are rejected before hashing', async () => {
    assert.equal((await post('/api/register', alice, { Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await mf.dispatchFetch(origin + '/api/login')).status, 405);
    assert.equal((await post('/api/login', {}, { 'Content-Type': 'text/plain' })).status, 415);
    const invalid = await mf.dispatchFetch(origin + '/api/register', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(invalid.status, 400);
    assert.equal((await post('/api/register', { ...alice, password: 'x'.repeat(17_000) })).status, 413);
  });

  await t.test('unknown identifiers receive five attempts, then 429 without creating a session', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await post('/api/login', { identifier: 'limited@example.test', password: 'abcdef' })).status, 401);
    }
    const blocked = await post('/api/login', { identifier: 'limited@example.test', password: 'abcdef' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('Retry-After'), '900');
  });

  await t.test('duplicate concurrent registrations cannot split an account from its credential', async () => {
    const repository = new CredentialsRepository(db);
    const base = { email: 'race@example.test', displayName: 'Race', lastName: null, phone: null, createdAtMs: 0 };
    const results = await Promise.allSettled([
      repository.create({ ...base, id: 'race-a' }, storedHash),
      repository.create({ ...base, id: 'race-b' }, storedHash),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof RegistrationConflictError);
    assert.equal(await db.prepare(`SELECT count(*) AS n FROM accounts a
      JOIN password_credentials c ON c.account_id = a.id WHERE a.email = ?`).bind(base.email).first('n'), 1);
    await db.prepare(`CREATE TRIGGER fail_credential BEFORE INSERT ON password_credentials
      WHEN NEW.account_id = 'failed-account' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`).run();
    await assert.rejects(repository.create({ ...base, id: 'failed-account', email: 'failed@example.test' }, storedHash));
    assert.equal(await db.prepare('SELECT id FROM accounts WHERE id = ?').bind('failed-account').first(), null);
  });

  await t.test('rate counters are atomic under contention and reset at the window boundary', async () => {
    const counters = new AuthCountersRepository(db);
    const results = await Promise.all(Array.from({ length: 12 }, () => counters.consume('synthetic-key-hash', 0, 5)));
    assert.equal(results.filter(Boolean).length, 5);
    assert.equal(await counters.consume('synthetic-key-hash', authWindowMs, 5), true);
    let now = 0;
    const limiter = new AuthRateLimiter(counters, () => now);
    for (let i = 0; i < 10; i++) assert.equal(await limiter.allow('register', 'synthetic-ip'), true);
    assert.equal(await limiter.allow('register', 'synthetic-ip'), false);
    now = authWindowMs;
    assert.equal(await limiter.allow('register', 'synthetic-ip'), true);
    const raw = JSON.stringify(await db.prepare('SELECT * FROM auth_rate_limits WHERE key_hash <> ?')
      .bind('synthetic-key-hash').all());
    assert.equal(raw.includes('synthetic-ip'), false);
  });
});
