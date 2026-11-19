import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthInputError, loginInput, passwordInput, registrationInput } from '../src/domain/authentication.ts';
import { Argon2PasswordHasher } from '../src/infrastructure/argon2-password-hasher.ts';

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
