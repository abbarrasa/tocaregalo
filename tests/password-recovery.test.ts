import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordRecoveryToken, hashPasswordRecoveryToken } from '../src/domain/password-recovery.ts';
import { hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { hashSessionToken } from '../src/domain/session.ts';
import { PasswordRecoveryService, type PasswordRecoveryStore } from '../src/application/password-recovery-service.ts';
import { AuthInputError } from '../src/domain/authentication.ts';
import { ResendRecoverySender } from '../src/infrastructure/resend-recovery-sender.ts';
import { MailDeliveryError } from '../src/infrastructure/resend-transport.ts';

test('recovery tokens are random and cannot cross session or email-verification purposes', async () => {
  const token = createPasswordRecoveryToken();
  assert.notEqual(token, createPasswordRecoveryToken());
  const hash = await hashPasswordRecoveryToken(token);
  assert.notEqual(hash, token);
  assert.notEqual(hash, await hashEmailVerificationToken(token));
  assert.notEqual(hash, await hashSessionToken(token));
  await assert.rejects(hashPasswordRecoveryToken('invalid'), RangeError);
});

test('recovery rechecks expiry after hashing and cleans up only the failed delivery token', async () => {
  let now = 0;
  let issuedHash = '';
  let invalidated = '';
  let consumedAt = -1;
  const store: PasswordRecoveryStore = {
    async issue(_identifier, hash, created, expires) {
      issuedHash = hash; assert.equal(created, 0); assert.equal(expires, 1800000);
      return { email: 'stored@example.test' };
    },
    async invalidate(hash) { invalidated = hash; },
    async isActive() { return true; },
    async consume(_hash, passwordHash, time) { assert.equal(passwordHash, 'new-hash'); consumedAt = time; return false; },
  };
  const service = new PasswordRecoveryService(store, {
    async hash(password) { assert.equal(password, '      '); now = 1800000; return 'new-hash'; },
    async verify() { assert.fail('Recovery does not verify an old password'); },
  }, { async send(message) { assert.equal(message.email, 'stored@example.test'); throw new MailDeliveryError(); } }, () => now);
  await assert.rejects(service.request('lookup@example.test', 1800000), MailDeliveryError);
  assert.equal(invalidated, issuedHash);
  assert.equal(await service.confirm(createPasswordRecoveryToken(), '      '), false);
  assert.equal(consumedAt, 1800000);
  await assert.rejects(service.confirm(createPasswordRecoveryToken(), '12345'), AuthInputError);
});

test('recovery sender uses distinct content and never follows redirects or leaks provider errors', async () => {
  const message = { email: 'stored@example.test', token: createPasswordRecoveryToken(), expiresAtMs: 1800000 };
  const sender = new ResendRecoverySender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' }, async (_url, init) => {
    assert.equal(init?.redirect, 'manual');
    assert.ok(typeof init?.body === 'string');
    assert.ok(init.body.includes('Recupera tu contraseña'));
    assert.ok(init.body.includes(message.token));
    assert.equal(init.body.includes('Confirma tu correo'), false);
    return new Response(null, { status: 202 });
  });
  await sender.send(message);
  const failed = new ResendRecoverySender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' },
    async () => new Response('sensitive', { status: 302 }));
  await assert.rejects(failed.send(message), error => error instanceof MailDeliveryError && !error.message.includes('sensitive'));
});
