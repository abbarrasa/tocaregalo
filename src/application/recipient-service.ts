import { decryptRecipient, type RecipientDecryptionKey, type RecipientEnvelope } from '../domain/recipient-protection.ts';

export type RecipientSelection =
  | { kind: 'not-found' | 'pending' }
  | { kind: 'ready'; drawId: string; envelope: RecipientEnvelope };
export type RecipientResult =
  | { kind: 'not-found' | 'pending' }
  | { kind: 'ok'; drawId: string; recipient: { accountId: string; displayName: string } };

export interface RecipientStore {
  select(eventId: string, actorAccountId: string): Promise<RecipientSelection>;
  // Recheck membership, participation and the current version after asynchronous decryption.
  resolve(eventId: string, actorAccountId: string, drawId: string, recipientId: string): Promise<RecipientResult>;
}

export class RecipientService {
  private readonly store: RecipientStore;
  private readonly key: (id: string) => Promise<RecipientDecryptionKey>;
  constructor(store: RecipientStore, key: (id: string) => Promise<RecipientDecryptionKey>) {
    this.store = store; this.key = key;
  }

  async find(actorAccountId: string, eventId: string): Promise<RecipientResult> {
    const selection = await this.store.select(eventId, actorAccountId);
    if (selection.kind !== 'ready') return selection;
    const key = await this.key(selection.envelope.keyId);
    const recipientId = await decryptRecipient(new Map([[key.id, key]]),
      { drawId: selection.drawId, giverId: actorAccountId }, selection.envelope);
    if (!recipientId.trim() || recipientId === actorAccountId) throw new Error('Invalid recipient assignment.');
    return this.store.resolve(eventId, actorAccountId, selection.drawId, recipientId);
  }
}
