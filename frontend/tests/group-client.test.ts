import { describe, expect, it } from 'vitest';
import { createClients } from '../src/clients.ts';
import { createHttpClient } from '../src/http-client.ts';
import { groupClientFor } from '../src/group-client.ts';

const account = { id: 'self', email: 'self@example.test', displayName: 'Self', lastName: null, phone: null, emailVerifiedAtMs: null };
const group = { id: 'g', name: 'Friends', ownerAccountId: 'self', createdAtMs: 1000 };
const member = { accountId: 'self', displayName: 'Self', joinedAtMs: 1000, isOwner: true };
describe('focused group client', () => {
  it('shares CSRF with authentication, bounds pages and encodes IDs/cursors without actor overrides', async () => {
    const requests: Array<{ path: string; options: RequestInit }> = [];
    const clients = createClients(async (path, options = {}) => {
      requests.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account, csrfToken: 'proof' });
      if (options.method === 'POST') return Response.json({ group }, { status: 201 });
      if (String(path).includes('/members')) return Response.json({ members: [member], nextCursor: null });
      if (String(path).startsWith('/api/groups?')) return Response.json({ groups: [group], nextCursor: null });
      return Response.json({ group });
    });
    await expect(clients.groups.create('Friends')).rejects.toMatchObject({ status: 401 });
    await clients.auth.me(); await clients.groups.create('Friends');
    await clients.groups.list('cursor +/&'); await clients.groups.find('group /?#'); await clients.groups.members('group /?#', 'person +/');
    expect(requests[1].path).toBe('/api/groups'); expect(requests[1].options.body).toBe(JSON.stringify({ name: 'Friends' }));
    expect(new Headers(requests[1].options.headers).get('X-CSRF-Token')).toBe('proof');
    expect(requests[2].path).toBe('/api/groups?limit=20&cursor=cursor+%2B%2F%26');
    expect(requests[3].path).toBe('/api/groups/group%20%2F%3F%23');
    expect(requests[4].path).toBe('/api/groups/group%20%2F%3F%23/members?limit=20&cursor=person+%2B%2F');
    for (const request of requests.slice(2)) {
      expect(request.options.method).toBe('GET'); expect(request.options.credentials).toBe('same-origin');
      expect(new Headers(request.options.headers).has('X-CSRF-Token')).toBe(false);
    }
  });
  it('selects only allowed response fields and rejects malformed or unbounded pages', async () => {
    let value: unknown = { members: [{ ...member, email: 'private@example.test', phone: 'secret' }], nextCursor: null };
    const client = groupClientFor(createHttpClient(async () => Response.json(value)));
    expect((await client.members('g', null)).items).toEqual([member]);
    for (value of [
      {}, { groups: [], nextCursor: 'impossible' }, { groups: [group], nextCursor: 'same' },
      { groups: [group], nextCursor: 123 }, { groups: Array(21).fill(group), nextCursor: null },
      { groups: [{ ...group, createdAtMs: 'wrong' }], nextCursor: null },
    ]) await expect(client.list('same')).rejects.toMatchObject({ status: 502 });
    value = { group: { ...group, email: 'private@example.test' } }; expect(await client.find('g')).toEqual(group);
    value = { members: [{ ...member, isOwner: 'yes' }], nextCursor: null };
    await expect(client.members('g', null)).rejects.toMatchObject({ status: 502 });
  });
  it('does not clear a newer CSRF proof when an obsolete request returns 401', async () => {
    let finish: ((response: Response) => void) | undefined;
    let reads = 0;
    const clients = createClients(async path => {
      if (path === '/api/me') return Response.json({ account, csrfToken: 'proof-' + ++reads });
      if (String(path).startsWith('/api/groups?')) return new Promise<Response>(resolve => { finish = resolve; });
      return Response.json({ group });
    });
    await clients.auth.me(); const old = clients.groups.list(null).catch(error => error);
    await clients.auth.me(); finish?.(new Response(null, { status: 401 }));
    expect(await old).toMatchObject({ status: 401 }); await expect(clients.groups.create('Friends')).resolves.toEqual(group);
  });
  it('revoked sessions prevent subsequent protected creation', async () => {
    let revoked = false;
    const clients = createClients(async path => path === '/api/me' ? Response.json({ account, csrfToken: 'proof' })
      : revoked ? new Response(null, { status: 401 }) : Response.json({ group }));
    await clients.auth.me(); revoked = true;
    await expect(clients.groups.find('missing')).rejects.toMatchObject({ status: 401 });
    await expect(clients.groups.create('Friends')).rejects.toMatchObject({ status: 401 });
  });
});
