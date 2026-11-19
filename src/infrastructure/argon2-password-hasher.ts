import { argon2id } from '@noble/hashes/argon2.js';
import type { PasswordHasher } from '../application/authentication-service.ts';

const parameters = { m: 19456, t: 2, p: 1, dkLen: 32, version: 0x13, maxmem: 32 * 1024 * 1024 };
const prefix = '$argon2id$v=19$m=19456,t=2,p=1$';
const encodedPattern = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
}

function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
}

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    // Synchronous KDF: one working memory allocation at a time per isolate.
    const derived = argon2id(password, salt, parameters);
    try { return prefix + base64(salt) + '$' + base64(derived); }
    finally { derived.fill(0); }
  }

  async verify(password: string, encoded: string | null): Promise<boolean> {
    const match = encoded === null ? null : encodedPattern.exec(encoded);
    if (encoded !== null && !match) throw new Error('Unsupported stored credential.');
    const salt = match ? decode(match[1]) : new Uint8Array(16);
    const expected = match ? decode(match[2]) : new Uint8Array(32);
    const actual = argon2id(password, salt, parameters);
    try {
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
      return match !== null && difference === 0;
    } finally { actual.fill(0); expected.fill(0); }
  }
}
