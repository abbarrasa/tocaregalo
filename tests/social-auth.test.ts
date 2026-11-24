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
import { DatabaseSync } from 'node:sqlite';
import type { D1Statement, D1Value } from '../src/persistence/d1.ts';

class SocialD1Statement implements D1Statement {
  private values: D1Value[] = [];
  private readonly db: DatabaseSync;
  readonly sql: string;
  constructor(db: DatabaseSync, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...values: D1Value[]) { this.values = values; return this; }
  private parameters(): (string | number | null | Uint8Array)[] {
    return this.values.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.parameters()) as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.parameters()) as T[] };
  }
  execute(): void { this.db.prepare(this.sql).run(...this.parameters()); }
}

function socialDatabaseFixture(db: DatabaseSync, beforeLinkedLookup?: () => void): PersistenceDatabase {
  return {
    prepare(sql: string) {
      if (sql.includes('FROM accounts a WHERE a.email = ?')) {
        const statement = new SocialD1Statement(db, sql);
        const originalFirst = statement.first.bind(statement);
        statement.first = async <T>() => {
          const row = await originalFirst<T>();
          beforeLinkedLookup?.();
          return row;
        };
        return statement;
      }
      return new SocialD1Statement(db, sql);
    },
    async batch(statements) {
      db.exec('BEGIN');
      const results: Array<{ success: boolean; results: unknown[] }> = [];
      try {
        for (const statement of statements as SocialD1Statement[]) {
          if (/RETURNING\b/i.test(statement.sql)) {
            const row = await statement.first<Record<string, unknown>>();
            results.push({ success: true, results: row ? [row] : [] });
          } else {
            statement.execute();
            results.push({ success: true, results: [] });
          }
        }
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

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

test('social identity resolution links a verified existing account successfully', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    last_name TEXT, phone TEXT, created_at_ms INTEGER NOT NULL,
    email_verified_at_ms INTEGER
  ); CREATE TABLE social_accounts (
    provider TEXT NOT NULL, subject TEXT NOT NULL, account_id TEXT NOT NULL,
    email TEXT NOT NULL, linked_at_ms INTEGER NOT NULL,
    PRIMARY KEY(provider, subject), UNIQUE(provider, account_id)
  );`);
  db.prepare(`INSERT INTO accounts VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
    .run('existing', 'ines@example.test', 'Inés', 100, 100);
  const database = socialDatabaseFixture(db);
  const repository = new SocialAccountsRepository(database);
  const result = await repository.resolve({
    provider: 'google', subject: 'google-123', email: 'ines@example.test',
    displayName: 'Inés', linkedAtMs: 200,
  });
  assert.equal(result.id, 'existing');
  assert.equal(db.prepare('SELECT count(*) AS count FROM social_accounts').get()?.count, 1);
  db.close();
});

test('verified account adoption rejects an account whose email changes between lookup and batch', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    last_name TEXT, phone TEXT, created_at_ms INTEGER NOT NULL,
    email_verified_at_ms INTEGER
  ); CREATE TABLE social_accounts (
    provider TEXT NOT NULL, subject TEXT NOT NULL, account_id TEXT NOT NULL,
    email TEXT NOT NULL, linked_at_ms INTEGER NOT NULL,
    PRIMARY KEY(provider, subject), UNIQUE(provider, account_id)
  );`);
  db.prepare(`INSERT INTO accounts VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
    .run('existing', 'old@example.test', 'Old', 100, 100);
  let changed = false;
  const database = socialDatabaseFixture(db, () => {
    if (!changed) {
      changed = true;
      db.prepare('UPDATE accounts SET email=? WHERE id=?').run('new@example.test', 'existing');
    }
  });
  const repository = new SocialAccountsRepository(database);
  await assert.rejects(repository.resolve({
    provider: 'google', subject: 'google-race', email: 'old@example.test',
    displayName: 'Old', linkedAtMs: 200,
  }), UnverifiedAccountAdoptionError);
  assert.equal(db.prepare('SELECT count(*) AS count FROM social_accounts').get()?.count, 0);
  assert.equal(db.prepare('SELECT email FROM accounts WHERE id=?').get('existing')?.email, 'new@example.test');
  db.close();
});

test('verified account adoption rejects verification being cleared between lookup and batch', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    last_name TEXT, phone TEXT, created_at_ms INTEGER NOT NULL,
    email_verified_at_ms INTEGER
  ); CREATE TABLE social_accounts (
      provider TEXT NOT NULL, subject TEXT NOT NULL, account_id TEXT NOT NULL,
      email TEXT NOT NULL, linked_at_ms INTEGER NOT NULL,
      PRIMARY KEY(provider, subject), UNIQUE(provider, account_id)
    );`);
    db.prepare(`INSERT INTO accounts VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
      .run('existing', 'verified@example.test', 'Verified', 100, 100);
    let changed = false;
    const database = socialDatabaseFixture(db, () => {
      if (!changed) {
        changed = true;
        db.prepare('UPDATE accounts SET email_verified_at_ms=NULL WHERE id=?').run('existing');
      }
    });
    const repository = new SocialAccountsRepository(database);
    await assert.rejects(repository.resolve({
      provider: 'google', subject: 'google-race', email: 'verified@example.test',
      displayName: 'Verified', linkedAtMs: 200,
    }), UnverifiedAccountAdoptionError);
    assert.equal(db.prepare('SELECT count(*) AS count FROM social_accounts').get()?.count, 0);
    assert.equal(db.prepare('SELECT email_verified_at_ms AS value FROM accounts WHERE id=?').get('existing')?.value, null);
    db.close();
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
  const anotherStateHash = await sha256Base64Url('original-browser-state');
  assert.notEqual(stateHash, anotherStateHash);
  assert.equal(anotherStateHash.length, 43);
  const db: PersistenceDatabase = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) { bound = values; return this; },
        async first<T>() {
          if (sql.includes('SELECT state_hash AS stateHash FROM oauth_states')) {
            return bound[0] === stateHash
              ? { stateHash } as T
              : null as T | null;
          }
          return null as T | null;
        },
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
  assert.equal(await oauthStates.find(stateHash, 'google', 100), true);
  const response = await handleSocialAuthRequest(new Request(
    `https://localhost:5173/api/auth/google/callback?state=${state}&code=synthetic`,
    { headers: { Cookie: `${oauthStateCookieName}=${anotherStateHash}`, Origin: 'https://localhost:5173' } },
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
