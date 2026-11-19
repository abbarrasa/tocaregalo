import { normalizedName } from './validation.ts';

export class AuthInputError extends Error {
  constructor() { super('Invalid authentication input.'); this.name = 'AuthInputError'; }
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthInputError();
  return email;
}

export function normalizePhone(value: string): string {
  const phone = value.trim().replace(/[\s()-]/g, '');
  if (!/^\+[1-9][0-9]{1,14}$/.test(phone)) throw new AuthInputError();
  return phone;
}

export function normalizeLoginIdentifier(value: string): string {
  return value.includes('@') ? normalizeEmail(value) : normalizePhone(value);
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new AuthInputError();
  return value;
}

function name(value: unknown): string {
  const string = text(value);
  try { return normalizedName(string); } catch (error) {
    if (error instanceof RangeError) throw new AuthInputError();
    throw error;
  }
}

export function passwordInput(value: unknown): string {
  const password = text(value);
  // The only password policy: at least six Unicode code points. Never trim it.
  let count = 0;
  for (const _character of password) { if (++count === 6) return password; }
  throw new AuthInputError();
}

export function authObject(value: unknown): Record<string, unknown> {
  if (!isAuthObject(value)) throw new AuthInputError();
  return value;
}

function isAuthObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type Registration = Readonly<{
  email: string; password: string; name: string; lastName: string | null; phone: string | null;
}>;

export function registrationInput(value: unknown): Registration {
  const input = authObject(value);
  const lastName = input.lastName === undefined || input.lastName === null || input.lastName === ''
    ? null : name(input.lastName);
  const phone = input.phone === undefined || input.phone === null || input.phone === ''
    ? null : normalizePhone(text(input.phone));
  return { email: normalizeEmail(text(input.email)), password: passwordInput(input.password),
    name: name(input.name), lastName, phone };
}

export function loginInput(value: unknown): { identifier: string; password: string } {
  const input = authObject(value);
  return { identifier: normalizeLoginIdentifier(text(input.identifier)), password: passwordInput(input.password) };
}
