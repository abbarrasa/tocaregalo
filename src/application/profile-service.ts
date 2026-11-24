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
  findCredential(accountId: string): Promise<{ passwordHash: string; revision: number } | null>;
  findProfile(accountId: string): Promise<ProfileAccount | null>;
  update(accountId: string, input: ProfileUpdate, passwordHash: string | null,
    credential: { passwordHash: string; revision: number } | null,
    previousEmail: string, nowMs: number): Promise<ProfileAccount>;
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
    const profileSnapshot = await this.store.findProfile(accountId);
    if (!profileSnapshot) throw new ProfileConflictError({ email: 'La cuenta dejó de existir.' });
    let passwordHash: string | null = null;
    let credentialSnapshot: { passwordHash: string; revision: number } | null = null;
    if (input.newPassword !== null) {
      if (input.currentPassword === null) throw new ProfilePasswordError();
      const credential = await this.store.findCredential(accountId);
      if (!credential || !await this.passwords.verify(input.currentPassword, credential.passwordHash)) {
        throw new ProfilePasswordError();
      }
      credentialSnapshot = credential;
      passwordHash = await this.passwords.hash(input.newPassword);
    }
    const account = await this.store.update(accountId, input, passwordHash, credentialSnapshot,
      profileSnapshot.email, this.now());
    return { account, passwordChanged: input.newPassword !== null };
  }
}
