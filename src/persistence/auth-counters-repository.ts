import { authWindowMs, type AuthCounterStore } from '../application/auth-rate-limiter.ts';
import type { PersistenceDatabase } from './d1.ts';

export class AuthCountersRepository implements AuthCounterStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async consume(keyHash: string, windowStartMs: number, limit: number): Promise<boolean> {
    // Bounded cleanup; never scan/delete the entire historical table in a request.
    await this.db.batch([this.db.prepare(`DELETE FROM auth_rate_limits WHERE key_hash IN (
      SELECT key_hash FROM auth_rate_limits WHERE window_start_ms < ? LIMIT 100
    )`).bind(windowStartMs - authWindowMs)]);
    const row = await this.db.prepare(`INSERT INTO auth_rate_limits (key_hash, window_start_ms, attempts)
      VALUES (?, ?, 1) ON CONFLICT(key_hash) DO UPDATE SET
      window_start_ms = excluded.window_start_ms,
      attempts = CASE WHEN auth_rate_limits.window_start_ms < excluded.window_start_ms
        THEN 1 ELSE auth_rate_limits.attempts + 1 END
      WHERE auth_rate_limits.window_start_ms < excluded.window_start_ms
        OR (auth_rate_limits.window_start_ms = excluded.window_start_ms AND auth_rate_limits.attempts < ?)
      RETURNING key_hash`).bind(keyHash, windowStartMs, limit).first();
    return row !== null;
  }
}
