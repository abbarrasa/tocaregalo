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

  async findProfile(accountId: string): Promise<{
    id: string; email: string; displayName: string; lastName: string | null; phone: string | null;
    createdAtMs: number; emailVerifiedAtMs: number | null;
  } | null> {
    return this.findSelf(accountId);
  }

  async findCredential(accountId: string): Promise<{ passwordHash: string; revision: number } | null> {
    return this.db.prepare(`SELECT password_hash AS passwordHash, revision
      FROM password_credentials WHERE account_id = ?`).bind(accountId)
      .first<{ passwordHash: string; revision: number }>();
  }

  async update(accountId: string, input: ProfileUpdate, passwordHash: string | null,
    credential: { passwordHash: string; revision: number } | null,
    previousEmail: string, nowMs: number): Promise<{
    id: string; email: string; displayName: string; lastName: string | null; phone: string | null;
    createdAtMs: number; emailVerifiedAtMs: number | null;
  }> {
    if (passwordHash !== null && credential === null) throw new RangeError('Credential snapshot required.');

    const statements = [];
    let credentialUpdateIndex = -1;
    if (passwordHash !== null && credential !== null) {
      credentialUpdateIndex = statements.length;
      statements.push(
        this.db.prepare(`UPDATE password_credentials
          SET password_hash = ?, revision = revision + 1
          WHERE account_id = ? AND password_hash = ? AND revision = ?
            AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = password_credentials.account_id AND a.email = ?)
          RETURNING account_id`)
          .bind(passwordHash, accountId, credential.passwordHash, credential.revision, previousEmail),
      );
    }

    const currencyGuard = passwordHash !== null && credential !== null
      ? ` AND EXISTS (SELECT 1 FROM password_credentials pc
          WHERE pc.account_id = accounts.id
            AND pc.password_hash = ?
            AND pc.revision = ?)`
      : '';

    const accountBinds: (string | number | null)[] = [
      input.email, input.name, input.lastName, input.phone, input.email, accountId, previousEmail,
    ];
    if (passwordHash !== null && credential !== null) {
      accountBinds.push(passwordHash, credential.revision + 1);
    }
    statements.push(
      this.db.prepare(`UPDATE accounts SET email = ?, display_name = ?, last_name = ?, phone = ?,
        email_verified_at_ms = CASE WHEN email <> ? THEN NULL ELSE email_verified_at_ms END
        WHERE id = ? AND email = ?${currencyGuard}
        RETURNING id`)
        .bind(...accountBinds),
    );

    if (passwordHash !== null && credential !== null) {
      statements.push(
        this.db.prepare(`DELETE FROM sessions WHERE account_id = ?
          AND EXISTS (SELECT 1 FROM password_credentials pc
            WHERE pc.account_id = ? AND pc.password_hash = ? AND pc.revision = ?)`)
          .bind(accountId, accountId, passwordHash, credential.revision + 1),
      );
    }
    const credentialSuffix = passwordHash !== null && credential !== null
      ? ' AND EXISTS (SELECT 1 FROM password_credentials pc WHERE pc.account_id = ? AND pc.password_hash = ? AND pc.revision = ?)'
      : '';
    const credentialArgs: (string | number)[] = passwordHash !== null && credential !== null
      ? [accountId, passwordHash, credential.revision + 1]
      : [];
    statements.push(
      this.db.prepare(`UPDATE social_accounts SET email = ?
        WHERE account_id = ? AND email = ? AND EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.id = social_accounts.account_id AND a.email = ?${credentialSuffix}
        )`).bind(input.email, accountId, previousEmail, input.email, ...credentialArgs),
      this.db.prepare(`DELETE FROM email_verifications
        WHERE account_id = ? AND EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.id = email_verifications.account_id AND a.email = ? AND ? <> ?
        )${credentialSuffix}`).bind(accountId, input.email, input.email, previousEmail, ...credentialArgs),
      this.db.prepare(`DELETE FROM password_recoveries
        WHERE account_id = ? AND EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.id = password_recoveries.account_id AND a.email = ? AND ? <> ?
        )${credentialSuffix}`).bind(accountId, input.email, input.email, previousEmail, ...credentialArgs),
    );
    try {
      const result = await this.db.batch(statements);
      const accountResultIndex = credentialUpdateIndex >= 0 ? credentialUpdateIndex + 1 : 0;
      if (result[accountResultIndex]?.results.length !== 1) {
        throw new ProfileConflictError({
          email: 'Los datos de la cuenta cambiaron mientras se procesaba la solicitud.',
        });
      }
      if (passwordHash !== null && credential !== null) {
        if (credentialUpdateIndex < 0 || result[credentialUpdateIndex].results.length !== 1) {
          throw new ProfileConflictError({
            currentPassword: 'La contraseña cambió mientras se procesaba la solicitud. Repite el cambio con la contraseña actual.',
          });
        }
      }
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
