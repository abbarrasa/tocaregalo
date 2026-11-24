import { normalizedName } from './validation.ts';

export class AuthInputError extends Error {
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string> = {}) {
    super('Invalid authentication input.');
    this.name = 'AuthInputError';
    this.fields = fields;
  }
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

export function normalizeLoginIdentifier(value: string, defaultPrefix = '+34'): string {
  if (value.includes('@')) return normalizeEmail(value);
  return normalizeNationalOrInternationalPhone(value, defaultPrefix);
}

export function normalizeNationalOrInternationalPhone(value: string, defaultPrefix = '+34'): string {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s()-]/g, '');
  const prefix = /^\+[1-9][0-9]{0,14}$/.test(defaultPrefix) ? defaultPrefix : '+34';
  if (compact.startsWith('+')) return normalizePhone(compact);
  if (!/^\d+$/.test(compact)) throw new AuthInputError();
  if (compact.startsWith('34') && compact.length === 11) return normalizePhone('+' + compact);
  if (compact.startsWith(prefix.slice(1)) && compact.length > 4) return normalizePhone('+' + compact);
  if (compact.length >= 6 && compact.length <= 15) return normalizePhone(prefix + compact);
  throw new AuthInputError();
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
  const fields: Record<string, string> = {};
  let email = '';
  let password = '';
  let displayName = '';
  let lastName: string | null = null;
  let phone: string | null = null;
  try { displayName = name(input.name); } catch { fields.name = 'El nombre debe tener entre 1 y 100 caracteres.'; }
  try { email = normalizeEmail(text(input.email)); } catch { fields.email = 'Introduce un correo electrónico válido.'; }
  try { password = passwordInput(input.password); } catch { fields.password = 'La contraseña debe tener al menos seis caracteres.'; }
  try {
    lastName = input.lastName === undefined || input.lastName === null || input.lastName === ''
      ? null : name(input.lastName);
  } catch { fields.lastName = 'Los apellidos deben tener como máximo 100 caracteres.'; }
  try {
    phone = input.phone === undefined || input.phone === null || input.phone === ''
      ? null : normalizePhone(text(input.phone));
  } catch { fields.phone = 'Introduce un teléfono internacional válido que empiece por +.'; }
  if (Object.keys(fields).length) throw new AuthInputError(fields);
  return { email, password, name: displayName, lastName, phone };
}

export function loginInput(value: unknown, defaultPrefix = '+34'): { identifier: string; password: string } {
  const input = authObject(value);
  return { identifier: normalizeLoginIdentifier(text(input.identifier), defaultPrefix), password: passwordInput(input.password) };
}

export type ProfileUpdate = Readonly<{
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  currentPassword: string | null;
  newPassword: string | null;
}>;

export function profileUpdateInput(value: unknown): ProfileUpdate {
  const input = authObject(value);
  const fields: Record<string, string> = {};
  let displayName = '';
  let lastName: string | null = null;
  let email = '';
  let phone: string | null = null;
  let newPassword: string | null = null;
  let currentPassword: string | null = null;
  try { displayName = name(input.name); } catch { fields.name = 'El nombre debe tener entre 1 y 100 caracteres.'; }
  try {
    lastName = input.lastName === undefined || input.lastName === null || input.lastName === ''
      ? null : name(input.lastName);
  } catch { fields.lastName = 'Los apellidos deben tener como máximo 100 caracteres.'; }
  try { email = normalizeEmail(text(input.email)); } catch { fields.email = 'Introduce un correo electrónico válido.'; }
  try {
    phone = input.phone === undefined || input.phone === null || input.phone === ''
      ? null : normalizePhone(text(input.phone));
  } catch { fields.phone = 'Introduce un teléfono internacional válido que empiece por +.'; }
  try {
    newPassword = input.newPassword === undefined || input.newPassword === null || input.newPassword === ''
      ? null : passwordInput(input.newPassword);
  } catch { fields.newPassword = 'La nueva contraseña debe tener al menos seis caracteres.'; }
  try {
    currentPassword = input.currentPassword === undefined || input.currentPassword === null
      ? null : text(input.currentPassword);
  } catch { fields.currentPassword = 'Introduce la contraseña actual.'; }
  if (newPassword !== null && currentPassword === null) fields.currentPassword = 'Introduce la contraseña actual.';
  if (Object.keys(fields).length) throw new AuthInputError(fields);
  return { name: displayName, lastName, email, phone, currentPassword, newPassword };
}
