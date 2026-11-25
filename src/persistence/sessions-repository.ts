import type { Session, SessionStore } from '../application/session-service.ts';
import type { PersistenceDatabase } from './d1.ts';

export class SessionsRepository implements SessionStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async insert(session: Session): Promise<void> {
    await this.db.batch([this.db.prepare(`INSERT INTO sessions
      (token_hash, account_id, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)`)
      .bind(session.tokenHash, session.accountId, session.createdAtMs, session.expiresAtMs)]);
  }

  async findActive(tokenHash: string, nowMs: number): Promise<Session | null> {
    return this.db.prepare(`SELECT token_hash AS tokenHash, account_id AS accountId,
      created_at_ms AS createdAtMs, expires_at_ms AS expiresAtMs FROM sessions
      WHERE token_hash = ? AND created_at_ms <= ? AND expires_at_ms > ?`)
      .bind(tokenHash, nowMs, nowMs).first<Session>();
  }

  async insertForCredential(session: Session, passwordHash: string): Promise<boolean> {
    // Serialize issuance against recovery: a verified but superseded credential cannot issue a session.
    return !!await this.db.prepare(`INSERT INTO sessions (token_hash, account_id, created_at_ms, expires_at_ms)
      SELECT ?, account_id, ?, ? FROM password_credentials WHERE account_id = ? AND password_hash = ?
      RETURNING token_hash`).bind(session.tokenHash, session.createdAtMs, session.expiresAtMs,
        session.accountId, passwordHash).first();
  }

  async remove(tokenHash: string): Promise<void> {
    await this.db.batch([this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash)]);
  }
}
