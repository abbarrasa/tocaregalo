import { ApiError, isRecord, readJson, type HttpClient } from './http-client.ts';

export type OwnRecipient = Readonly<{ drawId: string; recipient: Readonly<{ accountId: string; displayName: string }> }>;
export interface RecipientClient { find(eventId: string): Promise<OwnRecipient> }
export function recipientClientFor(http: HttpClient): RecipientClient {
  return {
    async find(eventId) {
      const value = await readJson(await http.request('/api/events/' + encodeURIComponent(eventId) + '/recipient'));
      if (!isRecord(value) || typeof value.drawId !== 'string' || !value.drawId.trim() || !isRecord(value.recipient)
        || typeof value.recipient.accountId !== 'string' || !value.recipient.accountId.trim()
        || typeof value.recipient.displayName !== 'string' || !value.recipient.displayName.trim()) throw new ApiError(502);
      return { drawId: value.drawId, recipient: { accountId: value.recipient.accountId, displayName: value.recipient.displayName } };
    },
  };
}
