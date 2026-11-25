import { isSessionToken } from '../domain/session.ts';

export const sessionCookieName = '__Host-tocaregalo_session';
const attributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';

export function readSessionCookie(cookie: string | null): string | null {
  const matches = (cookie ?? '').split(';').map(part => part.trim())
    .filter(part => part.split('=', 1)[0] === sessionCookieName);
  // Reject duplicate cookies rather than trusting a parser-dependent ordering.
  if (matches.length !== 1) return null;
  const value = matches[0].slice(sessionCookieName.length + 1);
  return isSessionToken(value) ? value : null;
}

// For the future login response, after verified account ownership and session issue.
export function sessionCookie(token: string, maxAgeSeconds: number): string {
  if (!isSessionToken(token) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new RangeError('Invalid session cookie.');
  }
  return `${sessionCookieName}=${token}; ${attributes}; Max-Age=${maxAgeSeconds}`;
}

export function expiredSessionCookie(): string {
  return `${sessionCookieName}=; ${attributes}; Max-Age=0`;
}
