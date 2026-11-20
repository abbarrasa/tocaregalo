import { pageInput, PaginationInputError, type PageInput } from './pagination.ts';

export type GroupMember = Readonly<{
  accountId: string; displayName: string; joinedAtMs: number; isOwner: boolean;
}>;
export type MemberRemovalResult = 'ok' | 'not-found' | 'owner-protected';

export class MemberInputError extends Error {
  constructor() { super('Invalid member input.'); this.name = 'MemberInputError'; }
}

export function memberPageInput(limit: string | null, cursor: string | null): PageInput {
  try { return pageInput(limit, cursor); }
  catch (error) {
    if (error instanceof PaginationInputError) throw new MemberInputError();
    throw error;
  }
}
