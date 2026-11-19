import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { DrawRepository } from '../src/persistence/draw-repository.ts';
import { decryptRecipient } from '../src/domain/recipient-protection.ts';
import type { D1Statement, D1Value } from '../src/persistence/d1.ts';

// Execute the repository's actual SQL against SQLite, with D1 BLOB serialization.
class Statement implements D1Statement {
  values: D1Value[] = [];
  readonly db: DatabaseSync;
  readonly sql: string;
  constructor(db: DatabaseSync, sql: string) { this.db = db; this.sql = sql; }
  bind(...values: D1Value[]) { this.values = values; return this; }
  parameters() {
    return this.values.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v);
  }
  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.parameters());
    if (!row) return null;
    return Object.fromEntries(Object.entries(row).map(([k, v]) =>
      [k, v instanceof Uint8Array ? [...v] : v])) as T;
  }
}

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0001_draws.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO events VALUES (?, ?, ?)').run('event', 1000, 0);
  const repository = new DrawRepository({
    prepare: sql => new Statement(db, sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = (statements as Statement[]).map(statement => ({
          success: true, results: db.prepare(statement.sql).all(...statement.parameters()),
        }));
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  });
  return { db, repository };
}

async function key() {
  return {
    id: 'v1',
    cipher: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    index: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
}
const draw = {
  id: 'draw', eventId: 'event', createdAtMs: 1000,
  assignments: [
    { giverId: 'owner', recipientId: 'a' },
    { giverId: 'a', recipientId: 'b' },
    { giverId: 'b', recipientId: 'owner' },
  ],
};

test('migration and repository preserve encrypted assignments and reject replacement', async t => {
  const { db, repository } = fixture();
  t.after(() => db.close());
  const current = await key();
  await repository.save(draw, current);
  assert.deepEqual(await repository.findByEvent('event'), { id: 'draw', createdAtMs: 1000 });
  const envelope = await repository.findRecipient('draw', 'owner');
  assert.ok(envelope);
  assert.equal(await decryptRecipient(new Map([[current.id, current]]),
    { drawId: 'draw', giverId: 'owner' }, envelope), 'a');
  await assert.rejects(repository.save({ ...draw, id: 'another' }, current));
  assert.equal(db.prepare('SELECT count(*) AS n FROM assignments').get()?.n, 3);
  assert.equal(await repository.findRecipient('draw', 'unknown'), null);
  assert.equal(await repository.findByEvent('unknown'), null);
  db.prepare('DELETE FROM events WHERE id = ?').run('event');
  assert.equal(db.prepare('SELECT count(*) AS n FROM assignments').get()?.n, 0);
});

test('a failure midway through a batch leaves no partial draw', async t => {
  const { db, repository } = fixture();
  t.after(() => db.close());
  db.exec(`CREATE TRIGGER fail_assignment BEFORE INSERT ON assignments
    WHEN NEW.giver_id = 'a' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`);
  await assert.rejects(repository.save(draw, await key()));
  for (const table of ['draws', 'draw_participants', 'assignments']) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n, 0);
  }
});

test('invalid snapshots and missing event references cannot be persisted', async t => {
  const { db, repository } = fixture();
  t.after(() => db.close());
  const current = await key();
  await assert.rejects(repository.save({ ...draw, assignments: draw.assignments.slice(1) }, current), RangeError);
  await assert.rejects(repository.save({ ...draw, eventId: 'missing' }, current));
  assert.equal(await repository.findByEvent('event'), null);
});
