import type { EmailVerificationStore } from '../application/email-verification-service.ts';
import type { PersistenceDatabase } from './d1.ts';

export class EmailVerificationsRepository implements EmailVerificationStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async issue(accountId: string, tokenHash: string, createdAtMs: number, expiresAtMs: number) {
    // Select the recipient from the account, never from the request body.
    return this.db.prepare(`INSERT INTO email_verifications
      (account_id, email, token_hash, created_at_ms, expires_at_ms, consumed_at_ms, consumption_id)
      SELECT id, email, ?, ?, ?, NULL, NULL FROM accounts WHERE id = ? AND email_verified_at_ms IS NULL
      ON CONFLICT(account_id) DO UPDATE SET email = excluded.email, token_hash = excluded.token_hash,
        created_at_ms = excluded.created_at_ms, expires_at_ms = excluded.expires_at_ms,
        consumed_at_ms = NULL, consumption_id = NULL
      RETURNING email`).bind(tokenHash, createdAtMs, expiresAtMs, accountId).first<{ email: string }>();
  }

  async invalidate(accountId: string, tokenHash: string): Promise<void> {
    await this.db.batch([this.db.prepare('DELETE FROM email_verifications WHERE account_id = ? AND token_hash = ?')
      .bind(accountId, tokenHash)]);
  }

  async consume(tokenHash: string, nowMs: number): Promise<boolean> {
    const operationId = crypto.randomUUID();
    const result = await this.db.batch([
      this.db.prepare(`UPDATE email_verifications SET consumed_at_ms = ?, consumption_id = ?
        WHERE token_hash = ? AND consumed_at_ms IS NULL AND created_at_ms <= ? AND expires_at_ms > ?
        AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = email_verifications.account_id
          AND a.email = email_verifications.email AND a.email_verified_at_ms IS NULL)
        RETURNING account_id`).bind(nowMs, operationId, tokenHash, nowMs, nowMs),
      this.db.prepare(`UPDATE accounts SET email_verified_at_ms = ?
        WHERE email_verified_at_ms IS NULL AND EXISTS (
          SELECT 1 FROM email_verifications v WHERE v.account_id = accounts.id AND v.email = accounts.email
            AND v.token_hash = ? AND v.consumption_id = ?
        ) RETURNING id`).bind(nowMs, tokenHash, operationId),
    ]);
    return result[0].results.length === 1 && result[1].results.length === 1;
  }
}
