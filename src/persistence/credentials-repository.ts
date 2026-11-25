import { RegistrationConflictError, type CredentialStore, type RegisteredAccount } from '../application/authentication-service.ts';
import type { PersistenceDatabase } from './d1.ts';

export class CredentialsRepository implements CredentialStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async create(account: RegisteredAccount, passwordHash: string): Promise<void> {
    try {
      await this.db.batch([
        this.db.prepare(`INSERT INTO accounts (id, email, display_name, last_name, phone, created_at_ms)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(account.id, account.email, account.displayName, account.lastName, account.phone, account.createdAtMs),
        this.db.prepare(`INSERT INTO password_credentials (account_id, password_hash, created_at_ms) VALUES (?, ?, ?)`)
          .bind(account.id, passwordHash, account.createdAtMs),
      ]);
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed: accounts\.(email|phone)\b/.test(error.message)) {
        const fields: Record<string, string> = {};
        if (/accounts\.email\b/.test(error.message)) fields.email = 'Este correo electrónico ya está asociado a otra cuenta.';
        if (/accounts\.phone\b/.test(error.message)) fields.phone = 'Este teléfono ya está asociado a otra cuenta.';
        throw new RegistrationConflictError(fields);
      }
      throw error;
    }
  }

  async findCredential(identifier: string) {
    return this.db.prepare(`SELECT a.id AS accountId, c.password_hash AS passwordHash
      FROM accounts a JOIN password_credentials c ON c.account_id = a.id
      WHERE a.email = ? OR a.phone = ?`).bind(identifier, identifier)
      .first<{ accountId: string; passwordHash: string }>();
  }
}
