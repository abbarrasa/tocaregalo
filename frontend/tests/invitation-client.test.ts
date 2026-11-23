import { describe, expect, it } from 'vitest';
import { createClients } from '../src/clients.ts';

const account = { id: 'self', email: 'self@example.test', displayName: 'Self', lastName: null, phone: null, emailVerifiedAtMs: null };
const invitation = { email: 'guest@example.test', createdAtMs: 1, expiresAtMs: 1000, status: 'pending' };
describe('invitation HTTP contract', () => {
  it('shares the authenticated CSRF proof and uses fixed POST/DELETE bodies without identity overrides', async () => {
    const requests: Array<{ path: string; options: RequestInit }> = [];
    const clients = createClients(async (path, options = {}) => {
      requests.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account, csrfToken: 'proof' });
      if (options.method === 'GET') return Response.json({ invitations: [invitation], nextCursor: null });
      return new Response(null, { status: options.method === 'POST' && path !== '/api/invitations/accept' ? 202 : 204 });
    });
    await expect(clients.invitations.send('group', invitation.email)).rejects.toMatchObject({ status: 401 });
    await clients.auth.me();
    await clients.invitations.list('group /?', 'a+b@example.test');
    await clients.invitations.send('group /?', invitation.email);
    await clients.invitations.revoke('group /?', invitation.email);
    await clients.invitations.accept('a'.repeat(64));
    expect(requests[1].path).toBe('/api/groups/group%20%2F%3F/invitations?limit=20&cursor=a%2Bb%40example.test');
    expect(new Headers(requests[1].options.headers).has('X-CSRF-Token')).toBe(false);
    expect(requests[2].options.method).toBe('POST'); expect(requests[3].options.method).toBe('DELETE');
    expect(requests[2].options.body).toBe(JSON.stringify({ email: invitation.email }));
    expect(requests[3].options.body).toBe(JSON.stringify({ email: invitation.email }));
    expect(requests[4].path).toBe('/api/invitations/accept');
    expect(requests[4].options.body).toBe(JSON.stringify({ token: 'a'.repeat(64) }));
    for (const request of requests.slice(2)) {
      expect(new Headers(request.options.headers).get('X-CSRF-Token')).toBe('proof');
      expect(request.options.credentials).toBe('same-origin'); expect(request.options.cache).toBe('no-store');
    }
  });
  it('selects only administration fields and rejects invalid status/date/cursor and oversized pages', async () => {
    let value: unknown = { invitations: [{ ...invitation, token_hash: 'private', consumption_id: 'private' }], nextCursor: null };
    const clients = createClients(async () => Response.json(value));
    expect((await clients.invitations.list('g', null)).items).toEqual([invitation]);
    for (value of [
      { invitations: [{ ...invitation, status: 'sent' }], nextCursor: null },
      { invitations: [{ ...invitation, expiresAtMs: 'wrong' }], nextCursor: null },
      { invitations: Array(21).fill(invitation), nextCursor: null },
      { invitations: [], nextCursor: 'impossible' }, { invitations: [invitation], nextCursor: 'same' }, {},
    ]) await expect(clients.invitations.list('g', 'same')).rejects.toMatchObject({ status: 502 });
  });
  it('propagates rate, expired-code and permission errors without provider body disclosure', async () => {
    let status = 429;
    const clients = createClients(async path => path === '/api/me' ? Response.json({ account, csrfToken: 'proof' })
      : Response.json({ error: 'private-provider-detail' }, { status }));
    await clients.auth.me();
    await expect(clients.invitations.send('g', invitation.email)).rejects.toMatchObject({ status: 429 });
    status = 400; await expect(clients.invitations.accept('a'.repeat(64))).rejects.toMatchObject({ status: 400 });
    status = 404; await expect(clients.invitations.revoke('g', invitation.email)).rejects.toMatchObject({ status: 404 });
  });
});
