import type { DrawDatabase } from './d1.ts';
import { normalizedName, requireId, requireTimestamp } from './accounts-repository.ts';

export class GroupAccessError extends Error {
  constructor() { super('Group operation unavailable.'); this.name = 'GroupAccessError'; }
}

export type Group = Readonly<{
  id: string; name: string; ownerAccountId: string; createdAtMs: number;
}>;
export type GroupEvent = Readonly<{
  id: string; groupId: string; closureAtMs: number | null; createdAtMs: number;
}>;

// All actorAccountId values must come from a verified session.
// Ownership is derived from groups, never accepted as a caller-provided role.
export class GroupsRepository {
  private readonly db: DrawDatabase;
  constructor(db: DrawDatabase) { this.db = db; }

  async create(actorAccountId: string, group: Omit<Group, 'ownerAccountId'>): Promise<void> {
    requireId(actorAccountId);
    requireId(group.id);
    requireTimestamp(group.createdAtMs);
    await this.db.batch([
      this.db.prepare('INSERT INTO groups (id, name, owner_account_id, created_at_ms) VALUES (?, ?, ?, ?)')
        .bind(group.id, normalizedName(group.name), actorAccountId, group.createdAtMs),
      this.db.prepare('INSERT INTO group_members (group_id, account_id, joined_at_ms) VALUES (?, ?, ?)')
        .bind(group.id, actorAccountId, group.createdAtMs),
    ]);
  }

  async findForAccount(groupId: string, actorAccountId: string): Promise<Group | null> {
    return this.db.prepare(`SELECT g.id, g.name, g.owner_account_id AS ownerAccountId,
      g.created_at_ms AS createdAtMs FROM groups g JOIN group_members m ON m.group_id = g.id
      WHERE g.id = ? AND m.account_id = ?`).bind(groupId, actorAccountId).first<Group>();
  }

  // Internal provisioning after acceptance of an invitation (invitation flow is pending).
  async addMember(groupId: string, actorAccountId: string, accountId: string, joinedAtMs: number): Promise<void> {
    requireId(accountId);
    requireTimestamp(joinedAtMs);
    const added = await this.db.prepare(`INSERT INTO group_members (group_id, account_id, joined_at_ms)
      SELECT id, ?, ? FROM groups WHERE id = ? AND owner_account_id = ?
      RETURNING account_id`).bind(accountId, joinedAtMs, groupId, actorAccountId).first();
    if (!added) throw new GroupAccessError();
  }

  // Idempotent for missing memberships. The owner cannot be removed.
  async removeMember(groupId: string, actorAccountId: string, accountId: string): Promise<boolean> {
    const removed = await this.db.prepare(`DELETE FROM group_members
      WHERE group_id = ? AND account_id = ? AND EXISTS (
        SELECT 1 FROM groups g WHERE g.id = group_members.group_id
        AND g.owner_account_id = ? AND g.owner_account_id <> group_members.account_id
      ) RETURNING account_id`).bind(groupId, accountId, actorAccountId).first();
    return removed !== null;
  }

  async createEvent(actorAccountId: string, event: GroupEvent): Promise<void> {
    requireId(event.id);
    requireTimestamp(event.createdAtMs);
    if (event.closureAtMs !== null) requireTimestamp(event.closureAtMs);
    const created = await this.db.prepare(`INSERT INTO events (id, group_id, closure_at_ms, created_at_ms)
      SELECT ?, id, ?, ? FROM groups WHERE id = ? AND owner_account_id = ?
      RETURNING id`).bind(event.id, event.closureAtMs, event.createdAtMs, event.groupId, actorAccountId).first();
    if (!created) throw new GroupAccessError();
  }

  async findEventForAccount(eventId: string, actorAccountId: string): Promise<GroupEvent | null> {
    return this.db.prepare(`SELECT e.id, e.group_id AS groupId, e.closure_at_ms AS closureAtMs,
      e.created_at_ms AS createdAtMs FROM events e JOIN group_members m ON m.group_id = e.group_id
      WHERE e.id = ? AND m.account_id = ?`).bind(eventId, actorAccountId).first<GroupEvent>();
  }
}
