import type { GroupMember, MemberRemovalResult } from '../domain/members.ts';
import type { PageInput } from '../domain/pagination.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface MemberStore {
  listForMember(groupId: string, actorAccountId: string, limit: number, afterAccountId: string | null): Promise<GroupMember[] | null>;
  removeForOwner(groupId: string, actorAccountId: string, accountId: string, nowMs: number): Promise<MemberRemovalResult>;
}

export class MemberService {
  private readonly store: MemberStore;
  private readonly now: () => number;
  constructor(store: MemberStore, now = Date.now) { this.store = store; this.now = now; }

  async list(actorAccountId: string, groupId: string, page: PageInput) {
    const rows = await this.store.listForMember(groupId, actorAccountId, page.limit + 1, page.cursor);
    if (rows === null) return null;
    const members = rows.slice(0, page.limit);
    return { members, nextCursor: rows.length > page.limit ? members[members.length - 1].accountId : null };
  }

  async remove(actorAccountId: string, groupId: string, accountId: string): Promise<MemberRemovalResult> {
    const nowMs = this.now(); requireTimestamp(nowMs);
    return this.store.removeForOwner(groupId, actorAccountId, accountId, nowMs);
  }
}
