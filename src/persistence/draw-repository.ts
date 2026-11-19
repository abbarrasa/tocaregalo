import { encryptRecipient, type RecipientKey, type RecipientEnvelope } from '../domain/recipient-protection.ts';
import type { Assignment } from '../domain/draw.ts';
import type { DrawDatabase } from './d1.ts';

type SaveDraw = Readonly<{
  id: string;
  eventId: string;
  createdAtMs: number;
  assignments: readonly Assignment[];
}>;

type EnvelopeRow = { key_id: string; iv: number[]; ciphertext: number[]; recipient_index: number[] };

function decodeEnvelope(row: EnvelopeRow | null): RecipientEnvelope | null {
  if (!row) return null;
  // D1 returns BLOB columns as arrays of bytes.
  return {
    keyId: row.key_id,
    iv: new Uint8Array(row.iv),
    ciphertext: new Uint8Array(row.ciphertext).buffer,
    recipientIndex: new Uint8Array(row.recipient_index).buffer,
  };
}

function validate(draw: SaveDraw): void {
  const givers = new Set(draw.assignments.map(a => a.giverId));
  const recipients = new Set(draw.assignments.map(a => a.recipientId));
  if (!draw.id || !draw.eventId || !Number.isSafeInteger(draw.createdAtMs)
    || givers.size < 3 || givers.size !== draw.assignments.length
    || recipients.size !== givers.size
    || draw.assignments.some(a => !a.giverId || !givers.has(a.recipientId) || a.giverId === a.recipientId)) {
    throw new RangeError('Invalid draw snapshot.');
  }
}

export class DrawRepository {
  private readonly db: DrawDatabase;
  constructor(db: DrawDatabase) { this.db = db; }

  async findByEvent(eventId: string): Promise<{ id: string; createdAtMs: number } | null> {
    return this.db.prepare('SELECT id, created_at_ms AS createdAtMs FROM draws WHERE event_id = ?')
      .bind(eventId).first();
  }

  // A duplicate event/draw fails instead of replacing a previously committed draw.
  // Callers retry by reading findByEvent, never by overwriting assignments.
  async save(draw: SaveDraw, key: RecipientKey): Promise<void> {
    validate(draw);
    const envelopes = await Promise.all(draw.assignments.map(a =>
      encryptRecipient(key, { drawId: draw.id, giverId: a.giverId }, a.recipientId)));
    const statements = [this.db.prepare(
      'INSERT INTO draws (id, event_id, created_at_ms) VALUES (?, ?, ?)',
    ).bind(draw.id, draw.eventId, draw.createdAtMs)];
    for (const [i, assignment] of draw.assignments.entries()) {
      const envelope = envelopes[i];
      statements.push(this.db.prepare(
        'INSERT INTO draw_participants (draw_id, member_id) VALUES (?, ?)',
      ).bind(draw.id, assignment.giverId));
      statements.push(this.db.prepare(
        'INSERT INTO assignments (draw_id, giver_id, key_id, iv, ciphertext, recipient_index) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(draw.id, assignment.giverId, envelope.keyId, envelope.iv,
        envelope.ciphertext, envelope.recipientIndex));
    }
    await this.db.batch(statements);
  }

  // Authorization must be performed by the API before calling this method.
  async findRecipient(drawId: string, giverId: string): Promise<RecipientEnvelope | null> {
    const row = await this.db.prepare(
      'SELECT key_id, iv, ciphertext, recipient_index FROM assignments WHERE draw_id = ? AND giver_id = ?',
    ).bind(drawId, giverId).first<EnvelopeRow>();
    return decodeEnvelope(row);
  }

  // For the future authenticated API: only the session's own assignment is returned,
  // and only while the account remains a member of the event's group.
  async findRecipientForAccount(drawId: string, actorAccountId: string): Promise<RecipientEnvelope | null> {
    const row = await this.db.prepare(`SELECT a.key_id, a.iv, a.ciphertext, a.recipient_index
      FROM assignments a JOIN draws d ON d.id = a.draw_id
      JOIN events e ON e.id = d.event_id
      JOIN group_members m ON m.group_id = e.group_id AND m.account_id = a.giver_id
      WHERE a.draw_id = ? AND a.giver_id = ?`).bind(drawId, actorAccountId).first<EnvelopeRow>();
    return decodeEnvelope(row);
  }
}
