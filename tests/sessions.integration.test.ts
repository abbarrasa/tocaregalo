import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SessionService } from '../src/application/session-service.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { handleSessionRequest } from '../src/http/session-routes.ts';
import { sessionCookieName } from '../src/http/session-cookie.ts';

test('persistent sessions enforce identity, expiration, revocation and HTTP protections', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'sessions-test', modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql']) {
    // These migrations contain plain DDL only, with no embedded semicolons.
    const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
    await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    if (name === '0002_accounts_groups.sql') {
      await db.prepare('INSERT INTO events (id, closure_at_ms, created_at_ms) VALUES (?, ?, ?)')
        .bind('legacy-event', null, 0).run();
    }
  }
  assert.ok(await db.prepare('SELECT id FROM events WHERE id = ?').bind('legacy-event').first());
  const accounts = new AccountsRepository(db);
  for (const id of ['alice', 'bob']) {
    await accounts.create({ id, email: `${id}@example.test`, displayName: id, createdAtMs: 0 });
  }
  let now = 1000;
  const store = new SessionsRepository(db);
  const sessions = new SessionService(store, () => now);
  const origin = 'https://app.example.test';
  const dependencies = { sessions, accounts, applicationOrigin: origin };
  const cookie = (token: string) => `${sessionCookieName}=${token}`;
  const request = (path: string, init?: RequestInit) => handleSessionRequest(new Request(origin + path, init), dependencies);

  await t.test('only hashes are persisted and unknown accounts cannot receive sessions', async () => {
    const issued = await sessions.issueForVerifiedAccount('alice', 2000);
    const session = await sessions.authenticate(issued.token);
    assert.ok(session);
    assert.equal(session?.accountId, 'alice');
    const row = await db.prepare('SELECT * FROM sessions WHERE token_hash = ?').bind(session.tokenHash).first();
    assert.ok(row);
    assert.equal(JSON.stringify(row).includes(issued.token), false);
    assert.equal(JSON.stringify(row).includes(issued.csrfToken), false);
    await assert.rejects(sessions.issueForVerifiedAccount('missing', 2000));
    await assert.rejects(sessions.issueForVerifiedAccount('alice', 0), RangeError);
    await assert.rejects(sessions.issueForVerifiedAccount('alice', Number.MAX_SAFE_INTEGER), RangeError);
    assert.equal(await sessions.authenticate('invalid'), null);
    assert.equal(await sessions.authenticate('0'.repeat(64)), null);
    // An independent service instance reads the same durable state.
    assert.equal((await new SessionService(store, () => now).authenticate(issued.token))?.accountId, 'alice');
    now = 2999;
    assert.ok(await sessions.authenticate(issued.token));
    now = 3000;
    assert.equal(await sessions.authenticate(issued.token), null);
  });

  await t.test('me uses the session identity, is not cacheable, and does not expose tokens', async () => {
    assert.equal((await request('/api/me')).status, 401);
    const alice = await sessions.issueForVerifiedAccount('alice', 60_000);
    const response = await request('/api/me?accountId=bob', { headers: { Cookie: cookie(alice.token) } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.equal(body.account.id, 'alice');
    assert.equal(body.csrfToken, alice.csrfToken);
    assert.equal(JSON.stringify(body).includes(alice.token), false);
    assert.equal((await request('/api/me', { method: 'POST' })).status, 405);
    assert.equal((await request('/api/logout')).status, 405);
    assert.equal((await request('/api/login', { method: 'POST' })).status, 404);
  });

  await t.test('logout requires a trusted origin and the current session CSRF token', async () => {
    const alice = await sessions.issueForVerifiedAccount('alice', 60_000);
    const bob = await sessions.issueForVerifiedAccount('bob', 60_000);
    const otherDevice = await sessions.issueForVerifiedAccount('alice', 60_000);
    const rejectedHeaders: Record<string, string>[] = [
      { Origin: 'https://evil.example.test', 'X-CSRF-Token': alice.csrfToken },
      { Origin: 'null', 'X-CSRF-Token': alice.csrfToken },
      { 'X-CSRF-Token': alice.csrfToken },
      { Origin: origin },
      { Origin: origin, 'X-CSRF-Token': bob.csrfToken },
    ];
    for (const headers of rejectedHeaders) {
      const result = await request('/api/logout', {
        method: 'POST', headers: { ...headers, Cookie: cookie(alice.token) },
      });
      assert.equal(result.status, 403);
      assert.ok(await sessions.authenticate(alice.token));
    }
    const result = await request('/api/logout', {
      method: 'POST', headers: { Cookie: cookie(alice.token), Origin: origin, 'X-CSRF-Token': alice.csrfToken },
    });
    assert.equal(result.status, 204);
    assert.ok(result.headers.get('Set-Cookie')?.includes('Max-Age=0'));
    assert.equal(await sessions.authenticate(alice.token), null);
    assert.ok(await sessions.authenticate(bob.token));
    assert.ok(await sessions.authenticate(otherDevice.token));
    assert.equal((await request('/api/me', { headers: { Cookie: cookie(alice.token) } })).status, 401);
    await sessions.revoke(alice.token); // Repeated revocation is harmless.
  });

  await t.test('misconfigured origin fails closed and deleting an account removes its sessions', async () => {
    const issued = await sessions.issueForVerifiedAccount('bob', 60_000);
    for (const applicationOrigin of ['', 'http://app.example.test', origin + '/path']) {
      const response = await handleSessionRequest(new Request(origin + '/api/logout', {
        method: 'POST', headers: { Cookie: cookie(issued.token), Origin: origin, 'X-CSRF-Token': issued.csrfToken },
      }), { ...dependencies, applicationOrigin });
      assert.equal(response.status, 503);
      assert.ok(await sessions.authenticate(issued.token));
    }
    await db.prepare('DELETE FROM accounts WHERE id = ?').bind('bob').run();
    assert.equal(await sessions.authenticate(issued.token), null);
  });
});
