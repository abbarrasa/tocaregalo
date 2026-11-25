import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailVerificationToken, hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { hashSessionToken } from '../src/domain/session.ts';
import { VerificationDeliveryError } from '../src/application/email-verification-service.ts';
import { authObject } from '../src/domain/authentication.ts';
import { ResendVerificationSender } from '../src/infrastructure/resend-verification-sender.ts';

test('verification tokens are random, hashed and separated from session token hashes', async () => {
  const token = createEmailVerificationToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, createEmailVerificationToken());
  const hash = await hashEmailVerificationToken(token);
  assert.notEqual(hash, token);
  assert.notEqual(hash, await hashSessionToken(token));
  assert.equal(hash, await hashEmailVerificationToken(token));
  await assert.rejects(hashEmailVerificationToken('invalid'), RangeError);
});

test('Resend adapter sends plain text to a fixed HTTPS endpoint', async () => {
  let calls = 0;
  const sender = new ResendVerificationSender({ apiKey: 'synthetic-test-key', fromEmail: ' Sender@EXAMPLE.TEST ' },
    async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(init?.redirect, 'manual');
      assert.ok(init?.signal);
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-test-key');
      assert.ok(typeof init?.body === 'string');
      const body = authObject(JSON.parse(init.body));
      assert.equal(body.from, 'sender@example.test');
      assert.deepEqual(body.to, ['member@example.test']);
      assert.equal(body.subject, 'Confirma tu correo en TocaRegalo');
      assert.ok(init.body.includes('a'.repeat(64)));
      assert.equal(init.body.includes('synthetic-test-key'), false);
      return new Response(null, { status: 202 });
    });
  await sender.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });
  assert.equal(calls, 1);
});

test('Resend development test mode skips external calls and test-recipient redirection stays opt-in', async () => {
  const testMode = new ResendVerificationSender({
    apiKey: 'synthetic-test-key',
    fromEmail: 'sender@example.test',
    appEnvironment: 'development',
    testMode: true,
    testRecipientEmail: 'developer@example.test',
  }, async (_url, init) => {
    assert.fail('Test mode must not call Resend.');
  });
  await testMode.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });

  const redirected = new ResendVerificationSender({
    apiKey: 'synthetic-test-key',
    fromEmail: 'sender@example.test',
    appEnvironment: 'development',
    testMode: false,
    testRecipientEmail: 'developer@example.test',
  }, async (_url, init) => {
    const body = authObject(JSON.parse(String(init?.body)));
    assert.deepEqual(body.to, ['developer@example.test']);
    return new Response(null, { status: 200 });
  });
  await redirected.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });

  for (const configuration of [
    { apiKey: 'synthetic-test-key', fromEmail: 'sender@example.test', appEnvironment: 'production', testMode: true },
    { apiKey: 'synthetic-test-key', fromEmail: 'sender@example.test', appEnvironment: 'production', testRecipientEmail: 'developer@example.test' },
  ]) {
    const unsafe = new ResendVerificationSender(configuration, async () => {
      assert.fail('Development routing must not call Resend outside development.');
    });
    await assert.rejects(unsafe.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 }), VerificationDeliveryError);
  }
});

test('provider failures and bad configuration produce generic errors without leaking provider details', async () => {
  const message = { email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 };
  for (const status of [302, 401, 429, 500]) {
    const sender = new ResendVerificationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test', appEnvironment: 'development', testMode: false },
      async () => new Response('provider detail must not leak', { status }));
    await assert.rejects(sender.send(message), error => error instanceof VerificationDeliveryError
      && error.message === 'Verification delivery unavailable.');
  }
  const sender = new ResendVerificationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test', appEnvironment: 'development', testMode: false },
    async () => { throw new Error('sensitive provider detail'); });
  await assert.rejects(sender.send(message), VerificationDeliveryError);
  for (const configuration of [
    { apiKey: undefined, fromEmail: 'sender@example.test' },
    { apiKey: 'synthetic-key', fromEmail: 'invalid' },
  ]) {
    const unconfigured = new ResendVerificationSender(configuration, async () => {
      assert.fail('No network call is permitted for invalid configuration.');
    });
    await assert.rejects(unconfigured.send(message), VerificationDeliveryError);
  }
});
