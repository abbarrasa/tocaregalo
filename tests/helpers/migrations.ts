import { readFile } from 'node:fs/promises';
import type { PersistenceDatabase } from '../../src/persistence/d1.ts';

// Legacy migrations are plain DDL. New multi-statement trigger migrations use
// explicit block delimiters so embedded semicolons remain inside their statement.
export async function applyMigration(db: PersistenceDatabase, name: string): Promise<void> {
  const sql = await readFile(new URL('../../migrations/' + name, import.meta.url), 'utf8');
  const delimiter = /^-- statement-breakpoint\s*$/m;
  if (/\bCREATE\s+TRIGGER\b/i.test(sql) && !delimiter.test(sql)) {
    throw new Error('Trigger migrations require explicit statement breakpoints.');
  }
  const statements = (delimiter.test(sql) ? sql.split(delimiter) : sql.split(';')).map(s => s.trim()).filter(Boolean);
  await db.batch(statements.map(s => db.prepare(s)));
}
