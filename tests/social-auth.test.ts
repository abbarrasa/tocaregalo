import assert from 'node:assert/strict';
import test from 'node:test';
import { SocialAccountsRepository, UnverifiedAccountAdoptionError } from '../src/persistence/social-accounts-repository.ts';
import { GoogleSocialAuth } from '../src/infrastructure/google-social-auth.ts';
import { SocialAuthError } from '../src/domain/social-auth.ts';
import type { PersistenceDatabase } from '../src/persistence/d1.ts';
import { handleSocialAuthRequest, oauthStateCookieName, expiredOAuthStateCookie } from '../src/http/social-auth-routes.ts';
import { OAuthStatesRepository } from '../src/persistence/oauth-states-repository.ts';
import { sha256Base64Url } from '../src/domain/social-auth.ts';
import { SocialAuthService } from '../src/application/social-auth-service.ts';
import { SessionService } from '../src/application/session-service.ts';

test('Google social auth binds fetch and rejects a rejected provider exchange generically', async () => {
  const google = new GoogleSocialAuth({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'https://localhost:5173/api/auth/google/callback',
  }, (async () => Response.json({ error: 'invalid_grant' }, { status: 400 })) as typeof fetch);
  await assert.rejects(
    google.exchange('expired-code'),
    (error: unknown) => error instanceof SocialAuthError && error.stage === 'provider',
  );
});

test('social identity resolution is provider-scoped and links verified existing email', async () => {
  const accounts = new Map<string, Record<string, unknown>>();
  const identities = new Map<string, string>();
  const db: PersistenceDatabase = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bound = values;
          return this;
        },
        async first<T>() {
          if (sql.includes('FROM social_accounts s')) {
            const accountId = identities.get(String(bound[1]));
            return accountId ? accounts.get(accountId) as T : null;
          }
          if (sql.includes('FROM accounts a WHERE a.email = ?')) {
            return [...accounts.values()].find(account => account.email === bound[0]) as T ?? null;
          }
          return null;
        },
        async all<T>() { return { results: [] as T[] }; },
      };
    },
    async batch(statements: readonly unknown[]) {
      void statements;
      return [
        { success: true, results: [{ account_id: 'existing' }] },
        { success: true, results: [{ id: 'existing' }] },
      ];
    },
  };
  accounts.set('existing', {
    id: 'existing', email: 'ines@example.test', displayName: 'Inés',
    lastName: null, phone: null, createdAtMs: 100, emailVerifiedAtMs: 100,
  });
  const repository = new SocialAccountsRepository(db);
  const result = await repository.resolve({
    provider: 'google', subject: 'google-123', email: 'ines@example.test',
    displayName: 'Inés', linkedAtMs: 200,
  });
  assert.equal(result.id, 'existing');
});

test('verified account adoption rechecks account ID and provider email atomically', async () => {
  const db: PersistenceDatabase = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) { bound = values; return this; },
        async first<T>() {
          if (sql.includes('FROM accounts a WHERE a.email = ?')) {
            return {
              id: 'account-a', email: 'old@example.test', displayName: 'Old',
              lastName: null, phone: null, createdAtMs: 100, emailVerifiedAtMs: 100,
            } as T;
          }
          return null as T | null;
        },
        async all<T>() { return { results: [] as T[] }; },
      };
    },
    async batch(statements: readonly unknown[]) {
      void statements;
      return [
        { success: true, results: [] },
        { success: true, results: [] },
      ];
    },
  };
  const repository = new SocialAccountsRepository(db);
  await assert.rejects(repository.resolve({
    provider: 'google',
    subject: 'google-race',
    email: 'old@example.test',
    displayName: 'Old',
    linkedAtMs: 200,
  }), UnverifiedAccountAdoptionError);
});

test('unverified existing accounts cannot be adopted by Google social login', async () => {
  const account = {
    id: 'attacker-account', email: 'victim@example.test', displayName: 'Victim',
    lastName: null, phone: null, createdAtMs: 100, emailVerifiedAtMs: null,
  };
  const db: PersistenceDatabase = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) { bound = values; return this; },
        async first<T>() {
          if (sql.includes('FROM accounts a WHERE a.email = ?')) return account as T;
          return null as T | null;
        },
        async all<T>() { return { results: [] as T[] }; },
      };
    },
    async batch() { return []; },
  };
  const repository = new SocialAccountsRepository(db);
  await assert.rejects(repository.resolve({
    provider: 'google',
    subject: 'google-victim',
    email: 'victim@example.test',
    displayName: 'Victim',
    linkedAtMs: 200,
  }), UnverifiedAccountAdoptionError);
});

test('OAuth callback rejects a state cookie mismatch and clears the browser binding', async () => {
  let exchangeCalls = 0;
  const google = new GoogleSocialAuth({
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'https://localhost:5173/api/auth/google/callback',
  }, (async () => {
    exchangeCalls++;
    return Response.json({ error: 'must not call' }, { status: 400 });
  }) as typeof fetch);
  const state = 'attacker-state';
  const stateHash = await sha256Base64Url(state);
  const db: PersistenceDatabase = {
    prepare() {
      return {
        bind() { return this; },
        async first<T>() { return null as T | null; },
        async all<T>() { return { results: [] as T[] }; },
      };
    },
    async batch() { return []; },
  };
  const oauthStates = new OAuthStatesRepository(db);
  const socialAuth = new SocialAuthService(
    { async resolve() { throw new Error('must not resolve'); } },
    new SessionService({ insert: async () => {}, insertForCredential: async () => false,
      findActive: async () => null, remove: async () => {} }),
  );
  const response = await handleSocialAuthRequest(new Request(
    `https://localhost:5173/api/auth/google/callback?state=${state}&code=synthetic`,
    { headers: { Cookie: `${oauthStateCookieName}=different-binding`, Origin: 'https://localhost:5173' } },
  ), {
    google,
    oauthStates,
    socialAuth,
    applicationOrigin: 'https://localhost:5173',
    sessionTtlSeconds: '86400',
    now: () => 100,
  });
  assert.equal(response.status, 400);
  assert.equal(exchangeCalls, 0);
  assert.equal(response.headers.get('Set-Cookie'), expiredOAuthStateCookie());
  assert.equal(stateHash.length, 43);
});
