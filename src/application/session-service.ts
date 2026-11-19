import { createSessionToken, hashSessionToken, isSessionToken, sessionCsrfToken } from '../domain/session.ts';
import { requireId, requireTimestamp } from '../domain/validation.ts';

export type Session = Readonly<{
  tokenHash: string; accountId: string; createdAtMs: number; expiresAtMs: number;
}>;

export interface SessionStore {
  insert(session: Session): Promise<void>;
  findActive(tokenHash: string, nowMs: number): Promise<Session | null>;
  remove(tokenHash: string): Promise<void>;
}

export class SessionService {
  private readonly store: SessionStore;
  private readonly now: () => number;
  constructor(store: SessionStore, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
  }

  // Trusted internal boundary: the caller must have verified account ownership.
  // No HTTP endpoint exposes this operation. Each issue generates a fresh token.
  async issueForVerifiedAccount(accountId: string, lifetimeMs: number) {
    requireId(accountId);
    const createdAtMs = this.now();
    requireTimestamp(createdAtMs);
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000) throw new RangeError('Invalid session lifetime.');
    const expiresAtMs = createdAtMs + lifetimeMs;
    requireTimestamp(expiresAtMs);
    const token = createSessionToken();
    const tokenHash = await hashSessionToken(token);
    await this.store.insert({ tokenHash, accountId, createdAtMs, expiresAtMs });
    return { token, csrfToken: await sessionCsrfToken(token), expiresAtMs };
  }

  async authenticate(token: string | null): Promise<Session | null> {
    if (!token || !isSessionToken(token)) return null;
    const nowMs = this.now();
    requireTimestamp(nowMs);
    return this.store.findActive(await hashSessionToken(token), nowMs);
  }

  async revoke(token: string): Promise<void> {
    if (isSessionToken(token)) await this.store.remove(await hashSessionToken(token));
  }
}
