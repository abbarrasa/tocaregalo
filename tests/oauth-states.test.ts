import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { OAuthStatesRepository } from '../src/persistence/oauth-states-repository.ts';
import type { D1Statement, D1Value, PersistenceDatabase } from '../src/persistence/d1.ts';

class Statement implements D1Statement {
  private values: D1Value[] = [];
  private readonly db: DatabaseSync;
  readonly sql: string;
  constructor(db: DatabaseSync, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...values: D1Value[]) { this.values = values; return this; }
  private parameters(): (string | number | null | Uint8Array)[] {
    return this.values.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
  }
  execute(): void { this.db.prepare(this.sql).run(...this.parameters()); }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.parameters()) as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.parameters()) as T[] };
  }
}

function fixture(): { db: DatabaseSync; repository: OAuthStatesRepository } {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL
  )`);
  const database: PersistenceDatabase = {
    prepare: sql => new Statement(db, sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        for (const statement of statements as Statement[]) {
          statement.execute();
        }
        db.exec('COMMIT');
        return [];
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, repository: new OAuthStatesRepository(database) };
}

test('OAuth state insertion removes a bounded batch of expired states', async t => {
  const { db, repository } = fixture();
  t.after(() => db.close());
  const insert = db.prepare('INSERT INTO oauth_states VALUES (?, ?, ?, ?)');
  for (let index = 0; index < 101; index += 1) {
    insert.run(`expired-${index}`, 'google', 0, 100);
  }
  insert.run('live', 'google', 0, 200);

  await repository.insert('new', 'google', 100, 600);

  assert.equal(db.prepare('SELECT count(*) AS count FROM oauth_states').get()?.count, 3);
  assert.equal(db.prepare('SELECT count(*) AS count FROM oauth_states WHERE expires_at_ms <= 100').get()?.count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM oauth_states WHERE state_hash = ?').get('new')?.count, 1);
});
