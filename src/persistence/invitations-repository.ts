import type { InvitationStore } from '../application/invitation-service.ts';
import type { InvitationManagementStore } from '../application/invitation-management-service.ts';
import type { InvitationRecord } from '../domain/invitations.ts';
import type { PersistenceDatabase } from './d1.ts';

export class InvitationsRepository implements InvitationStore, InvitationManagementStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async isOwner(groupId: string, actorAccountId: string): Promise<boolean> {
    return !!await this.db.prepare('SELECT id FROM groups WHERE id = ? AND owner_account_id = ?')
      .bind(groupId, actorAccountId).first();
  }

  async issue(groupId: string, actorAccountId: string, email: string, tokenHash: string, createdAtMs: number, expiresAtMs: number) {
    return this.db.prepare(`INSERT INTO group_invitations
      (group_id, email, inviter_account_id, token_hash, created_at_ms, expires_at_ms, consumption_id)
      SELECT id, ?, owner_account_id, ?, ?, ?, NULL FROM groups WHERE id = ? AND owner_account_id = ?
      ON CONFLICT(group_id, email) DO UPDATE SET inviter_account_id = excluded.inviter_account_id,
        token_hash = excluded.token_hash, created_at_ms = excluded.created_at_ms,
        expires_at_ms = excluded.expires_at_ms, consumption_id = NULL
      RETURNING (SELECT name FROM groups WHERE id = group_invitations.group_id) AS groupName`)
      .bind(email, tokenHash, createdAtMs, expiresAtMs, groupId, actorAccountId).first<{ groupName: string }>();
  }

  async invalidate(tokenHash: string): Promise<void> {
    // A late failed send cannot delete a newer invitation to the same recipient.
    await this.db.batch([this.db.prepare('DELETE FROM group_invitations WHERE token_hash = ?').bind(tokenHash)]);
  }

  async listForOwner(groupId: string, actorAccountId: string, limit: number, afterEmail: string | null): Promise<InvitationRecord[] | null> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 51) throw new RangeError('Invalid invitation page size.');
    const after = afterEmail === null ? '' : 'AND i.email > ?';
    const statement = this.db.prepare(`SELECT i.email, i.created_at_ms AS createdAtMs,
      i.expires_at_ms AS expiresAtMs, (i.consumption_id IS NOT NULL) AS accepted
      FROM groups g LEFT JOIN group_invitations i ON i.group_id = g.id ${after}
      WHERE g.id = ? AND g.owner_account_id = ? ORDER BY i.email LIMIT ?`);
    const values = afterEmail === null ? [groupId, actorAccountId, limit] : [afterEmail, groupId, actorAccountId, limit];
    const { results } = await statement.bind(...values).all<{
      email: string | null; createdAtMs: number | null; expiresAtMs: number | null; accepted: number;
    }>();
    if (results.length === 0) return null;
    return results.flatMap(row => {
      if (row.email === null) return [];
      if (row.createdAtMs === null || row.expiresAtMs === null) throw new Error('Invalid persisted invitation.');
      return [{ email: row.email, createdAtMs: row.createdAtMs, expiresAtMs: row.expiresAtMs, accepted: row.accepted === 1 }];
    });
  }

  async revokeForOwner(groupId: string, actorAccountId: string, email: string, nowMs: number): Promise<boolean> {
    const result = await this.db.batch([
      this.db.prepare('SELECT id FROM groups WHERE id = ? AND owner_account_id = ?').bind(groupId, actorAccountId),
      this.db.prepare(`DELETE FROM group_invitations WHERE group_id = ? AND email = ?
        AND consumption_id IS NULL AND created_at_ms <= ? AND expires_at_ms > ?
        AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_invitations.group_id AND g.owner_account_id = ?)`)
        .bind(groupId, email, nowMs, nowMs, actorAccountId),
    ]);
    // The read shares the transaction with the protected delete, including idempotent no-op cases.
    return result[0].results.length === 1;
  }

  async consume(tokenHash: string, actorAccountId: string, nowMs: number): Promise<boolean> {
    const operationId = crypto.randomUUID();
    const result = await this.db.batch([
      this.db.prepare(`UPDATE group_invitations SET consumption_id = ?
        WHERE token_hash = ? AND consumption_id IS NULL AND created_at_ms <= ? AND expires_at_ms > ?
        AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = ? AND a.email = group_invitations.email)
        AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_invitations.group_id
          AND g.owner_account_id = group_invitations.inviter_account_id)
        RETURNING group_id`).bind(operationId, tokenHash, nowMs, nowMs, actorAccountId),
      this.db.prepare(`INSERT INTO group_members (group_id, account_id, joined_at_ms)
        SELECT group_id, ?, ? FROM group_invitations WHERE token_hash = ? AND consumption_id = ?
        ON CONFLICT(group_id, account_id) DO NOTHING`).bind(actorAccountId, nowMs, tokenHash, operationId),
    ]);
    return result[0].results.length === 1;
  }
}
