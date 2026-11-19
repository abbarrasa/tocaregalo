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

  async allow(operation: 'register' | 'login', ip: string, identifier?: string): Promise<boolean> {
    const windowStartMs = Math.floor(this.now() / authWindowMs) * authWindowMs;
    if (!await this.consume(operation + ':ip:' + ip, operation === 'register' ? 10 : 30, windowStartMs)) return false;
    return operation !== 'login' || identifier === undefined
      || this.consume('login:identifier:' + identifier, 5, windowStartMs);
  }
}
