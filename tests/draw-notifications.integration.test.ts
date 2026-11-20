import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { DrawNotificationsRepository } from '../src/persistence/draw-notifications-repository.ts';
import { EventLifecycleRepository } from '../src/persistence/event-lifecycle-repository.ts';
import { SessionsRepository } from '../src/persistence/sessions-repository.ts';
import { SessionService } from '../src/application/session-service.ts';
import { EventLifecycleService } from '../src/application/event-lifecycle-service.ts';
import { DrawNotificationService, type DrawNotificationStore } from '../src/application/draw-notification-service.ts';
import { loadRecipientKey } from '../src/infrastructure/recipient-key.ts';
import { notificationLeaseMs } from '../src/domain/draw-notifications.ts';
import { authObject } from '../src/domain/authentication.ts';
import { applyMigration } from './helpers/migrations.ts';

test('durable closure notifications enqueue atomically and recover fenced leases in D1/workerd', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-notifications-')); t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const origin = 'https://app.example.test'; let outbound = 0;
  const keys = { DRAW_KEY_ID: 'synthetic', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) };
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'notification-test', modules: true,
    script: await readFile(join(output, 'worker.js'), 'utf8'), compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: origin, ...keys, SENDGRID_API_KEY: 'synthetic-only', SENDGRID_FROM_EMAIL: 'sender@example.test' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
      const payload = authObject(await request.json()); assert.equal(payload.subject, 'Sorteo disponible en TocaRegalo');
      assert.ok(Array.isArray(payload.content)); const text = authObject(payload.content[0]).value;
      assert.ok(typeof text === 'string'); assert.match(text, /Inicia sesión/);
      assert.deepEqual(Object.keys(payload).sort(), ['content', 'from', 'personalizations', 'subject', 'tracking_settings']);
      outbound++; return new Response(null, { status: 202 });
    },
  }] }));
  t.after(() => mf.dispose()); const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql', '0008_event_creation_order.sql',
    '0009_group_invitations.sql', '0010_event_draw_lifecycle.sql', '0011_scheduled_event_processing.sql']) await applyMigration(db, name);
  const accounts = new AccountsRepository(db); const groups = new GroupsRepository(db); const store = new DrawNotificationsRepository(db);
  let now = 1000;
  const lifecycle = new EventLifecycleService(new EventLifecycleRepository(db), () => loadRecipientKey(keys), () => now);
  for (const id of ['owner', 'a', 'b']) await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
  const create = async (id: string) => {
    await groups.create('owner', { id, name: id, createdAtMs: 0 });
    for (const account of ['a', 'b']) await groups.addMember(id, 'owner', account, 0);
    await groups.createEvent('owner', { id, groupId: id, closureAtMs: null, createdAtMs: 0 }); return id;
  };
  const close = async (id: string) => { assert.equal((await lifecycle.execute('owner', id, true)).kind, 'ok'); };
  const row = (event: string, account = 'owner') => db.prepare(`SELECT status, failed_attempts AS attempts,
    lease_token AS token, available_at_ms AS availableAt FROM draw_notifications WHERE event_id = ? AND account_id = ?`)
    .bind(event, account).first<{ status: string; attempts: number; token: string | null; availableAt: number }>();
  const count = (event: string) => db.prepare('SELECT count(*) AS n FROM draw_notifications WHERE event_id = ?').bind(event).first<{ n: number }>();
  const delivered: string[] = [];
  const deliver = () => new DrawNotificationService(store, { async send(message) { delivered.push(message.eventId + ':' + message.email); } }, () => now).run();
  await create('historical'); await close('historical');
  await create('existing-open'); assert.equal((await lifecycle.execute('owner', 'existing-open')).kind, 'ok');
  await applyMigration(db, '0012_draw_notifications.sql');

  await t.test('upgrade sends no historical mail; only new closure queues one private notice per participant', async () => {
    assert.equal((await count('historical'))?.n, 0); assert.equal((await count('existing-open'))?.n, 0);
    await close('existing-open'); assert.equal((await count('existing-open'))?.n, 3);
    assert.equal((await lifecycle.execute('owner', 'existing-open', true)).kind, 'closed'); assert.equal((await count('existing-open'))?.n, 3);
    const columns = (await db.prepare('PRAGMA table_info(draw_notifications)').all<{ name: string }>()).results.map(c => c.name);
    for (const forbidden of ['email', 'recipient_id', 'recipient_name', 'password_hash']) assert.equal(columns.includes(forbidden), false);
    await deliver();
  });

  await t.test('enqueue failure rolls back closure, draw and every notification; successful close does not send synchronously', async () => {
    await create('rollback');
    await db.prepare(`CREATE TRIGGER reject_notice BEFORE INSERT ON draw_notifications WHEN NEW.event_id = 'rollback'
      BEGIN SELECT RAISE(ABORT, 'private queue failure'); END`).run();
    await assert.rejects(lifecycle.execute('owner', 'rollback', true));
    assert.equal((await lifecycle.state('owner', 'rollback'))?.closedAtMs, null); assert.equal((await count('rollback'))?.n, 0);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM draws WHERE event_id = ?').bind('rollback').first<{ n: number }>())?.n, 0);
    await db.prepare('DROP TRIGGER reject_notice').run();
    const session = await new SessionService(new SessionsRepository(db)).issueForVerifiedAccount('owner', 60000);
    const response = await mf.dispatchFetch(origin + '/api/events/rollback/close', { method: 'POST', headers: {
      Cookie: '__Host-tocaregalo_session=' + session.token, Origin: origin, 'X-CSRF-Token': session.csrfToken,
    } });
    assert.equal(response.status, 200); assert.equal(outbound, 0); assert.equal((await count('rollback'))?.n, 3);
    now = Date.now(); await deliver();
  });

  await t.test('simultaneous closes and processors cannot enqueue or send a notification twice while its lease is valid', async () => {
    await create('concurrent'); await Promise.all([lifecycle.execute('owner', 'concurrent', true), lifecycle.execute('owner', 'concurrent', true)]);
    assert.equal((await count('concurrent'))?.n, 3); const before = delivered.length;
    await Promise.all([deliver(), deliver()]); assert.equal(delivered.length - before, 3);
    assert.equal((await row('concurrent'))?.status, 'accepted'); await deliver(); assert.equal(delivered.length - before, 3);
  });

  await t.test('expired reservations recover and old tokens cannot acknowledge or fail a newer lease', async () => {
    await create('lease'); await close('lease'); const id = { eventId: 'lease', accountId: 'owner' };
    const first = await store.claim(id, 'first', now, now + notificationLeaseMs); assert.ok(first);
    assert.equal(await store.claim(id, 'second', now + notificationLeaseMs - 1, now + 2 * notificationLeaseMs), null);
    now += notificationLeaseMs;
    const second = await store.claim(id, 'second', now, now + notificationLeaseMs); assert.ok(second);
    await store.accept(first, now); await store.fail(first, 1, now + 60000, now);
    assert.equal((await row('lease'))?.token, 'second'); assert.equal((await row('lease'))?.attempts, 0);
    await store.accept(second, now); assert.equal((await row('lease'))?.status, 'accepted');
    const late = await store.claim({ eventId: 'lease', accountId: 'a' }, 'late-ack', now, now + notificationLeaseMs); assert.ok(late);
    now += notificationLeaseMs;
    // A late acknowledgement is still valid if no newer worker replaced its token.
    await store.accept(late, now); assert.equal((await row('lease', 'a'))?.status, 'accepted'); await deliver();
  });

  await t.test('removal cancels pending and leased notices, and rejoining does not reactivate a closed-event notice', async () => {
    await create('removed'); await close('removed');
    const leased = await store.claim({ eventId: 'removed', accountId: 'b' }, 'in-flight', now, now + notificationLeaseMs); assert.ok(leased);
    await groups.removeMember('removed', 'owner', 'a'); await groups.removeMember('removed', 'owner', 'b');
    assert.equal((await row('removed', 'a'))?.status, 'cancelled'); assert.equal((await row('removed', 'b'))?.status, 'cancelled');
    assert.equal(await store.message(leased, now), null); await store.accept(leased, now);
    assert.equal((await row('removed', 'b'))?.status, 'cancelled');
    await groups.addMember('removed', 'owner', 'a', now); assert.equal((await row('removed', 'a'))?.status, 'cancelled');
    const before = delivered.length; await deliver(); assert.deepEqual(delivered.slice(before), ['removed:owner@example.test']);
  });

  await t.test('known failures retry after 1, 2, 4, 8, 16 minutes then stop at six, across fresh services', async () => {
    await create('failures'); await close('failures');
    for (let attempt = 1; attempt <= 6; attempt++) {
      const report = await new DrawNotificationService(store, { async send() { throw new Error('Private provider error'); } }, () => now).run();
      assert.equal(report.failed, 3); assert.equal((await row('failures'))?.attempts, attempt);
      if (attempt < 6) {
        const next = now + 60000 * 2 ** (attempt - 1); assert.equal((await row('failures'))?.availableAt, next);
        assert.equal((await store.due(next - 1)).length, 0); now = next;
      }
    }
    assert.equal((await row('failures'))?.status, 'failed'); assert.equal((await store.due(now + 10000000)).length, 0);
  });

  await t.test('lost acceptance persistence preserves the lease and exposes the documented possible duplicate on recovery', async () => {
    await create('ambiguous'); await close('ambiguous'); let sends = 0;
    const failing: DrawNotificationStore = {
      due: (...args) => store.due(...args), claim: (...args) => store.claim(...args), message: (...args) => store.message(...args),
      fail: (...args) => store.fail(...args), async accept() { throw new Error('Database acknowledgement lost'); },
    };
    await assert.rejects(new DrawNotificationService(failing, { async send() { sends++; } }, () => now).run());
    assert.equal(sends, 1); const pending = await db.prepare(`SELECT account_id AS accountId FROM draw_notifications
      WHERE event_id = 'ambiguous' AND status = 'sending'`).first<{ accountId: string }>(); assert.ok(pending);
    assert.equal((await row('ambiguous', pending.accountId))?.attempts, 0);
    now += notificationLeaseMs;
    await new DrawNotificationService(store, { async send() { sends++; } }, () => now).run();
    assert.equal(sends, 4); assert.equal((await row('ambiguous', pending.accountId))?.status, 'accepted');
  });

  await t.test('native scheduled handler sends at most twenty notices per run, without exposing assignments or resending accepted mail', async () => {
    now = Date.now();
    await create('batch');
    for (let n = 0; n < 20; n++) {
      const id = 'batch-account-' + n; await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
      await groups.addMember('batch', 'owner', id, now);
    }
    await close('batch'); assert.equal((await count('batch'))?.n, 23);
    const worker = await mf.getWorker(); const before = outbound;
    assert.equal((await worker.scheduled({ cron: '* * * * *' })).outcome, 'ok'); assert.equal(outbound - before, 20);
    assert.equal((await worker.scheduled({ cron: '* * * * *' })).outcome, 'ok'); assert.equal(outbound - before, 23);
    await worker.scheduled({ cron: '* * * * *' }); assert.equal(outbound - before, 23);
    const plan = await db.prepare(`EXPLAIN QUERY PLAN SELECT event_id, account_id FROM draw_notifications
      WHERE status IN ('pending', 'sending') AND available_at_ms <= ? AND failed_attempts < 6
      ORDER BY available_at_ms, event_id, account_id LIMIT 20`).bind(now).all<{ detail: string }>();
    assert.equal(plan.results.some(r => r.detail.includes('draw_notifications_due')), true);
    assert.equal(plan.results.some(r => r.detail.includes('TEMP B-TREE')), false);
    await db.prepare('DELETE FROM events WHERE id = ?').bind('batch').run(); assert.equal((await count('batch'))?.n, 0);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  });
});
