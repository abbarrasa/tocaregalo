import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionToken, hashSessionToken, sessionCsrfToken, equalCsrfTokens } from '../src/domain/session.ts';
import { sessionCookie, sessionCookieName, readSessionCookie, expiredSessionCookie } from '../src/http/session-cookie.ts';

test('session tokens are random and their stored hashes cannot be used as CSRF tokens', async () => {
  const token = createSessionToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, createSessionToken());
  const hash = await hashSessionToken(token);
  const csrf = await sessionCsrfToken(token);
  assert.notEqual(hash, token);
  assert.notEqual(csrf, hash);
  assert.notEqual(csrf, token);
  assert.equal(hash, await hashSessionToken(token));
  assert.ok(equalCsrfTokens(csrf, await sessionCsrfToken(token)));
  assert.equal(equalCsrfTokens(hash, csrf), false);
  assert.equal(equalCsrfTokens('', csrf), false);
  await assert.rejects(hashSessionToken('invalid'), RangeError);
});

test('cookies reject ambiguity and preserve secure attributes on issue and deletion', () => {
  const token = createSessionToken();
  const cookie = sessionCookie(token, 60);
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=60']) {
    assert.ok(cookie.includes(attribute));
  }
  assert.equal(cookie.includes('Domain='), false);
  assert.equal(readSessionCookie(`unrelated=x; ${sessionCookieName}=${token}`), token);
  assert.equal(readSessionCookie(`${sessionCookieName}=${token}; ${sessionCookieName}=${token}`), null);
  assert.equal(readSessionCookie(`${sessionCookieName}=invalid`), null);
  assert.equal(readSessionCookie(null), null);
  assert.ok(expiredSessionCookie().includes('Max-Age=0'));
  assert.ok(expiredSessionCookie().includes('Secure; HttpOnly; SameSite=Lax'));
  assert.throws(() => sessionCookie(token, 0), RangeError);
  assert.throws(() => sessionCookie('invalid', 60), RangeError);
});
