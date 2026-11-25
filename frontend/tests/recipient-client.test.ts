import { describe, expect, it } from 'vitest';
import { createClients } from '../src/clients.ts';
import { recipientClientFor } from '../src/recipient-client.ts';
import { createHttpClient } from '../src/http-client.ts';
const recipient = { drawId: 'draw', recipient: { accountId: 'person', displayName: 'Ana' } };
describe('private recipient client', () => {
  it('uses only the encoded event route and session cookies without CSRF or identity overrides', async () => {
    const calls: Array<{ path: string; options: RequestInit }> = [];
    const clients = createClients(async (path, options = {}) => {
      calls.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account: { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }, csrfToken: 'proof' });
      return Response.json(recipient);
    });
    await clients.auth.me(); expect(await clients.recipients.find('event /?#')).toEqual(recipient);
    const call = calls[1]; expect(call.path).toBe('/api/events/event%20%2F%3F%23/recipient');
    expect(call.options.method).toBe('GET'); expect(call.options.body).toBeUndefined(); expect(call.options.credentials).toBe('same-origin');
    expect(call.options.cache).toBe('no-store'); expect(call.options.redirect).toBe('error');
    expect(new Headers(call.options.headers).has('X-CSRF-Token')).toBe(false);
  });
  it('selects only the public contract and rejects malformed assignment fields', async () => {
    let value: unknown = { ...recipient, envelope: 'secret', recipient: { ...recipient.recipient, email: 'private', phone: 'private' } };
    const client = recipientClientFor(createHttpClient(async () => Response.json(value)));
    expect(await client.find('e')).toEqual(recipient);
    for (value of [{}, { ...recipient, drawId: '' }, { ...recipient, drawId: 1 }, { ...recipient, recipient: null },
      { ...recipient, recipient: { accountId: '', displayName: 'Name' } }, { ...recipient, recipient: { accountId: 'id', displayName: ' ' } },
      { ...recipient, recipient: { accountId: 'id', displayName: 123 } }]) await expect(client.find('e')).rejects.toMatchObject({ status: 502 });
  });
  it.each([401, 404, 409, 503])('preserves generic status %s without retry or provider body exposure', async status => {
    let calls = 0; const client = recipientClientFor(createHttpClient(async () => { calls++; return Response.json({ error: 'private details' }, { status }); }));
    await expect(client.find('e')).rejects.toMatchObject({ status }); expect(calls).toBe(1);
  });
});
