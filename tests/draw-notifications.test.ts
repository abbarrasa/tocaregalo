import assert from 'node:assert/strict';
import test from 'node:test';
import { DrawNotificationService, type DrawNotificationStore } from '../src/application/draw-notification-service.ts';
import { SendgridDrawNotificationSender } from '../src/infrastructure/sendgrid-draw-notification-sender.ts';
import { authObject } from '../src/domain/authentication.ts';

test('notification adapter sends only a generic closed-event notice through the existing protected transport', async () => {
  const sender = new SendgridDrawNotificationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' }, async (url, options) => {
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send'); assert.equal(options?.redirect, 'manual');
    const body = authObject(JSON.parse(String(options?.body)));
    assert.deepEqual(body.personalizations, [{ to: [{ email: 'participant@example.test' }] }]);
    assert.equal(body.subject, 'Sorteo disponible en TocaRegalo');
    assert.ok(Array.isArray(body.content)); const text = authObject(body.content[0]).value;
    assert.ok(typeof text === 'string'); assert.match(text, /evento-1/); assert.match(text, /Inicia sesión/);
    assert.deepEqual(body.tracking_settings, { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } });
    return new Response(null, { status: 202 });
  });
  await sender.send({ eventId: 'evento-1', email: 'participant@example.test' });
});

test('failed sends use the existing six-failure policy and do not stop later notifications', async () => {
  const failures: Array<{ count: number; next: number | null }> = []; let accepted = 0;
  const store: DrawNotificationStore = {
    async due() { return [{ eventId: 'bad', accountId: 'a' }, { eventId: 'last', accountId: 'b' }, { eventId: 'good', accountId: 'c' }]; },
    async claim(id, token, now, expires) { assert.equal(now, 1000); assert.equal(expires, 121000); return { ...id, token, failedAttempts: id.eventId === 'last' ? 5 : 0 }; },
    async message(lease) { return { eventId: lease.eventId, email: 'participant@example.test' }; },
    async fail(_lease, count, next) { failures.push({ count, next }); },
    async accept() { accepted++; },
  };
  const result = await new DrawNotificationService(store, { async send(message) { if (message.eventId !== 'good') throw new Error('Private failure'); } }, () => 1000).run();
  assert.deepEqual(result, { accepted: 1, failed: 2, skipped: 0 }); assert.equal(accepted, 1);
  assert.deepEqual(failures, [{ count: 1, next: 61000 }, { count: 6, next: null }]);
});

test('lease and membership rechecks skip unavailable notifications without attempting delivery', async () => {
  const store: DrawNotificationStore = {
    async due() { return [{ eventId: 'claimed-elsewhere', accountId: 'a' }, { eventId: 'removed', accountId: 'b' }]; },
    async claim(id, token) { return id.accountId === 'a' ? null : { ...id, token, failedAttempts: 0 }; },
    async message() { return null; }, async accept() { assert.fail(); }, async fail() { assert.fail(); },
  };
  assert.deepEqual(await new DrawNotificationService(store, { async send() { assert.fail(); } }, () => 0).run(), { accepted: 0, failed: 0, skipped: 2 });
});

test('a provider acceptance followed by persistence failure is not reclassified as a failed send', async () => {
  const store: DrawNotificationStore = {
    async due() { return [{ eventId: 'event', accountId: 'a' }]; },
    async claim(id, token) { return { ...id, token, failedAttempts: 0 }; },
    async message() { return { eventId: 'event', email: 'a@example.test' }; },
    async accept() { throw new Error('Acknowledgement unavailable'); }, async fail() { assert.fail('Do not count an accepted send as failed'); },
  };
  await assert.rejects(new DrawNotificationService(store, { async send() {} }, () => 0).run(), /Acknowledgement unavailable/);
});
