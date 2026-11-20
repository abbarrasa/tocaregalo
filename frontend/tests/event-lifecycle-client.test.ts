import { describe, expect, it } from 'vitest';
import { createClients } from '../src/clients.ts';
import { createHttpClient } from '../src/http-client.ts';
import { eventLifecycleClientFor } from '../src/event-lifecycle-client.ts';
const ready = { eventId: 'e /#', status: 'ready', drawId: 'd', closedAtMs: null };
describe('event lifecycle client', () => {
  it('uses shared CSRF for bodyless mutations, fixed encoded routes and no CSRF for reads', async () => {
    const calls: Array<{ path: string; options: RequestInit }> = [];
    const clients = createClients(async (path, options = {}) => {
      calls.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account: { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }, csrfToken: 'proof' });
      return Response.json({ event: String(path).endsWith('/close') ? { ...ready, status: 'closed', closedAtMs: 2000 } : ready });
    });
    await expect(clients.lifecycle.draw(ready.eventId)).rejects.toMatchObject({ status: 401 }); expect(calls).toHaveLength(0);
    await clients.auth.me(); await clients.lifecycle.state(ready.eventId); await clients.lifecycle.draw(ready.eventId); await clients.lifecycle.close(ready.eventId);
    expect(calls[1].path).toBe('/api/events/e%20%2F%23/draw'); expect(calls[1].options.method).toBe('GET');
    expect(new Headers(calls[1].options.headers).has('X-CSRF-Token')).toBe(false);
    for (const call of calls.slice(2)) {
      expect(call.options.method).toBe('POST'); expect(call.options.body).toBeUndefined();
      expect(new Headers(call.options.headers).get('X-CSRF-Token')).toBe('proof');
    }
    expect(calls[3].path).toBe('/api/events/e%20%2F%23/close');
    for (const call of calls) { expect(call.options.credentials).toBe('same-origin'); expect(call.options.cache).toBe('no-store'); }
  });
  it('rejects inconsistent, foreign or malformed state and strips private fields', async () => {
    let value: unknown = { event: { ...ready, recipients: ['secret'], key: 'secret' } };
    const http = createHttpClient(async () => Response.json(value)); http.setCsrf('proof'); const client = eventLifecycleClientFor(http);
    expect(await client.state(ready.eventId)).toEqual(ready);
    for (value of [
      {}, { event: { ...ready, eventId: 'other' } }, { event: { ...ready, status: 'unknown' } },
      { event: { ...ready, drawId: '' } }, { event: { ...ready, closedAtMs: 3 } },
      { event: { ...ready, status: 'pending' } }, { event: { ...ready, status: 'closed', closedAtMs: null } },
      { event: { ...ready, status: 'closed', closedAtMs: 1.5 } },
    ]) await expect(client.state(ready.eventId)).rejects.toMatchObject({ status: 502 });
    value = { event: ready }; await expect(client.close(ready.eventId)).rejects.toMatchObject({ status: 502 });
    value = { event: { ...ready, status: 'pending', drawId: null } }; await expect(client.draw(ready.eventId)).rejects.toMatchObject({ status: 502 });
  });
  it('preserves generic conflict/unavailability errors without retrying or exposing bodies', async () => {
    let calls = 0; let status = 409;
    const http = createHttpClient(async () => { calls++; return Response.json({ error: 'private provider details' }, { status }); }); http.setCsrf('proof');
    const client = eventLifecycleClientFor(http); await expect(client.draw('e')).rejects.toMatchObject({ status: 409 });
    status = 503; await expect(client.close('e')).rejects.toMatchObject({ status: 503 }); expect(calls).toBe(2);
  });
});
