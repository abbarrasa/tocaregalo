import type { SessionService } from './session-service.ts';
import type { RegisteredAccount } from './authentication-service.ts';

export interface SocialIdentityStore {
  resolve(input: {
    provider: 'google';
    subject: string;
    email: string;
    displayName: string;
    linkedAtMs: number;
  }): Promise<RegisteredAccount>;
}

export class SocialAuthService {
  private readonly identities: SocialIdentityStore;
  private readonly sessions: SessionService;
  private readonly now: () => number;
  constructor(identities: SocialIdentityStore, sessions: SessionService, now: () => number = Date.now) {
    this.identities = identities;
    this.sessions = sessions;
    this.now = now;
  }

  async login(
    provider: 'google',
    subject: string,
    email: string,
    displayName: string,
    lifetimeMs: number,
  ) {
    const account = await this.identities.resolve({
      provider, subject, email, displayName, linkedAtMs: this.now(),
    });
    return this.sessions.issueForVerifiedAccount(account.id, lifetimeMs);
  }
}
