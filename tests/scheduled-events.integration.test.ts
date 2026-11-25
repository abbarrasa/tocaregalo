import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { AccountsRepository } from '../src/persistence/accounts-repository.ts';
import { GroupsRepository } from '../src/persistence/groups-repository.ts';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { EventLifecycleRepository } from '../src/persistence/event-lifecycle-repository.ts';
import { EventProcessingRepository } from '../src/persistence/event-processing-repository.ts';
import { EventLifecycleService, type EventLifecycleStore } from '../src/application/event-lifecycle-service.ts';
import { ScheduledEventService } from '../src/application/scheduled-event-service.ts';
import { loadRecipientDecryptionKey, loadRecipientKey } from '../src/infrastructure/recipient-key.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import { applyMigration } from './helpers/migrations.ts';

test('scheduled Worker processing recovers D1 work in bounded, concurrent-safe batches', async t => {
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-scheduled-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  const keys = { DRAW_KEY_ID: 'synthetic', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) };
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'scheduled-test', modules: true,
    script: await readFile(join(output, 'worker.js'), 'utf8'), compatibilityDate: '2026-11-19', d1Databases: ['DB'],
    bindings: { APP_ORIGIN: 'https://app.example.test', ...keys,
      RESEND_API_KEY: 'synthetic-only', RESEND_FROM_EMAIL: 'sender@example.test', APP_ENV: 'development', RESEND_TEST_MODE: 'false' },
    outboundService: async request => {
      assert.equal(new URL(request.url).hostname, 'api.resend.com');
      return new Response(null, { status: 202 });
    },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of ['0001_draws.sql', '0002_accounts_groups.sql', '0003_sessions.sql', '0004_public_auth.sql',
    '0005_email_verification.sql', '0006_password_recovery.sql', '0007_event_listing_index.sql',
    '0008_event_creation_order.sql', '0009_group_invitations.sql', '0010_event_draw_lifecycle.sql']) await applyMigration(db, name);
  const accounts = new AccountsRepository(db); const groups = new GroupsRepository(db);
  const draws = new DrawRepository(db); const lifecycleStore = new EventLifecycleRepository(db);
  const processing = new EventProcessingRepository(db);
  let nowMs = 1000;
  const lifecycle = new EventLifecycleService(lifecycleStore, () => loadRecipientKey(keys), () => nowMs);
  const run = () => new ScheduledEventService(new EventProcessingRepository(db), lifecycle, () => nowMs).run();
  for (const id of ['owner', 'a', 'b', 'c']) await accounts.create({ id, email: id + '@example.test', displayName: id, createdAtMs: 0 });
  const group = async (id: string, size = 3) => {
    await groups.create('owner', { id, name: id, createdAtMs: 0 });
    for (const member of ['a', 'b', 'c'].slice(0, size - 1)) await groups.addMember(id, 'owner', member, 0);
  };
  const event = async (id: string, groupId: string, closureAtMs: number | null) => {
    await groups.createEvent('owner', { id, groupId, closureAtMs, createdAtMs: 0 }); return id;
  };
  const state = (id: string) => lifecycle.state('owner', id);
  const count = async (id: string) => (await db.prepare('SELECT count(*) AS n FROM draws WHERE event_id = ?').bind(id).first<{ n: number }>())?.n;
  const job = (id: string, kind = 'close') => db.prepare('SELECT version, retry_stage AS retryStage, next_attempt_at_ms AS nextAt FROM event_processing_jobs WHERE event_id = ? AND kind = ?')
    .bind(id, kind).first<{ version: number; retryStage: number; nextAt: number }>();
  await group('upgrade', 4); await event('upgrade-event', 'upgrade', 1000);
  assert.equal((await lifecycle.execute('owner', 'upgrade-event')).kind, 'ok');
  const original = await state('upgrade-event'); assert.ok(original?.drawId);
  const originalDrawId = original.drawId;
  const encrypted = await draws.findRecipient(originalDrawId, 'owner'); assert.ok(encrypted);
  await groups.removeMember('upgrade', 'owner', 'c');
  await db.prepare('INSERT INTO events (id, closure_at_ms, created_at_ms) VALUES (?, ?, 0)').bind('unlinked', 1000).run();
  await applyMigration(db, '0011_scheduled_event_processing.sql');
  await applyMigration(db, '0012_draw_notifications.sql');

  await t.test('upgrade preserves dates and ciphertext and queues only linked open work with an indexed due order', async () => {
    assert.deepEqual(await draws.findRecipient(originalDrawId, 'owner'), encrypted);
    const readKey = await loadRecipientDecryptionKey(keys, encrypted.keyId);
    assert.ok(await decryptRecipient(new Map([[readKey.id, readKey]]), { drawId: originalDrawId, giverId: 'owner' }, encrypted));
    assert.equal((await groups.findEventForAccount('upgrade-event', 'owner'))?.createdAtMs, 0);
    assert.ok(await job('upgrade-event')); assert.ok(await job('upgrade-event', 'redraw')); assert.equal(await job('unlinked'), null);
    const plan = await db.prepare(`EXPLAIN QUERY PLAN SELECT j.event_id FROM event_processing_jobs j
      JOIN events e ON e.id = j.event_id JOIN groups g ON g.id = e.group_id
      WHERE j.kind = ? AND j.next_attempt_at_ms <= ? AND e.closed_at_ms IS NULL
      AND e.closure_at_ms IS NOT NULL AND e.closure_at_ms <= ?
      AND EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = e.group_id LIMIT 1 OFFSET 2)
      ORDER BY j.next_attempt_at_ms, j.event_id LIMIT 20`).bind('close', nowMs, nowMs).all<{ detail: string }>();
    assert.equal(plan.results.some(row => row.detail.includes('event_processing_due')), true);
    assert.equal(plan.results.some(row => row.detail.includes('TEMP B-TREE')), false);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  });

  await t.test('inclusive due time closes eligible events, skips null/future/undersized events and recovers on a later join', async () => {
    for (const name of ['boundary', 'future', 'unscheduled']) await group(name);
    await group('undersized', 2);
    await event('boundary-event', 'boundary', 1000); await event('future-event', 'future', 1001);
    await event('unscheduled-event', 'unscheduled', null); await event('undersized-event', 'undersized', 1000);
    nowMs = 999; await run(); assert.equal((await state('boundary-event'))?.status, 'pending');
    nowMs = 1000; await run(); assert.equal((await state('boundary-event'))?.status, 'closed');
    assert.equal((await state('upgrade-event'))?.status, 'closed');
    assert.equal((await state('future-event'))?.closedAtMs, null); assert.equal((await state('unscheduled-event'))?.closedAtMs, null);
    assert.equal((await state('undersized-event'))?.closedAtMs, null); assert.equal(await count('undersized-event'), 0);
    await groups.addMember('undersized', 'owner', 'b', 1000);
    await run(); assert.equal((await state('undersized-event'))?.status, 'closed');
    nowMs = 1001; await run(); assert.equal((await state('future-event'))?.status, 'closed');
  });

  await t.test('a schedule changed during encryption or existing-draw closing is checked again in SQL', async () => {
    for (const mode of ['publish', 'close']) {
      await group('reschedule-' + mode); const id = await event('reschedule-' + mode, 'reschedule-' + mode, 1000);
      if (mode === 'close') assert.equal((await lifecycle.execute('owner', id)).kind, 'ok');
      let once = true;
      const change = async () => {
        if (once) { once = false; await db.prepare('UPDATE events SET closure_at_ms = ? WHERE id = ?').bind(2000, id).run(); }
      };
      const racing: EventLifecycleStore = {
        snapshot: (...args) => lifecycleStore.snapshot(...args), pendingRedraws: (...args) => lifecycleStore.pendingRedraws(...args),
        async publish(...args) { if (mode === 'publish') await change(); return lifecycleStore.publish(...args); },
        async close(...args) { if (mode === 'close') await change(); return lifecycleStore.close(...args); },
      };
      const result = await new EventLifecycleService(racing, () => loadRecipientKey(keys), () => 1000).closeScheduled('owner', id, 1000);
      assert.equal(result.kind, 'not-due'); assert.equal((await state(id))?.closedAtMs, null);
      assert.equal(await count(id), mode === 'close' ? 1 : 0); assert.equal((await job(id))?.nextAt, 2000);
      // The authenticated owner's manual close still permits early closure.
      assert.equal((await lifecycle.execute('owner', id, true)).kind, 'ok'); assert.equal(await job(id), null);
    }
  });

  await t.test('pending removals redraw without closing and unchanged completed work is not rerolled', async () => {
    await group('redraw', 4); await event('redraw-event', 'redraw', null);
    assert.equal((await lifecycle.execute('owner', 'redraw-event')).kind, 'ok'); const before = await state('redraw-event');
    await groups.removeMember('redraw', 'owner', 'c'); assert.ok(await job('redraw-event', 'redraw'));
    await run(); const after = await state('redraw-event'); assert.equal(after?.status, 'ready'); assert.notEqual(after?.drawId, before?.drawId);
    assert.equal(after?.closedAtMs, null); assert.equal(await job('redraw-event', 'redraw'), null);
    await run(); assert.deepEqual(await state('redraw-event'), after);
    // Additions alone never create an automatic redraw job.
    await groups.addMember('redraw', 'owner', 'c', 1002); await run(); assert.equal((await state('redraw-event'))?.status, 'pending');
    assert.equal(await job('redraw-event', 'redraw'), null);
  });

  await t.test('each execution processes at most twenty closes and twenty redraws, preserving later work', async () => {
    await group('close-batch'); await group('redraw-batch', 4);
    for (let n = 0; n < 23; n++) {
      await event('close-batch-' + n, 'close-batch', 3000);
      const id = await event('redraw-batch-' + n, 'redraw-batch', null);
      assert.equal((await lifecycle.execute('owner', id)).kind, 'ok');
    }
    await groups.removeMember('redraw-batch', 'owner', 'c'); nowMs = 3000;
    assert.deepEqual(await run(), { closed: 20, redrawn: 20, deferred: 0, failed: 0 });
    const completed = await state('redraw-batch-0'); assert.equal(completed?.status, 'ready');
    assert.deepEqual(await run(), { closed: 3, redrawn: 3, deferred: 0, failed: 0 });
    assert.deepEqual(await state('redraw-batch-0'), completed);
    assert.equal((await processing.due('close', nowMs)).length, 0); assert.equal((await processing.due('redraw', nowMs)).length, 0);
  });

  await t.test('failed publication rolls back, persists backoff across service restarts and does not block another event', async () => {
    await group('failure'); await event('failure-bad', 'failure', 4000); await event('failure-good', 'failure', 4000);
    await db.prepare(`CREATE TRIGGER fail_scheduled_assignment BEFORE INSERT ON assignments
      WHEN EXISTS (SELECT 1 FROM draws WHERE id = NEW.draw_id AND event_id = 'failure-bad')
      BEGIN SELECT RAISE(ABORT, 'private injected error'); END`).run();
    nowMs = 4000; const report = await run(); assert.equal(report.failed, 1); assert.equal(report.closed, 1);
    assert.equal((await state('failure-good'))?.status, 'closed'); assert.equal(await count('failure-bad'), 0);
    assert.equal((await job('failure-bad'))?.retryStage, 1); assert.equal((await job('failure-bad'))?.nextAt, 64000);
    nowMs = 63999; assert.equal((await run()).failed, 0);
    nowMs = 64000; assert.equal((await run()).failed, 1); assert.equal((await job('failure-bad'))?.retryStage, 2);
    assert.equal((await job('failure-bad'))?.nextAt, 184000);
    await db.prepare('DROP TRIGGER fail_scheduled_assignment').run();
    nowMs = 184000; assert.equal((await run()).closed, 1); assert.equal(await count('failure-bad'), 1); assert.equal(await job('failure-bad'), null);
  });

  await t.test('overlapping and stale failures cannot postpone completed or newer membership work', async () => {
    await group('fence'); await event('fence-event', 'fence', 5000); nowMs = 5000;
    const selected = (await processing.due('close', nowMs)).find(j => j.eventId === 'fence-event'); assert.ok(selected);
    await Promise.all([processing.defer(selected, 1, 65000), processing.defer(selected, 1, 65000)]);
    assert.equal((await job('fence-event'))?.version, selected.version + 1);
    await groups.addMember('fence', 'owner', 'c', 5000);
    const reset = await job('fence-event'); assert.equal(reset?.retryStage, 0); assert.equal(reset?.nextAt, 5000);
    await processing.defer(selected, 5, 999999); assert.deepEqual(await job('fence-event'), reset);
    const fresh = (await processing.due('close', nowMs)).find(j => j.eventId === 'fence-event'); assert.ok(fresh);
    assert.equal((await lifecycle.execute('owner', 'fence-event', true)).kind, 'ok');
    await processing.defer(fresh, 5, 999999); assert.equal(await job('fence-event'), null);
    await group('fence-redraw', 4); await event('fence-redraw-event', 'fence-redraw', null);
    assert.equal((await lifecycle.execute('owner', 'fence-redraw-event')).kind, 'ok');
    await groups.removeMember('fence-redraw', 'owner', 'c');
    const old = (await processing.due('redraw', nowMs)).find(j => j.eventId === 'fence-redraw-event'); assert.ok(old);
    assert.equal((await lifecycle.execute('owner', 'fence-redraw-event')).kind, 'ok');
    await groups.addMember('fence-redraw', 'owner', 'c', 5001); await groups.removeMember('fence-redraw', 'owner', 'c');
    const newer = await job('fence-redraw-event', 'redraw');
    await processing.defer(old, 5, 999999); assert.deepEqual(await job('fence-redraw-event', 'redraw'), newer);
    await run();
  });

  await t.test('concurrent cron processing and manual closure commit one complete immutable draw', async () => {
    await group('concurrent'); await event('concurrent-event', 'concurrent', 10000); nowMs = 10000;
    await Promise.all([run(), run(), lifecycle.execute('owner', 'concurrent-event', true)]);
    const closed = await state('concurrent-event'); assert.equal(closed?.status, 'closed'); assert.equal(await count('concurrent-event'), 1);
    assert.equal(await job('concurrent-event'), null);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM assignments WHERE draw_id = ?').bind(closed?.drawId).first<{ n: number }>())?.n, 3);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  });

  await t.test('membership failures roll back queued work and event/group deletion cascades through jobs', async () => {
    await group('rollback-jobs', 4); await event('rollback-jobs-event', 'rollback-jobs', 20000); nowMs = 20000;
    const selected = (await processing.due('close', nowMs)).find(j => j.eventId === 'rollback-jobs-event'); assert.ok(selected);
    await processing.defer(selected, 2, 140000); const before = await job('rollback-jobs-event');
    await db.prepare(`CREATE TRIGGER reject_processing_revision BEFORE UPDATE OF membership_revision ON groups
      WHEN OLD.id = 'rollback-jobs' BEGIN SELECT RAISE(ABORT, 'private revision failure'); END`).run();
    await assert.rejects(groups.removeMember('rollback-jobs', 'owner', 'c'));
    assert.ok(await groups.findForAccount('rollback-jobs', 'c'));
    assert.deepEqual(await job('rollback-jobs-event'), before); assert.equal(await job('rollback-jobs-event', 'redraw'), null);
    await db.prepare('DROP TRIGGER reject_processing_revision').run();
    await db.prepare('DELETE FROM events WHERE id = ?').bind('rollback-jobs-event').run();
    assert.equal(await job('rollback-jobs-event'), null);
    await event('cascade-jobs-event', 'rollback-jobs', 20000);
    await groups.removeMember('rollback-jobs', 'owner', 'c'); assert.ok(await job('cascade-jobs-event', 'redraw'));
    await db.prepare('DELETE FROM groups WHERE id = ?').bind('rollback-jobs').run();
    assert.equal(await job('cascade-jobs-event'), null); assert.equal(await job('cascade-jobs-event', 'redraw'), null);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  });

  await t.test('the actual bundled scheduled handler closes without browser traffic and ignores a future trigger timestamp', async () => {
    await group('worker'); await event('worker-due', 'worker', Date.now() - 1000);
    await event('worker-future', 'worker', Date.now() + 86400000);
    const worker = await mf.getWorker();
    const result = await worker.scheduled({ scheduledTime: new Date(Date.now() + 2 * 86400000), cron: '* * * * *' });
    assert.equal(result.outcome, 'ok'); assert.equal((await state('worker-due'))?.status, 'closed');
    assert.equal((await state('worker-future'))?.closedAtMs, null);
    const repeated = await worker.scheduled({ cron: '* * * * *' }); assert.equal(repeated.outcome, 'ok');
    assert.equal(await count('worker-due'), 1);
    assert.equal((await mf.dispatchFetch('https://app.example.test/api/internal/process-events', { method: 'POST' })).status, 404);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').first<{ n: number }>())?.n, 0);
  });
});
