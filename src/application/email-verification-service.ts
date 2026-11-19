import { createEmailVerificationToken, hashEmailVerificationToken, isEmailVerificationToken } from '../domain/email-verification.ts';
import { requireId, requireTimestamp } from '../domain/validation.ts';

export interface EmailVerificationStore {
  issue(accountId: string, tokenHash: string, createdAtMs: number, expiresAtMs: number): Promise<{ email: string } | null>;
  invalidate(accountId: string, tokenHash: string): Promise<void>;
  consume(tokenHash: string, nowMs: number): Promise<boolean>;
}

export type VerificationMessage = Readonly<{ email: string; token: string; expiresAtMs: number }>;
export interface VerificationSender { send(message: VerificationMessage): Promise<void> }

export class VerificationDeliveryError extends Error {
  constructor() { super('Verification delivery unavailable.'); this.name = 'VerificationDeliveryError'; }
}

export class EmailVerificationService {
  private readonly store: EmailVerificationStore;
  private readonly sender: VerificationSender;
  private readonly now: () => number;
  constructor(store: EmailVerificationStore, sender: VerificationSender, now = Date.now) {
    this.store = store; this.sender = sender; this.now = now;
  }

  async request(accountId: string, lifetimeMs: number): Promise<boolean> {
    requireId(accountId);
    const createdAtMs = this.now();
    requireTimestamp(createdAtMs);
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000) throw new RangeError('Invalid verification lifetime.');
    const expiresAtMs = createdAtMs + lifetimeMs;
    requireTimestamp(expiresAtMs);
    const token = createEmailVerificationToken();
    const tokenHash = await hashEmailVerificationToken(token);
    const target = await this.store.issue(accountId, tokenHash, createdAtMs, expiresAtMs);
    if (!target) return false;
    try {
      await this.sender.send({ email: target.email, token, expiresAtMs });
    } catch (error) {
      // A failed earlier send must not erase a newer challenge issued concurrently.
      await this.store.invalidate(accountId, tokenHash);
      throw error;
    }
    return true;
  }

  async confirm(token: string): Promise<boolean> {
    if (!isEmailVerificationToken(token)) return false;
    const nowMs = this.now();
    requireTimestamp(nowMs);
    return this.store.consume(await hashEmailVerificationToken(token), nowMs);
  }
}
