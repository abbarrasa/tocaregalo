import type { PersistenceDatabase } from './d1.ts';

export class OAuthStatesRepository {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async insert(stateHash: string, provider: 'google', nowMs: number, ttlMs: number): Promise<void> {
    await this.db.batch([
      this.db.prepare(`DELETE FROM oauth_states
        WHERE state_hash IN (
          SELECT state_hash FROM oauth_states
          WHERE expires_at_ms <= ?
          ORDER BY expires_at_ms, state_hash
          LIMIT 100
        )`).bind(nowMs),
      this.db.prepare(`INSERT INTO oauth_states
        (state_hash, provider, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?)`)
        .bind(stateHash, provider, nowMs, nowMs + ttlMs),
    ]);
  }

  async consume(stateHash: string, provider: 'google', nowMs: number): Promise<string | null> {
    const row = await this.db.prepare(`DELETE FROM oauth_states
      WHERE state_hash = ? AND provider = ? AND created_at_ms <= ? AND expires_at_ms > ?
      RETURNING state_hash`)
      .bind(stateHash, provider, nowMs, nowMs).first<{ state_hash: string }>();
    return row ? 'consumed' : null;
  }

  async find(stateHash: string, provider: 'google', nowMs: number): Promise<boolean> {
    const row = await this.db.prepare(`SELECT state_hash AS stateHash FROM oauth_states
      WHERE state_hash = ? AND provider = ? AND created_at_ms <= ? AND expires_at_ms > ?`)
      .bind(stateHash, provider, nowMs, nowMs).first<{ stateHash: string }>();
    return !!row;
  }

  async deleteExpired(nowMs: number): Promise<void> {
    await this.db.batch([this.db.prepare('DELETE FROM oauth_states WHERE expires_at_ms <= ?').bind(nowMs)]);
  }
}
