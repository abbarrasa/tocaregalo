export const authWindowMs = 15 * 60_000;

export interface AuthCounterStore {
  consume(keyHash: string, windowStartMs: number, limit: number): Promise<boolean>;
}

export class AuthRateLimiter {
  private readonly store: AuthCounterStore;
  private readonly now: () => number;
  constructor(store: AuthCounterStore, now = Date.now) { this.store = store; this.now = now; }

  private async consume(key: string, limit: number, windowStartMs: number): Promise<boolean> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tocaregalo/auth-rate/v1:' + key));
    const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return this.store.consume(hash, windowStartMs, limit);
  }

  async allowInvitation(ownerId: string, groupId: string, email: string): Promise<boolean> {
    const window = Math.floor(this.now() / authWindowMs) * authWindowMs;
    if (!await this.consume('invitation:owner:' + ownerId, 30, window)) return false;
    return this.consume('invitation:recipient:' + JSON.stringify([groupId, email]), 5, window);
  }

  async allow(operation: 'register' | 'login' | 'verification-request' | 'verification-confirm' | 'recovery-request' | 'recovery-confirm', ip: string, identifier?: string): Promise<boolean> {
    const windowStartMs = Math.floor(this.now() / authWindowMs) * authWindowMs;
    if (!await this.consume(operation + ':ip:' + ip, operation === 'register' ? 10 : 30, windowStartMs)) return false;
    return (operation !== 'login' && operation !== 'verification-request' && operation !== 'recovery-request') || identifier === undefined
      || this.consume(operation + ':identifier:' + identifier, 5, windowStartMs);
  }
}
