import { authClientFor } from './api.ts';
import { groupClientFor } from './group-client.ts';
import { createHttpClient } from './http-client.ts';
import { invitationClientFor } from './invitation-client.ts';

export function createClients(send: typeof fetch = fetch.bind(globalThis)) {
  const http = createHttpClient(send);
  return { auth: authClientFor(http), groups: groupClientFor(http), invitations: invitationClientFor(http) };
}
