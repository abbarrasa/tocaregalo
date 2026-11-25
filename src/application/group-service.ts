import type { Group, GroupPageInput } from '../domain/groups.ts';
import { normalizedName } from '../domain/validation.ts';

export interface GroupStore {
  create(actorAccountId: string, group: Omit<Group, 'ownerAccountId'>): Promise<void>;
  findForAccount(groupId: string, actorAccountId: string): Promise<Group | null>;
  listForAccount(actorAccountId: string, limit: number, afterId: string | null): Promise<Group[]>;
}

export class GroupService {
  private readonly store: GroupStore;
  private readonly now: () => number;
  constructor(store: GroupStore, now = Date.now) { this.store = store; this.now = now; }

  async create(actorAccountId: string, name: string): Promise<Group> {
    const group = { id: crypto.randomUUID(), name: normalizedName(name), createdAtMs: this.now(), ownerAccountId: actorAccountId };
    await this.store.create(actorAccountId, group);
    return group;
  }

  async find(actorAccountId: string, groupId: string): Promise<Group | null> {
    return this.store.findForAccount(groupId, actorAccountId);
  }

  async list(actorAccountId: string, page: GroupPageInput) {
    const rows = await this.store.listForAccount(actorAccountId, page.limit + 1, page.cursor);
    const groups = rows.slice(0, page.limit);
    return { groups, nextCursor: rows.length > page.limit ? groups[groups.length - 1].id : null };
  }
}
