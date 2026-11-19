import { normalizeEmail } from '../domain/authentication.ts';
import { invitationStatus, type InvitationRecord } from '../domain/invitations.ts';
import type { PageInput } from '../domain/pagination.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface InvitationManagementStore {
  listForOwner(groupId: string, actorAccountId: string, limit: number, afterEmail: string | null): Promise<InvitationRecord[] | null>;
  revokeForOwner(groupId: string, actorAccountId: string, email: string, nowMs: number): Promise<boolean>;
}

export class InvitationManagementService {
  private readonly store: InvitationManagementStore;
  private readonly now: () => number;
  constructor(store: InvitationManagementStore, now = Date.now) { this.store = store; this.now = now; }

  async list(actorAccountId: string, groupId: string, page: PageInput) {
    const nowMs = this.now(); requireTimestamp(nowMs);
    const rows = await this.store.listForOwner(groupId, actorAccountId, page.limit + 1, page.cursor);
    if (rows === null) return null;
    const invitations = rows.slice(0, page.limit).map(row => ({
      email: row.email, createdAtMs: row.createdAtMs, expiresAtMs: row.expiresAtMs,
      status: invitationStatus(row.accepted, row.expiresAtMs, nowMs),
    }));
    return { invitations, nextCursor: rows.length > page.limit ? invitations[invitations.length - 1].email : null };
  }

  async revoke(actorAccountId: string, groupId: string, email: string): Promise<boolean> {
    const nowMs = this.now(); requireTimestamp(nowMs);
    return this.store.revokeForOwner(groupId, actorAccountId, normalizeEmail(email), nowMs);
  }
}
