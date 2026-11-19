const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createSessionToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export function isSessionToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}

export async function hashSessionToken(token: string): Promise<string> {
  if (!isSessionToken(token)) throw new RangeError('Invalid session token.');
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}

// Domain separation prevents the database token hash from being used as a CSRF token.
export async function sessionCsrfToken(token: string): Promise<string> {
  if (!isSessionToken(token)) throw new RangeError('Invalid session token.');
  return hex(new Uint8Array(await crypto.subtle.digest(
    'SHA-256', encoder.encode('tocaregalo/csrf/v1:' + token),
  )));
}

export function equalCsrfTokens(actual: string, expected: string): boolean {
  if (!isSessionToken(actual) || !isSessionToken(expected)) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
