export function createEmailVerificationToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function isEmailVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}

export async function hashEmailVerificationToken(token: string): Promise<string> {
  if (!isEmailVerificationToken(token)) throw new RangeError('Invalid verification token.');
  const hash = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode('tocaregalo/email-verification/v1:' + token));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
