import type { Registration } from '../domain/authentication.ts';
import type { SessionService } from './session-service.ts';

export class RegistrationConflictError extends Error {
  constructor() { super('Registration unavailable.'); this.name = 'RegistrationConflictError'; }
}

export type RegisteredAccount = Readonly<{
  id: string; email: string; displayName: string; lastName: string | null; phone: string | null; createdAtMs: number;
}>;

export interface CredentialStore {
  create(account: RegisteredAccount, passwordHash: string): Promise<void>;
  findCredential(identifier: string): Promise<{ accountId: string; passwordHash: string } | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encoded: string | null): Promise<boolean>;
}

export class AuthenticationService {
  private readonly credentials: CredentialStore;
  private readonly passwords: PasswordHasher;
  private readonly sessions: SessionService;
  private readonly now: () => number;

  constructor(credentials: CredentialStore, passwords: PasswordHasher, sessions: SessionService, now = Date.now) {
    this.credentials = credentials; this.passwords = passwords; this.sessions = sessions; this.now = now;
  }

  async register(input: Registration): Promise<RegisteredAccount> {
    const account = { id: crypto.randomUUID(), email: input.email, displayName: input.name,
      lastName: input.lastName, phone: input.phone, createdAtMs: this.now() };
    await this.credentials.create(account, await this.passwords.hash(input.password));
    return account;
  }

  async login(identifier: string, password: string, lifetimeMs: number) {
    const credential = await this.credentials.findCredential(identifier);
    // Unknown accounts still perform a full KDF to reduce credential-enumeration timing differences.
    const valid = await this.passwords.verify(password, credential?.passwordHash ?? null);
    if (!credential || !valid) return null;
    return this.sessions.issueForVerifiedAccount(credential.accountId, lifetimeMs);
  }
}
