import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailVerificationToken, hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { hashSessionToken } from '../src/domain/session.ts';
import { SendgridVerificationSender } from '../src/infrastructure/sendgrid-verification-sender.ts';
import { VerificationDeliveryError } from '../src/application/email-verification-service.ts';
import { authObject } from '../src/domain/authentication.ts';

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

test('SendGrid adapter sends plain text to a fixed HTTPS endpoint with tracking disabled', async () => {
  let calls = 0;
  const sender = new SendgridVerificationSender({ apiKey: 'synthetic-test-key', fromEmail: ' Sender@EXAMPLE.TEST ' },
    async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
      assert.equal(init?.redirect, 'manual');
      assert.ok(init?.signal);
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-test-key');
      assert.ok(typeof init?.body === 'string');
      const body = authObject(JSON.parse(init.body));
      assert.deepEqual(body.from, { email: 'sender@example.test', name: 'TocaRegalo' });
      assert.deepEqual(body.personalizations, [{ to: [{ email: 'member@example.test' }] }]);
      assert.deepEqual(body.tracking_settings, { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } });
      assert.ok(init.body.includes('a'.repeat(64)));
      assert.equal(init.body.includes('synthetic-test-key'), false);
      return new Response(null, { status: 202 });
    });
  await sender.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });
  assert.equal(calls, 1);
});

test('SendGrid development sandbox has priority and test-recipient redirection stays opt-in', async () => {
  const sandbox = new SendgridVerificationSender({
    apiKey: 'synthetic-test-key',
    fromEmail: 'sender@example.test',
    appEnvironment: 'development',
    sandboxMode: true,
    testRecipientEmail: 'developer@example.test',
  }, async (_url, init) => {
    const body = authObject(JSON.parse(String(init?.body)));
    const personalizations = body.personalizations;
    assert.ok(Array.isArray(personalizations));
    const personalization = authObject(personalizations[0]);
    const recipients = personalization.to;
    assert.ok(Array.isArray(recipients));
    assert.equal(authObject(recipients[0]).email, 'member@example.test');
    const mailSettings = authObject(body.mail_settings);
    const sandbox = authObject(mailSettings.sandbox_mode);
    assert.equal(sandbox.enable, true);
    return new Response(null, { status: 202 });
  });
  await sandbox.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });

  const redirected = new SendgridVerificationSender({
    apiKey: 'synthetic-test-key',
    fromEmail: 'sender@example.test',
    appEnvironment: 'development',
    sandboxMode: false,
    testRecipientEmail: 'developer@example.test',
  }, async (_url, init) => {
    const body = authObject(JSON.parse(String(init?.body)));
    assert.deepEqual(body.personalizations, [{ to: [{ email: 'developer@example.test' }] }]);
    assert.equal(body.mail_settings, undefined);
    return new Response(null, { status: 202 });
  });
  await redirected.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 });

  for (const configuration of [
    { apiKey: 'synthetic-test-key', fromEmail: 'sender@example.test', appEnvironment: 'production', sandboxMode: true },
    { apiKey: 'synthetic-test-key', fromEmail: 'sender@example.test', appEnvironment: 'production', testRecipientEmail: 'developer@example.test' },
  ]) {
    const unsafe = new SendgridVerificationSender(configuration, async () => {
      assert.fail('Development routing must not call SendGrid outside development.');
    });
    await assert.rejects(unsafe.send({ email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 }), VerificationDeliveryError);
  }
});

test('provider failures and bad configuration produce generic errors without leaking provider details', async () => {
  const message = { email: 'member@example.test', token: 'a'.repeat(64), expiresAtMs: 50_000 };
  for (const status of [200, 302, 401, 429, 500]) {
    const sender = new SendgridVerificationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' },
      async () => new Response('provider detail must not leak', { status }));
    await assert.rejects(sender.send(message), error => error instanceof VerificationDeliveryError
      && error.message === 'Verification delivery unavailable.');
  }
  const sender = new SendgridVerificationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' },
    async () => { throw new Error('sensitive provider detail'); });
  await assert.rejects(sender.send(message), VerificationDeliveryError);
  for (const configuration of [
    { apiKey: undefined, fromEmail: 'sender@example.test' },
    { apiKey: 'synthetic-key', fromEmail: 'invalid' },
  ]) {
    const unconfigured = new SendgridVerificationSender(configuration, async () => {
      assert.fail('No network call is permitted for invalid configuration.');
    });
    await assert.rejects(unconfigured.send(message), VerificationDeliveryError);
  }
});
