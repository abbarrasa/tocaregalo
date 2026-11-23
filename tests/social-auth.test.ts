import assert from 'node:assert/strict';
import test from 'node:test';
import { SocialAccountsRepository } from '../src/persistence/social-accounts-repository.ts';
import type { PersistenceDatabase } from '../src/persistence/d1.ts';

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
      return [];
    },
  };
  accounts.set('existing', {
    id: 'existing', email: 'ines@example.test', displayName: 'Inés',
    lastName: null, phone: null, createdAtMs: 100,
  });
  const repository = new SocialAccountsRepository(db);
  const result = await repository.resolve({
    provider: 'google', subject: 'google-123', email: 'ines@example.test',
    displayName: 'Inés', linkedAtMs: 200,
  });
  assert.equal(result.id, 'existing');
});
