import { normalizedName } from './validation.ts';
import { pageInput, PaginationInputError, type PageInput } from './pagination.ts';

export type Group = Readonly<{
  id: string; name: string; ownerAccountId: string; createdAtMs: number;
}>;

export class GroupAccessError extends Error {
  constructor() { super('Group operation unavailable.'); this.name = 'GroupAccessError'; }
}

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

export type GroupPageInput = PageInput;

export function groupPageInput(limit: string | null, cursor: string | null): GroupPageInput {
  try { return pageInput(limit, cursor); }
  catch (error) {
    if (error instanceof PaginationInputError) throw new GroupInputError();
    throw error;
  }
}
