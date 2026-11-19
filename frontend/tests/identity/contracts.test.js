import { describe, expect, it, vi, afterEach } from 'vitest'
import { requestJson } from '../../src/api/client.js'
import { phoneValue } from '../../src/plugins/phone.js'
import { identity, passwordError } from '../../src/api/identity.js'

afterEach(() => vi.unstubAllGlobals())
describe('identity input and transport contracts', () => {
  it('obtains fresh session CSRF for every mutation and preserves exact credentials', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'first' }), { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'next' }), { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await identity.login('ana@example.test', ' exact ')
    await identity.logout()
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/csrf', '/api/login', '/api/csrf', '/api/logout'])
    expect(JSON.parse(fetch.mock.calls[1][1].body).password).toBe(' exact ')
    expect(fetch.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('first')
    expect(fetch.mock.calls[3][1].headers.get('X-CSRF-Token')).toBe('next')
  })
  it('accepts 204 without JSON parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(requestJson('/api/logout')).resolves.toBeNull()
  })
  it('restricts phone to digits and a single leading plus', () => {
    expect(phoneValue('+34 (600)-123 456')).toBe('+34600123456')
    expect(phoneValue('34+60++0a')).toBe('34600')
    expect(phoneValue('+')).toBe('+')
  })
  it('preserves exact passwords and validates UTF-8 bytes', () => {
    expect(passwordError(' a b c ')).toBe('')
    expect(passwordError('12345')).not.toBe('')
    expect(passwordError('á'.repeat(2048))).toBe('')
    expect(passwordError('á'.repeat(2048) + 'a')).not.toBe('')
  })
})

it('uses PATCH with fresh CSRF and whitelists only account field errors', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'account' }), { headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ fields: { email: 'Ya existe.', roles: 'hidden', passwordHash: 'hidden' } }), { status: 422, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  await expect(identity.update({ lastName: null })).rejects.toMatchObject({ status: 422, fields: { email: 'Ya existe.' } })
  const [path, options] = fetch.mock.calls[1]
  expect(path).toBe('/api/me'); expect(options.method).toBe('PATCH')
  expect(JSON.parse(options.body)).toEqual({ lastName: null })
  expect(options.headers.get('X-CSRF-Token')).toBe('account')
})
