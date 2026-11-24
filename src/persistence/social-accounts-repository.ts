import type { RegisteredAccount } from '../application/authentication-service.ts';
import type { SocialIdentityStore } from '../application/social-auth-service.ts';
import { normalizeEmail, AuthInputError } from '../domain/authentication.ts';
import { normalizedName } from '../domain/validation.ts';
import type { PersistenceDatabase } from './d1.ts';

export class SocialAccountAdoptionError extends Error {
  constructor() {
    super('Account ownership must be recovered before linking.');
    this.name = 'SocialAccountAdoptionError';
  }
}

// Backward-compatible alias: historically this error name implied only "unverified",
// but adoption can be rejected for multiple reasons. Prefer SocialAccountAdoptionError.
export class UnverifiedAccountAdoptionError extends SocialAccountAdoptionError {
  constructor() {
    super();
    this.name = 'UnverifiedAccountAdoptionError';
  }
}

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
        WHERE id = ?`).bind(input.linkedAtMs, existing.id)]);
      return existing;
    }

    const linked = await this.db.prepare(`SELECT a.id, a.email, a.display_name AS displayName,
      a.last_name AS lastName, a.phone, a.created_at_ms AS createdAtMs,
      a.email_verified_at_ms AS emailVerifiedAtMs
      FROM accounts a WHERE a.email = ?`)
      .bind(email).first<RegisteredAccount & { emailVerifiedAtMs: number | null }>();
    if (linked) {
      if (linked.emailVerifiedAtMs === null
        || !Number.isSafeInteger(linked.emailVerifiedAtMs)) throw new UnverifiedAccountAdoptionError();
      const result = await this.db.batch([
        this.db.prepare(`INSERT INTO social_accounts
          (provider, subject, account_id, email, linked_at_ms)
          SELECT ?, ?, a.id, a.email, ?
          FROM accounts a
          WHERE a.id = ? AND a.email = ? AND a.email_verified_at_ms IS NOT NULL
          RETURNING account_id`)
          .bind(input.provider, input.subject, input.linkedAtMs, linked.id, email),
        this.db.prepare(`UPDATE accounts SET email_verified_at_ms = COALESCE(email_verified_at_ms, ?)
          WHERE id = ? AND email = ? AND email_verified_at_ms IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM social_accounts s
              WHERE s.provider = ? AND s.subject = ? AND s.account_id = ?
            )
          RETURNING id`).bind(input.linkedAtMs, linked.id, email,
            input.provider, input.subject, linked.id),
      ]);
      if (result[0].results.length !== 1 || result[1].results.length !== 1) {
        throw new UnverifiedAccountAdoptionError();
      }
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
