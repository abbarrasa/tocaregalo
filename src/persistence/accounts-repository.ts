import type { PersistenceDatabase } from './d1.ts';
import { normalizedName, requireId, requireTimestamp } from '../domain/validation.ts';
import { normalizeEmail, AuthInputError } from '../domain/authentication.ts';

export type Account = Readonly<{
  id: string; email: string; displayName: string; createdAtMs: number;
  lastName: string | null; phone: string | null;
}>;

// Provisioning only. Creating an account does not verify its email or authenticate it.
export class AccountsRepository {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async create(account: Omit<Account, 'lastName' | 'phone'>): Promise<void> {
    requireId(account.id);
    requireTimestamp(account.createdAtMs);
    let email: string;
    try { email = normalizeEmail(account.email); } catch (error) {
      if (error instanceof AuthInputError) throw new RangeError('Invalid email.');
      throw error;
    }
    await this.db.batch([this.db.prepare(
      'INSERT INTO accounts (id, email, display_name, created_at_ms) VALUES (?, ?, ?, ?)',
    ).bind(account.id, email, normalizedName(account.displayName), account.createdAtMs)]);
  }

  // accountId must come from a verified session, never from an unchecked request field.
  async findSelf(accountId: string): Promise<Account | null> {
    return this.db.prepare(`SELECT id, email, display_name AS displayName, created_at_ms AS createdAtMs,
      last_name AS lastName, phone
      FROM accounts WHERE id = ?`).bind(accountId).first<Account>();
  }
}
