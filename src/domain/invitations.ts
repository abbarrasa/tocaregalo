import { AuthInputError, normalizeEmail } from './authentication.ts';

export const invitationLifetimeMs = 7 * 24 * 60 * 60_000;

export function invitationEmailInput(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || !('email' in value) || typeof value.email !== 'string') throw new AuthInputError();
  return normalizeEmail(value.email);
}

export function createInvitationToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}

export function isInvitationToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export async function hashInvitationToken(token: string): Promise<string> {
  if (!isInvitationToken(token)) throw new RangeError('Invalid invitation token.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tocaregalo/group-invitation/v1:' + token));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
