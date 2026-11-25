import type { MemberStore } from '../application/member-service.ts';
import type { GroupMember, MemberRemovalResult } from '../domain/members.ts';
import type { PersistenceDatabase } from './d1.ts';

export class MembersRepository implements MemberStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async listForMember(groupId: string, actorAccountId: string, limit: number, afterAccountId: string | null): Promise<GroupMember[] | null> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 51) throw new RangeError('Invalid member page size.');
    const after = afterAccountId === null ? '' : 'AND m.account_id > ?';
    const statement = this.db.prepare(`SELECT m.account_id AS accountId, a.display_name AS displayName,
      m.joined_at_ms AS joinedAtMs, (m.account_id = g.owner_account_id) AS isOwner
      FROM group_members actor JOIN groups g ON g.id = actor.group_id
      LEFT JOIN group_members m ON m.group_id = g.id ${after}
      LEFT JOIN accounts a ON a.id = m.account_id
      WHERE actor.group_id = ? AND actor.account_id = ? ORDER BY m.account_id LIMIT ?`);
    const values = afterAccountId === null ? [groupId, actorAccountId, limit] : [afterAccountId, groupId, actorAccountId, limit];
    const { results } = await statement.bind(...values).all<{
      accountId: string | null; displayName: string | null; joinedAtMs: number | null; isOwner: number | null;
    }>();
    if (results.length === 0) return null;
    return results.flatMap(row => {
      if (row.accountId === null) return [];
      if (row.displayName === null || row.joinedAtMs === null) throw new Error('Invalid persisted membership.');
      return [{ accountId: row.accountId, displayName: row.displayName, joinedAtMs: row.joinedAtMs, isOwner: row.isOwner === 1 }];
    });
  }

  async removeForOwner(groupId: string, actorAccountId: string, accountId: string, nowMs: number): Promise<MemberRemovalResult> {
    // Cancel pending invitations first, even if acceptance is racing an idempotent removal.
    // Both protected mutations and the no-op authorization read share one D1 transaction.
    const result = await this.db.batch([
      this.db.prepare('SELECT id FROM groups WHERE id = ? AND owner_account_id = ?').bind(groupId, actorAccountId),
      this.db.prepare(`DELETE FROM group_invitations WHERE group_id = ?
        AND email = (SELECT email FROM accounts WHERE id = ?)
        AND consumption_id IS NULL AND expires_at_ms > ?
        AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_invitations.group_id
          AND g.owner_account_id = ? AND g.owner_account_id <> ?)`)
        .bind(groupId, accountId, nowMs, actorAccountId, accountId),
      this.db.prepare(`DELETE FROM group_members WHERE group_id = ? AND account_id = ?
        AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id
          AND g.owner_account_id = ? AND g.owner_account_id <> group_members.account_id)`)
        .bind(groupId, accountId, actorAccountId),
    ]);
    if (result[0].results.length === 0) return 'not-found';
    return actorAccountId === accountId ? 'owner-protected' : 'ok';
  }
}
