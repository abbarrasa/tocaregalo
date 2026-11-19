import type { DrawDatabase } from './d1.ts';

export type Account = Readonly<{
  id: string; email: string; displayName: string; createdAtMs: number;
}>;

export function requireId(id: string): void {
  if (!id.trim()) throw new RangeError('An ID is required.');
}

export function requireTimestamp(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError('Invalid timestamp.');
}

export function normalizedName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 100) throw new RangeError('Invalid name.');
  return name;
}

// Provisioning only. Creating an account does not verify its email or authenticate it.
export class AccountsRepository {
  private readonly db: DrawDatabase;
  constructor(db: DrawDatabase) { this.db = db; }

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
