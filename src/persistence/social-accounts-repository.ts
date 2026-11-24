import type { RegisteredAccount } from '../application/authentication-service.ts';
import type { SocialIdentityStore } from '../application/social-auth-service.ts';
import { normalizeEmail, AuthInputError } from '../domain/authentication.ts';
import { normalizedName } from '../domain/validation.ts';
import type { PersistenceDatabase } from './d1.ts';

export class SocialAccountsRepository implements SocialIdentityStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async resolve(input: {
    provider: 'google';
    subject: string;
    email: string;
    displayName: string;
    linkedAtMs: number;
  }): Promise<RegisteredAccount> {
    let email: string;
    let displayName: string;
    try {
      email = normalizeEmail(input.email);
      displayName = normalizedName(input.displayName);
    } catch (error) {
      if (error instanceof AuthInputError || error instanceof RangeError) throw new RangeError('Invalid social identity.');
      throw error;
    }

    const existing = await this.db.prepare(`SELECT a.id, a.email, a.display_name AS displayName,
      a.last_name AS lastName, a.phone, a.created_at_ms AS createdAtMs
      FROM social_accounts s JOIN accounts a ON a.id = s.account_id
      WHERE s.provider = ? AND s.subject = ?`)
      .bind(input.provider, input.subject)
      .first<RegisteredAccount>();
    if (existing) {
      await this.db.batch([this.db.prepare(`UPDATE accounts SET email_verified_at_ms = COALESCE(email_verified_at_ms, ?)
        WHERE id = ? AND email = ?`).bind(input.linkedAtMs, existing.id, email)]);
      return existing;
    }

    const linked = await this.db.prepare(`SELECT a.id, a.email, a.display_name AS displayName,
      a.last_name AS lastName, a.phone, a.created_at_ms AS createdAtMs
      FROM accounts a WHERE a.email = ?`)
      .bind(email).first<RegisteredAccount>();
    if (linked) {
      await this.db.batch([
        this.db.prepare(`INSERT INTO social_accounts
          (provider, subject, account_id, email, linked_at_ms) VALUES (?, ?, ?, ?, ?)`)
          .bind(input.provider, input.subject, linked.id, email, input.linkedAtMs),
        this.db.prepare(`UPDATE accounts SET email_verified_at_ms = COALESCE(email_verified_at_ms, ?)
          WHERE id = ?`).bind(input.linkedAtMs, linked.id),
      ]);
      return linked;
    }

    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare(`INSERT INTO accounts
        (id, email, display_name, last_name, phone, created_at_ms, email_verified_at_ms)
        VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
        .bind(id, email, displayName, input.linkedAtMs, input.linkedAtMs),
      this.db.prepare(`INSERT INTO social_accounts
        (provider, subject, account_id, email, linked_at_ms) VALUES (?, ?, ?, ?, ?)`)
        .bind(input.provider, input.subject, id, email, input.linkedAtMs),
    ]);
    return { id, email, displayName, lastName: null, phone: null, createdAtMs: input.linkedAtMs };
  }
}
