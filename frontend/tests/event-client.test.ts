import { describe, expect, it } from 'vitest';
import { createClients } from '../src/clients.ts';
import { eventClientFor } from '../src/event-client.ts';
import { createHttpClient } from '../src/http-client.ts';
import { localClosureTime } from '../src/event-time.ts';
import { privateHash, privatePage } from '../src/navigation.ts';
const event = { id: 'e /#', groupId: 'g /?', createdAtMs: 1000, closureAtMs: null };
describe('event client and browser contracts', () => {
  it('shares CSRF, uses encoded fixed routes and sends only a nullable closure', async () => {
    const calls: Array<{ path: string; options: RequestInit }> = [];
    const clients = createClients(async (path, options = {}) => {
      calls.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account: { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }, csrfToken: 'proof' });
      return String(path).includes('?limit=') ? Response.json({ events: [event], nextCursor: null }) : Response.json({ event });
    });
    await expect(clients.events.create(event.groupId, null)).rejects.toMatchObject({ status: 401 }); expect(calls).toHaveLength(0);
    await clients.auth.me(); await clients.events.create(event.groupId, null); await clients.events.create(event.groupId, 9999);
    await clients.events.list(event.groupId, '[1,1000,"a /&"]'); await clients.events.find(event.id);
    expect(calls[1].path).toBe('/api/groups/g%20%2F%3F/events'); expect(calls[1].options.body).toBe('{"closureAtMs":null}');
    expect(calls[2].options.body).toBe('{"closureAtMs":9999}'); expect(calls[2].options.method).toBe('POST');
    expect(new Headers(calls[1].options.headers).get('X-CSRF-Token')).toBe('proof');
    expect(calls[3].path).toBe('/api/groups/g%20%2F%3F/events?limit=20&cursor=%5B1%2C1000%2C%22a+%2F%26%22%5D');
    expect(calls[4].path).toBe('/api/events/e%20%2F%23');
    for (const call of calls.slice(3)) { expect(call.options.method).toBe('GET'); expect(new Headers(call.options.headers).has('X-CSRF-Token')).toBe(false); }
    for (const call of calls) { expect(call.options.credentials).toBe('same-origin'); expect(call.options.cache).toBe('no-store'); }
  });
  it('selects minimal fields, preserves server order and rejects malformed or foreign results', async () => {
    let value: unknown = { events: [{ ...event, recipient: 'private' }, { ...event, id: 'second' }], nextCursor: null };
    const client = eventClientFor(createHttpClient(async () => Response.json(value)));
    expect((await client.list(event.groupId, null)).items).toEqual([event, { ...event, id: 'second' }]);
    for (value of [
      {}, { events: [event], nextCursor: 'same' }, { events: [], nextCursor: 'next' },
      { events: Array(21).fill(event), nextCursor: null }, { events: [{ ...event, groupId: 'foreign' }], nextCursor: null },
      { events: [{ ...event, closureAtMs: 'future' }], nextCursor: null }, { events: [{ ...event, createdAtMs: 0.5 }], nextCursor: null },
    ]) await expect(client.list(event.groupId, 'same')).rejects.toMatchObject({ status: 502 });
    value = { event: { ...event, id: 'foreign' } }; await expect(client.find(event.id)).rejects.toMatchObject({ status: 502 });
    value = { event: { ...event, groupId: 'foreign' } }; const http = createHttpClient(async () => Response.json(value)); http.setCsrf('proof');
    await expect(eventClientFor(http).create(event.groupId, null)).rejects.toMatchObject({ status: 502 });
  });
  it('rejects impossible local dates and converts local wall time into an instant', () => {
    for (const value of ['', '2030-02-30T12:00', '2030-13-01T12:00', '2030-01-01T24:00', '2030-01-01T12:60', '2030-01-01T12:00Z']) expect(localClosureTime(value)).toBeNull();
    const ms = localClosureTime('2030-07-15T14:30'); expect(ms).not.toBeNull();
    if (ms === null) throw new Error('Missing instant');
    const date = new Date(ms); expect(date.getFullYear()).toBe(2030); expect(date.getMonth()).toBe(6); expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(14); expect(date.getMinutes()).toBe(30); expect(date.getSeconds()).toBe(0);
  });
  it('round-trips event routes without treating encoded IDs as routing separators', () => {
    for (const page of [{ kind: 'events', groupId: 'g /?#' }, { kind: 'event', id: 'e /?#' }] as const) expect(privatePage(privateHash(page))).toEqual(page);
    expect(privatePage('#groups/%ZZ/events')).toEqual({ kind: 'groups' }); expect(privatePage('#events/%ZZ')).toEqual({ kind: 'groups' });
  });
});
