import { createPasswordRecoveryToken, hashPasswordRecoveryToken, isPasswordRecoveryToken } from '../domain/password-recovery.ts';
import { passwordInput } from '../domain/authentication.ts';
import { requireTimestamp } from '../domain/validation.ts';
import type { PasswordHasher } from './authentication-service.ts';

export interface PasswordRecoveryStore {
  issue(identifier: string, tokenHash: string, createdAtMs: number, expiresAtMs: number): Promise<{ email: string } | null>;
  invalidate(tokenHash: string): Promise<void>;
  isActive(tokenHash: string, nowMs: number): Promise<boolean>;
  consume(tokenHash: string, passwordHash: string, nowMs: number): Promise<boolean>;
}

export interface RecoverySender {
  send(message: { email: string; token: string; expiresAtMs: number }): Promise<void>;
}

export class PasswordRecoveryService {
  private readonly store: PasswordRecoveryStore;
  private readonly passwords: PasswordHasher;
  private readonly sender: RecoverySender;
  private readonly now: () => number;
  constructor(store: PasswordRecoveryStore, passwords: PasswordHasher, sender: RecoverySender, now = Date.now) {
    this.store = store; this.passwords = passwords; this.sender = sender; this.now = now;
  }

  async request(identifier: string, lifetimeMs: number): Promise<void> {
    const createdAtMs = this.now();
    requireTimestamp(createdAtMs);
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000) throw new RangeError('Invalid recovery lifetime.');
    const expiresAtMs = createdAtMs + lifetimeMs;
    requireTimestamp(expiresAtMs);
    const token = createPasswordRecoveryToken();
    const hash = await hashPasswordRecoveryToken(token);
    const recipient = await this.store.issue(identifier, hash, createdAtMs, expiresAtMs);
    if (!recipient) return;
    try { await this.sender.send({ email: recipient.email, token, expiresAtMs }); }
    catch (error) { await this.store.invalidate(hash); throw error; }
  }

  async confirm(token: string, newPassword: string): Promise<boolean> {
    const password = passwordInput(newPassword);
    if (!isPasswordRecoveryToken(token)) return false;
    const hash = await hashPasswordRecoveryToken(token);
    // Avoid spending a KDF on invalid tokens; consumption rechecks after hashing.
    if (!await this.store.isActive(hash, this.now())) return false;
    return this.store.consume(hash, await this.passwords.hash(password), this.now());
  }
}
