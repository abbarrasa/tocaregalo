import type { PersistenceDatabase } from './d1.ts';
import { normalizedName, requireId, requireTimestamp } from '../domain/validation.ts';

export type Account = Readonly<{
  id: string; email: string; displayName: string; createdAtMs: number;
}>;

// Provisioning only. Creating an account does not verify its email or authenticate it.
export class AccountsRepository {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async create(account: Account): Promise<void> {
    requireId(account.id);
    requireTimestamp(account.createdAtMs);
    const email = account.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RangeError('Invalid email.');
    }
    await this.db.batch([this.db.prepare(
      'INSERT INTO accounts (id, email, display_name, created_at_ms) VALUES (?, ?, ?, ?)',
    ).bind(account.id, email, normalizedName(account.displayName), account.createdAtMs)]);
  }

  // accountId must come from a verified session, never from an unchecked request field.
  async findSelf(accountId: string): Promise<Account | null> {
    return this.db.prepare(`SELECT id, email, display_name AS displayName, created_at_ms AS createdAtMs
      FROM accounts WHERE id = ?`).bind(accountId).first<Account>();
  }
}
