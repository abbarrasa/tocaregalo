import type { PersistenceDatabase } from './d1.ts';
import { normalizedName, requireId, requireTimestamp } from '../domain/validation.ts';
import { normalizeEmail, AuthInputError } from '../domain/authentication.ts';
import type { ProfileUpdate } from '../domain/authentication.ts';
import { ProfileConflictError, type ProfileStore } from '../application/profile-service.ts';

export type Account = Readonly<{
  id: string; email: string; displayName: string; createdAtMs: number;
  lastName: string | null; phone: string | null;
  emailVerifiedAtMs: number | null;
}>;

// Provisioning only. Creating an account does not verify its email or authenticate it.
export class AccountsRepository implements ProfileStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async create(account: Omit<Account, 'lastName' | 'phone' | 'emailVerifiedAtMs'>): Promise<void> {
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
      last_name AS lastName, phone, email_verified_at_ms AS emailVerifiedAtMs
      FROM accounts WHERE id = ?`).bind(accountId).first<Account>();
  }

  async findCredential(accountId: string): Promise<{ passwordHash: string } | null> {
    return this.db.prepare(`SELECT password_hash AS passwordHash
      FROM password_credentials WHERE account_id = ?`).bind(accountId)
      .first<{ passwordHash: string }>();
  }

  async update(accountId: string, input: ProfileUpdate, passwordHash: string | null, nowMs: number): Promise<{
    id: string; email: string; displayName: string; lastName: string | null; phone: string | null;
    createdAtMs: number; emailVerifiedAtMs: number | null;
  }> {
    const current = await this.findSelf(accountId);
    if (!current) throw new RangeError('Account not found.');
    const emailChanged = current.email !== input.email;
    const statements = [
      this.db.prepare(`UPDATE accounts SET email = ?, display_name = ?, last_name = ?, phone = ?,
        email_verified_at_ms = CASE WHEN ? THEN NULL ELSE email_verified_at_ms END
        WHERE id = ?`)
        .bind(input.email, input.name, input.lastName, input.phone, emailChanged ? 1 : 0, accountId),
    ];
    if (passwordHash !== null) {
      statements.push(
        this.db.prepare(`INSERT INTO password_credentials
          (account_id, password_hash, created_at_ms, revision) VALUES (?, ?, ?, 1)
          ON CONFLICT(account_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            revision = password_credentials.revision + 1`)
          .bind(accountId, passwordHash, nowMs),
        this.db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId),
      );
    }
    if (emailChanged) {
      statements.push(
        this.db.prepare('UPDATE social_accounts SET email = ? WHERE account_id = ?').bind(input.email, accountId),
        this.db.prepare('DELETE FROM email_verifications WHERE account_id = ?').bind(accountId),
        this.db.prepare('DELETE FROM password_recoveries WHERE account_id = ?').bind(accountId),
      );
    }
    try {
      await this.db.batch(statements);
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed: accounts\.(email|phone)\b/.test(error.message)) {
        const fields: Record<string, string> = {};
        if (/accounts\.email\b/.test(error.message)) fields.email = 'Este correo electrónico ya está asociado a otra cuenta.';
        if (/accounts\.phone\b/.test(error.message)) fields.phone = 'Este teléfono ya está asociado a otra cuenta.';
        throw new ProfileConflictError(fields);
      }
      throw error;
    }
    const updated = await this.findSelf(accountId);
    if (!updated) throw new RangeError('Account update failed.');
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      lastName: updated.lastName,
      phone: updated.phone,
      createdAtMs: updated.createdAtMs,
      emailVerifiedAtMs: updated.emailVerifiedAtMs,
    };
  }
}
