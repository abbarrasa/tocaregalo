import { normalizedName } from './validation.ts';

export type Group = Readonly<{
  id: string; name: string; ownerAccountId: string; createdAtMs: number;
}>;

export class GroupInputError extends Error {
  constructor() { super('Invalid group input.'); this.name = 'GroupInputError'; }
}

export function groupNameInput(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || !('name' in value) || typeof value.name !== 'string') throw new GroupInputError();
  try { return normalizedName(value.name); }
  catch (error) {
    if (error instanceof RangeError) throw new GroupInputError();
    throw error;
  }
}

export type GroupPageInput = Readonly<{ limit: number; cursor: string | null }>;

export function groupPageInput(limit: string | null, cursor: string | null): GroupPageInput {
  if (limit !== null && !/^[1-9][0-9]?$/.test(limit)) throw new GroupInputError();
  const size = limit === null ? 20 : Number(limit);
  if (size > 50 || (cursor !== null && (!cursor.trim() || cursor.length > 512))) throw new GroupInputError();
  return { limit: size, cursor };
}
