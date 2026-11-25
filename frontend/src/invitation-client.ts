import { ApiError, isRecord, readJson, type HttpClient } from './http-client.ts';
import { pageQuery, parsePage, type Page } from './pagination.ts';

export type Invitation = Readonly<{
  email: string; createdAtMs: number; expiresAtMs: number; status: 'pending' | 'expired' | 'accepted';
}>;
export interface InvitationClient {
  list(groupId: string, cursor: string | null): Promise<Page<Invitation>>;
  send(groupId: string, email: string): Promise<void>;
  revoke(groupId: string, email: string): Promise<void>;
  accept(token: string): Promise<void>;
}
function invitation(value: unknown): Invitation {
  if (!isRecord(value) || typeof value.email !== 'string' || !value.email.trim()
    || typeof value.createdAtMs !== 'number' || !Number.isSafeInteger(value.createdAtMs)
    || typeof value.expiresAtMs !== 'number' || !Number.isSafeInteger(value.expiresAtMs)
    || (value.status !== 'pending' && value.status !== 'expired' && value.status !== 'accepted')) throw new ApiError(502);
  return { email: value.email, createdAtMs: value.createdAtMs, expiresAtMs: value.expiresAtMs, status: value.status };
}
export function invitationClientFor(http: HttpClient): InvitationClient {
  const path = (id: string) => '/api/groups/' + encodeURIComponent(id) + '/invitations';
  async function mutate(url: string, body: unknown, method?: 'DELETE') {
    const response = await http.request(url, body, true, method); await response.body?.cancel();
  }
  return {
    async list(id, cursor) { return parsePage(await readJson(await http.request(path(id) + pageQuery(cursor))), 'invitations', invitation, cursor); },
    async send(id, email) { await mutate(path(id), { email }); },
    async revoke(id, email) { await mutate(path(id), { email }, 'DELETE'); },
    async accept(token) { await mutate('/api/invitations/accept', { token }); },
  };
}
