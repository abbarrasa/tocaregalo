import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';

test('D1 binding persists ciphertext, enforces uniqueness and rolls back failed batches', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'test',
    modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-11-19',
    d1Databases: ['DB'],
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  // This initial migration contains plain DDL only, with no embedded semicolons.
  const sql = await readFile(new URL('../migrations/0001_draws.sql', import.meta.url), 'utf8');
  await db.batch(sql.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  await db.prepare('INSERT INTO events VALUES (?, ?, ?)').bind('event', 1000, 0).run();
  const repository = new DrawRepository(db);
  const key = {
    id: 'v1',
    cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
  const draw = {
    id: 'draw', eventId: 'event', createdAtMs: 1000,
    assignments: [
      { giverId: 'owner', recipientId: 'a' },
      { giverId: 'a', recipientId: 'b' },
      { giverId: 'b', recipientId: 'owner' },
    ],
  };
  await repository.save(draw, key);
  const envelope = await repository.findRecipient('draw', 'owner');
  assert.ok(envelope);
  assert.equal(await decryptRecipient(new Map([[key.id, key]]),
    { drawId: 'draw', giverId: 'owner' }, envelope), 'a');
  await assert.rejects(repository.save({ ...draw, id: 'replacement' }, key));
  assert.deepEqual(await repository.findByEvent('event'), { id: 'draw', createdAtMs: 1000 });
  await db.prepare('INSERT INTO events VALUES (?, ?, ?)').bind('failed-event', null, 0).run();
  await db.prepare(`CREATE TRIGGER fail_assignment BEFORE INSERT ON assignments
    WHEN NEW.draw_id = 'failed-draw' AND NEW.giver_id = 'a'
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END`).run();
  await assert.rejects(repository.save({ ...draw, id: 'failed-draw', eventId: 'failed-event' }, key));
  assert.equal(await repository.findByEvent('failed-event'), null);
  assert.equal(await repository.findRecipient('failed-draw', 'owner'), null);
  assert.equal(await db.prepare('SELECT count(*) AS n FROM draw_participants WHERE draw_id = ?')
    .bind('failed-draw').first('n'), 0);
  await db.prepare('DELETE FROM events WHERE id = ?').bind('event').run();
  assert.equal(await repository.findRecipient('draw', 'owner'), null);
});
