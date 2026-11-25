import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthInputError, loginInput, normalizeNationalOrInternationalPhone, passwordInput, profileUpdateInput, registrationInput } from '../src/domain/authentication.ts';
import { Argon2PasswordHasher } from '../src/infrastructure/argon2-password-hasher.ts';
import { ProfileService, ProfileConflictError, type ProfileStore } from '../src/application/profile-service.ts';

test('password policy is only a minimum of six characters, without trimming or a specific maximum', () => {
  for (const password of ['123456', 'abcdef', '      ', '😀😀😀😀😀😀', 'a'.repeat(1024)]) {
    assert.equal(passwordInput(password), password);
  }
  for (const password of ['', '12345', '😀😀😀😀😀', undefined, 123456]) {
    assert.throws(() => passwordInput(password), AuthInputError);
  }
  const raw = '  aBcD  ';
  assert.equal(passwordInput(raw), raw);
});

test('profile password update passes the verified credential snapshot to atomic persistence', async () => {
  const passwordHasher = new Argon2PasswordHasher();
  const oldHash = await passwordHasher.hash('old-password');
  let receivedCredential: { passwordHash: string; revision: number } | null = null;
  let receivedPasswordHash: string | null = null;
  const store: ProfileStore = {
    async findCredential() { return { passwordHash: oldHash, revision: 7 }; },
    async findProfile() { return { id: 'a', email: 'a@example.test', displayName: 'A', lastName: null, phone: null,
      createdAtMs: 0, emailVerifiedAtMs: null }; },
    async update(_accountId, _input, passwordHash, credential, _previousEmail) {
      receivedPasswordHash = passwordHash;
      receivedCredential = credential;
      if (credential?.revision !== 7 || credential.passwordHash !== oldHash) {
        throw new ProfileConflictError({ currentPassword: 'La contraseña cambió.' });
      }
      return { id: 'a', email: 'a@example.test', displayName: 'A', lastName: null, phone: null,
        createdAtMs: 0, emailVerifiedAtMs: null };
    },
  };
  const service = new ProfileService(store, passwordHasher, () => 100);
  const result = await service.update('a', {
    name: 'A', email: 'a@example.test', lastName: null, phone: null,
    currentPassword: 'old-password', newPassword: 'new-password',
  });
  assert.equal(result.passwordChanged, true);
  assert.deepEqual(receivedCredential, { passwordHash: oldHash, revision: 7 });
  assert.ok(typeof receivedPasswordHash === 'string');
  assert.notEqual(receivedPasswordHash, oldHash);
});

test('registration requires email, name and password; optional fields normalize without default country guesses', () => {
  assert.deepEqual(registrationInput({ email: ' Alice@EXAMPLE.TEST ', name: ' Alice ', password: 'abcdef' }), {
    email: 'alice@example.test', name: 'Alice', password: 'abcdef', lastName: null, phone: null,
  });
  assert.equal(registrationInput({ email: 'a@example.test', name: 'A', password: 'abcdef', phone: '+34 (612) 345-678' }).phone,
    '+34612345678');
  assert.deepEqual(loginInput({ identifier: ' ALICE@example.test ', password: '      ' }), {
    identifier: 'alice@example.test', password: '      ',
  });
  assert.equal(loginInput({ identifier: '+34 612345678', password: 'abcdef' }).identifier, '+34612345678');
  for (const value of [null, [], {}, { email: 'a@example.test', password: 'abcdef' },
    { email: 'invalid', name: 'A', password: 'abcdef' },
    { email: 'a@example.test', name: 'A', password: 'abcdef', phone: '612345678' }]) {
    assert.throws(() => registrationInput(value), AuthInputError);
  }
});

test('national phone login respects the configured prefix and requires + for cross-country identifiers', () => {
  assert.equal(normalizeNationalOrInternationalPhone('612345678'), '+34612345678');
  assert.equal(normalizeNationalOrInternationalPhone('34 612345678'), '+34612345678');
  assert.equal(normalizeNationalOrInternationalPhone('+34612345678'), '+34612345678');
  assert.equal(normalizeNationalOrInternationalPhone('+1 (202) 555-0100'), '+12025550100');
  assert.equal(normalizeNationalOrInternationalPhone('34991234567', '+55'), '+5534991234567');
  assert.equal(normalizeNationalOrInternationalPhone('+34991234567', '+55'), '+34991234567');
  assert.equal(loginInput({ identifier: '612345678', password: 'abcdef' }).identifier, '+34612345678');
  assert.equal(loginInput({ identifier: '+34 612345678', password: 'abcdef' }).identifier, '+34612345678');
  assert.equal(loginInput({ identifier: '+1 2025550100', password: 'abcdef' }).identifier, '+12025550100');
  assert.throws(() => normalizeNationalOrInternationalPhone('12abc345'), AuthInputError);
});

test('Argon2id uses independent salts and verifies the exact password with fixed bounded parameters', async () => {
  const passwords = new Argon2PasswordHasher();
  const first = await passwords.hash('  Abcdef  ');
  const second = await passwords.hash('  Abcdef  ');
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(first, second);
  assert.equal(await passwords.verify('  Abcdef  ', first), true);
  assert.equal(await passwords.verify('Abcdef', first), false);
  assert.equal(await passwords.verify('  abcdef  ', first), false);
  assert.equal(await passwords.verify('anything', null), false);
  await assert.rejects(passwords.verify('abcdef', first.replace('m=19456', 'm=999999999')));
});

test('profile updates reuse registration validation and require the current password for password changes', () => {
  assert.deepEqual(profileUpdateInput({
    name: ' Alice ',
    lastName: ' Example ',
    email: ' ALICE@EXAMPLE.TEST ',
    phone: '+34 (612) 345-678',
  }), {
    name: 'Alice',
    lastName: 'Example',
    email: 'alice@example.test',
    phone: '+34612345678',
    currentPassword: null,
    newPassword: null,
  });
  assert.deepEqual(profileUpdateInput({
    name: 'Alice',
    email: 'alice@example.test',
    currentPassword: 'old-password',
    newPassword: '  new😀password  ',
  }).newPassword, '  new😀password  ');
  assert.throws(() => profileUpdateInput({
    name: 'Alice',
    email: 'alice@example.test',
    newPassword: 'new-password',
  }), AuthInputError);
  assert.throws(
    () => profileUpdateInput({ name: '', email: 'invalid', phone: '612345678' }),
    (error: unknown) => error instanceof AuthInputError
      && error.fields.name !== undefined
      && error.fields.email !== undefined
      && error.fields.phone !== undefined,
  );
});
