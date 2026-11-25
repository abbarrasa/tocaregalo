import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { applyMigration } from './helpers/migrations.ts';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { EventLifecycleService } from '../src/application/event-lifecycle-service.ts';
import { EventLifecycleRepository } from '../src/persistence/event-lifecycle-repository.ts';
import { loadRecipientKey } from '../src/infrastructure/recipient-key.ts';

test('operational SQL reports only aggregate queue health without changing D1 state', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'operations-test', modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-11-19', d1Databases: ['DB'],
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
    await applyMigration(db, name);
  }
  const eventsSql = await readFile(new URL('../operations/event-health.sql', import.meta.url), 'utf8');
  const noticesSql = await readFile(new URL('../operations/notification-health.sql', import.meta.url), 'utf8');
  const eventHealth = async () => (await db.prepare(eventsSql).all<Record<string, number | string | null>>()).results;
  const noticeHealth = async () => (await db.prepare(noticesSql).all<Record<string, number | string | null>>()).results;
  assert.deepEqual(await eventHealth(), []); assert.deepEqual(await noticeHealth(), []);
  const accounts = new AccountsRepository(db); const groups = new GroupsRepository(db);
  for (let i = 0; i < 7; i++) await accounts.create({ id: 'a' + i, email: `a${i}@example.test`, displayName: 'Synthetic', createdAtMs: 0 });
  await groups.create('a0', { id: 'full', name: 'Synthetic', createdAtMs: 0 });
  await groups.create('a0', { id: 'small', name: 'Synthetic', createdAtMs: 0 });
  for (let i = 1; i < 7; i++) await groups.addMember('full', 'a0', 'a' + i, 0);
  await groups.addMember('small', 'a0', 'a1', 0);
  const future = Number.MAX_SAFE_INTEGER;
  for (const [id, groupId, closureAtMs] of [
    ['due', 'full', 1], ['retry', 'full', 1], ['future', 'full', future], ['small', 'small', 1], ['closed', 'full', null],
  ] as const) await groups.createEvent('a0', { id, groupId, closureAtMs, createdAtMs: 0 });
  await db.prepare("UPDATE event_processing_jobs SET retry_stage = 2, next_attempt_at_ms = ? WHERE event_id = 'retry'").bind(future).run();
  // Even an early retry timestamp cannot make a future closure runnable.
  await db.prepare("UPDATE event_processing_jobs SET next_attempt_at_ms = 0 WHERE event_id = 'future'").run();
  const lifecycle = new EventLifecycleService(new EventLifecycleRepository(db), () => loadRecipientKey({
    DRAW_KEY_ID: 'synthetic', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32),
  }), () => 1000);
  assert.equal((await lifecycle.execute('a0', 'closed', true)).kind, 'ok');
  await db.batch([
    db.prepare("UPDATE draw_notifications SET available_at_ms = ? WHERE account_id = 'a1'").bind(future),
    db.prepare("UPDATE draw_notifications SET status = 'sending', lease_token = 'synthetic-expired', available_at_ms = 1 WHERE account_id = 'a2'"),
    db.prepare("UPDATE draw_notifications SET status = 'sending', lease_token = 'synthetic-live', available_at_ms = ? WHERE account_id = 'a3'").bind(future),
    db.prepare("UPDATE draw_notifications SET status = 'accepted', accepted_at_ms = 1001 WHERE account_id = 'a4'"),
    db.prepare("UPDATE draw_notifications SET status = 'failed', failed_attempts = 6 WHERE account_id = 'a5'"),
    db.prepare("UPDATE draw_notifications SET status = 'cancelled' WHERE account_id = 'a6'"),
    db.prepare("INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms) VALUES ('due', 'redraw', 0)"),
  ]);
  await db.prepare("UPDATE events SET redraw_required = 1 WHERE id = 'due'").run();
  const snapshot = async () => (await db.batch([
    db.prepare('SELECT * FROM event_processing_jobs ORDER BY event_id, kind'),
    db.prepare('SELECT * FROM draw_notifications ORDER BY event_id, account_id'),
    db.prepare('SELECT * FROM events ORDER BY id'),
  ])).map(result => result.results);
  const before = await snapshot();
  const events = await eventHealth();
  assert.equal(events.length, 2);
  const close = events.find(row => row.kind === 'close'); assert.ok(close);
  assert.equal(close.queued, 4); assert.equal(close.runnable, 1);
  assert.equal(close.undersized, 1); assert.equal(close.backed_off, 1);
  assert.equal(typeof close.oldest_closure_delay_ms, 'number');
  const redraw = events.find(row => row.kind === 'redraw'); assert.ok(redraw);
  assert.equal(redraw.queued, 1); assert.equal(redraw.runnable, 1); assert.equal(redraw.oldest_closure_delay_ms, null);
  const notices = await noticeHealth(); assert.equal(notices.length, 5);
  const pending = notices.find(row => row.status === 'pending'); assert.ok(pending);
  assert.equal(pending.total, 2); assert.equal(pending.due, 1);
  const sending = notices.find(row => row.status === 'sending'); assert.ok(sending);
  assert.equal(sending.total, 2); assert.equal(sending.expired_leases, 1);
  assert.equal(notices.find(row => row.status === 'failed')?.maximum_known_failures, 6);
  for (const row of events) assert.deepEqual(Object.keys(row).sort(),
    ['backed_off', 'kind', 'oldest_closure_delay_ms', 'queued', 'runnable', 'undersized']);
  for (const row of notices) assert.deepEqual(Object.keys(row).sort(),
    ['due', 'expired_leases', 'maximum_known_failures', 'oldest_unsettled_age_ms', 'status', 'total']);
  // Compare stored rows, not D1 metadata whose timing changes on each read.
  const after = await snapshot();
  assert.deepEqual(after, before);
});
