import type { ProfileUpdate } from '../domain/authentication.ts';
import type { PasswordHasher } from './authentication-service.ts';
import type { RegisteredAccount } from './authentication-service.ts';

export class ProfilePasswordError extends Error {
  constructor() { super('Current password is invalid.'); this.name = 'ProfilePasswordError'; }
}

export class ProfileConflictError extends Error {
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string> = {}) {
    super('Profile data conflicts.');
    this.name = 'ProfileConflictError';
    this.fields = fields;
  }
}

export type ProfileAccount = RegisteredAccount & Readonly<{ emailVerifiedAtMs: number | null }>;

export interface ProfileStore {
  findCredential(accountId: string): Promise<{ passwordHash: string } | null>;
  update(accountId: string, input: ProfileUpdate, passwordHash: string | null, nowMs: number): Promise<ProfileAccount>;
}

export class ProfileService {
  private readonly store: ProfileStore;
  private readonly passwords: PasswordHasher;
  private readonly now: () => number;
  constructor(store: ProfileStore, passwords: PasswordHasher, now: () => number = Date.now) {
    this.store = store;
    this.passwords = passwords;
    this.now = now;
  }

  async update(accountId: string, input: ProfileUpdate): Promise<{ account: ProfileAccount; passwordChanged: boolean }> {
    let passwordHash: string | null = null;
    if (input.newPassword !== null) {
      if (input.currentPassword === null) throw new ProfilePasswordError();
      const credential = await this.store.findCredential(accountId);
      if (!credential || !await this.passwords.verify(input.currentPassword, credential.passwordHash)) {
        throw new ProfilePasswordError();
      }
      passwordHash = await this.passwords.hash(input.newPassword);
    }
    const account = await this.store.update(accountId, input, passwordHash, this.now());
    return { account, passwordChanged: input.newPassword !== null };
  }
}
