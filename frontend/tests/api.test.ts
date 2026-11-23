import { describe, expect, it, vi } from 'vitest';
import { ApiError, createAuthClient, errorMessage, socialLoginPath } from '../src/api.ts';

const account = { id: 'self', email: 'self@example.test', displayName: 'Self', lastName: null, phone: null, emailVerifiedAtMs: null };
describe('same-origin authentication client', () => {
  it('starts Google through a fixed relative OAuth route', async () => {
    expect(socialLoginPath('google')).toBe('/api/auth/google/start');
  });
  it('updates profile only through the relative CSRF-protected PATCH route', async () => {
    const requests: Array<{ path: string; options: RequestInit }> = [];
    const client = createAuthClient(async (path, options = {}) => {
      requests.push({ path: String(path), options });
      if (path === '/api/me') return Response.json({ account, csrfToken: 'profile-proof' });
      return Response.json({ account: { ...account, displayName: 'Updated' }, passwordChanged: false });
    });
    await client.me();
    await client.updateProfile({
      name: 'Updated', email: account.email, lastName: 'Example', phone: '+34612345678',
    });
    expect(requests[1].path).toBe('/api/me/profile');
    expect(requests[1].options.method).toBe('PATCH');
    expect(new Headers(requests[1].options.headers).get('X-CSRF-Token')).toBe('profile-proof');
    expect(JSON.parse(String(requests[1].options.body))).toEqual({
      name: 'Updated', email: account.email, lastName: 'Example', phone: '+34612345678',
    });
  });
  it('uses only relative paths, preserves exact passwords and adds CSRF only to protected requests', async () => {
    const requests: Array<{ path: string; options: RequestInit }> = [];
    const client = createAuthClient(async (path, options = {}) => {
      requests.push({ path: String(path), options });
      return path === '/api/me' ? Response.json({ account, csrfToken: 'session-proof' }) : new Response(null, { status: 204 });
    });
    const password = '  🔑🔑🔑🔑🔑🔑  ';
    await client.login('+34600000101', password); await client.me();
    await client.requestVerification(); await client.confirmVerification('code'); await client.logout();
    expect(JSON.parse(String(requests[0].options.body))).toEqual({ identifier: '+34600000101', password });
    expect(new Headers(requests[0].options.headers).has('X-CSRF-Token')).toBe(false);
    expect(new Headers(requests[2].options.headers).get('X-CSRF-Token')).toBe('session-proof');
    expect(new Headers(requests[3].options.headers).has('X-CSRF-Token')).toBe(false);
    expect(new Headers(requests[4].options.headers).get('X-CSRF-Token')).toBe('session-proof');
    for (const { path, options } of requests) {
      expect(path.startsWith('/api/')).toBe(true); expect(options.credentials).toBe('same-origin');
      expect(options.cache).toBe('no-store'); expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    await expect(client.requestVerification()).rejects.toMatchObject({ status: 401 });
    expect(requests).toHaveLength(5);
  });
  it('forgets CSRF after revocation and rejects malformed account/session responses', async () => {
    let valid = true;
    const client = createAuthClient(async () => valid ? Response.json({ account, csrfToken: 'proof' }) : new Response(null, { status: 401 }));
    await client.me(); valid = false; await expect(client.me()).rejects.toMatchObject({ status: 401 });
    await expect(client.logout()).rejects.toMatchObject({ status: 401 });
    for (const value of [{ account, csrfToken: '' }, { account: { ...account, phone: 42 }, csrfToken: 'proof' }, { csrfToken: 'proof' }]) {
      await expect(createAuthClient(async () => Response.json(value)).me()).rejects.toMatchObject({ status: 502 });
    }
  });
  it('maps public failures generically without exposing response bodies or network exceptions', async () => {
    const client = createAuthClient(async () => Response.json({ error: 'private-provider-detail' }, { status: 429 }));
    await expect(client.recover('self@example.test')).rejects.toMatchObject({ status: 429 });
    expect(errorMessage(new ApiError(429))).toContain('quince minutos');
    expect(errorMessage(new ApiError(400), 'Código inválido.')).toBe('Código inválido.');
    const offline = createAuthClient(async () => { throw new Error('private-network-detail'); });
    await expect(offline.me()).rejects.toMatchObject({ status: 0 });
    expect(errorMessage(new Error('private-network-detail'))).not.toContain('private');
  });
  it('preserves structured field errors from API responses without exposing provider details', async () => {
    const client = createAuthClient(async () => Response.json({
      error: 'Invalid authentication input',
      code: 'validation_error',
      fields: {
        email: 'Introduce un correo electrónico válido.',
        phone: 'Introduce un teléfono internacional válido.',
      },
    }, { status: 400 }));
    await expect(client.register({ name: 'Self', email: 'invalid', password: '123456' })).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
      fields: {
        email: 'Introduce un correo electrónico válido.',
        phone: 'Introduce un teléfono internacional válido.',
      },
    });
  });
  it('sends recovery and confirmation codes in POST bodies, never in URLs or browser storage', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const client = createAuthClient(send);
    await client.register({ email: account.email, name: 'Self', password: '123456' });
    await client.recover(account.email); await client.reset('secret-code', '🔑🔑🔑🔑🔑🔑');
    expect(send.mock.calls[1][0]).toBe('/api/password-recovery/request');
    expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toEqual({ identifier: account.email });
    expect(send.mock.calls[2][0]).toBe('/api/password-recovery/confirm');
    expect(JSON.parse(String(send.mock.calls[2][1]?.body))).toEqual({ token: 'secret-code', newPassword: '🔑🔑🔑🔑🔑🔑' });
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
});
