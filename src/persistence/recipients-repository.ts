import type { RecipientResult, RecipientSelection, RecipientStore } from '../application/recipient-service.ts';
import type { PersistenceDatabase } from './d1.ts';

// Same validity predicate for envelope selection and the post-decryption recheck.
const validDraw = `d.id IS NOT NULL AND d.membership_revision = e.draw_membership_revision
  AND (e.closed_at_ms IS NOT NULL OR e.draw_membership_revision = g.membership_revision)`;
const scopedAssignment = `FROM events e JOIN groups g ON g.id = e.group_id
  JOIN group_members actor ON actor.group_id = e.group_id AND actor.account_id = ?
  LEFT JOIN draws d ON d.id = e.current_draw_id AND d.event_id = e.id
  LEFT JOIN assignments a ON a.draw_id = d.id AND a.giver_id = actor.account_id AND (${validDraw})`;

export class RecipientsRepository implements RecipientStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async select(eventId: string, actorAccountId: string): Promise<RecipientSelection> {
    const row = await this.db.prepare(`SELECT d.id AS drawId, (${validDraw}) AS valid,
      a.giver_id AS giverId, a.key_id AS keyId, a.iv, a.ciphertext, a.recipient_index AS recipientIndex
      ${scopedAssignment} WHERE e.id = ?`).bind(actorAccountId, eventId).first<{
      drawId: string | null; valid: number; giverId: string | null; keyId: string | null;
      iv: number[] | null; ciphertext: number[] | null; recipientIndex: number[] | null;
    }>();
    if (!row) return { kind: 'not-found' };
    if (row.valid !== 1) return { kind: 'pending' };
    if (row.giverId === null) return { kind: 'not-found' };
    if (row.drawId === null || row.keyId === null || row.iv === null || row.ciphertext === null || row.recipientIndex === null) {
      throw new Error('Invalid persisted assignment.');
    }
    return { kind: 'ready', drawId: row.drawId, envelope: { keyId: row.keyId,
      iv: new Uint8Array(row.iv), ciphertext: new Uint8Array(row.ciphertext).buffer,
      recipientIndex: new Uint8Array(row.recipientIndex).buffer } };
  }

  async resolve(eventId: string, actorAccountId: string, drawId: string, recipientId: string): Promise<RecipientResult> {
    const row = await this.db.prepare(`SELECT d.id AS drawId, (${validDraw}) AS valid,
      a.giver_id AS giverId, recipient.id AS accountId, recipient.display_name AS displayName
      ${scopedAssignment}
      LEFT JOIN accounts recipient ON recipient.id = ? AND EXISTS (
        SELECT 1 FROM draw_participants p WHERE p.draw_id = d.id AND p.member_id = recipient.id)
      WHERE e.id = ?`).bind(actorAccountId, recipientId, eventId).first<{
      drawId: string | null; valid: number; giverId: string | null;
      accountId: string | null; displayName: string | null;
    }>();
    if (!row) return { kind: 'not-found' };
    if (row.valid !== 1) return { kind: 'pending' };
    if (row.giverId === null) return { kind: 'not-found' };
    if (row.drawId !== drawId) return { kind: 'pending' };
    if (row.accountId === null || row.displayName === null) throw new Error('Invalid persisted recipient.');
    return { kind: 'ok', drawId, recipient: { accountId: row.accountId, displayName: row.displayName } };
  }
}
