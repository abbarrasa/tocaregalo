import type { PasswordRecoveryStore } from '../application/password-recovery-service.ts';
import type { PersistenceDatabase } from './d1.ts';

const activeAccount = `EXISTS (
  SELECT 1 FROM accounts a
  LEFT JOIN password_credentials c ON c.account_id = a.id
  WHERE a.id = password_recoveries.account_id
    AND a.email = password_recoveries.email
    AND COALESCE(c.revision, 0) = password_recoveries.credential_revision
)`;

export class PasswordRecoveriesRepository implements PasswordRecoveryStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async issue(identifier: string, tokenHash: string, createdAtMs: number, expiresAtMs: number) {
    return this.db.prepare(`INSERT INTO password_recoveries
      (account_id, email, credential_revision, token_hash, created_at_ms, expires_at_ms, consumption_id)
      SELECT a.id, a.email, COALESCE(c.revision, 0), ?, ?, ?, NULL FROM accounts a
      LEFT JOIN password_credentials c ON c.account_id = a.id
      WHERE a.email = ? OR a.phone = ?
      ON CONFLICT(account_id) DO UPDATE SET email = excluded.email,
        credential_revision = excluded.credential_revision, token_hash = excluded.token_hash,
        created_at_ms = excluded.created_at_ms, expires_at_ms = excluded.expires_at_ms, consumption_id = NULL
      RETURNING email`).bind(tokenHash, createdAtMs, expiresAtMs, identifier, identifier).first<{ email: string }>();
  }

  async invalidate(tokenHash: string): Promise<void> {
    await this.db.batch([this.db.prepare('DELETE FROM password_recoveries WHERE token_hash = ?').bind(tokenHash)]);
  }

  async isActive(tokenHash: string, nowMs: number): Promise<boolean> {
    return !!await this.db.prepare(`SELECT account_id FROM password_recoveries
      WHERE token_hash = ? AND consumption_id IS NULL AND created_at_ms <= ? AND expires_at_ms > ?
      AND ${activeAccount}`).bind(tokenHash, nowMs, nowMs).first();
  }

  async consume(tokenHash: string, passwordHash: string, nowMs: number): Promise<boolean> {
    const operationId = crypto.randomUUID();
    // The operation ID prevents a replay from using a previously consumed challenge.
    const scope = `SELECT account_id FROM password_recoveries WHERE token_hash = ? AND consumption_id = ?`;
    const result = await this.db.batch([
      this.db.prepare(`UPDATE password_recoveries SET consumption_id = ? WHERE token_hash = ?
        AND consumption_id IS NULL AND created_at_ms <= ? AND expires_at_ms > ? AND ${activeAccount}
        RETURNING account_id`).bind(operationId, tokenHash, nowMs, nowMs),
      this.db.prepare(`UPDATE password_credentials
        SET password_hash = ?, revision = revision + 1
        WHERE account_id IN (
          SELECT r.account_id FROM password_recoveries r
          WHERE r.token_hash = ? AND r.consumption_id = ?
        )
        RETURNING account_id`).bind(passwordHash, tokenHash, operationId),
      this.db.prepare(`INSERT INTO password_credentials
        (account_id, password_hash, created_at_ms, revision)
        SELECT r.account_id, ?, ?, 1 FROM password_recoveries r
        WHERE r.token_hash = ? AND r.consumption_id = ?
          AND NOT EXISTS (SELECT 1 FROM password_credentials c WHERE c.account_id = r.account_id)
        RETURNING account_id`).bind(passwordHash, nowMs, tokenHash, operationId),
      this.db.prepare(`DELETE FROM sessions WHERE account_id IN (${scope})`).bind(tokenHash, operationId),
    ]);
    return result[0].results.length === 1
      && (result[1].results.length === 1 || result[2].results.length === 1);
  }
}
