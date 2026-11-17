import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, requestJson } from '../src/api/client.js'

afterEach(() => vi.unstubAllGlobals())

describe('same-origin JSON boundary', () => {
  it('uses a relative API URL and keeps same-origin credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"name":"Toca Regalo"}', {
      headers: { 'Content-Type': 'application/ld+json' },
    }))
    vi.stubGlobal('fetch', fetch)
    await expect(requestJson('/api')).resolves.toEqual({ name: 'Toca Regalo' })
    expect(fetch).toHaveBeenCalledWith('/api', expect.objectContaining({ credentials: 'same-origin' }))
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Accept')).toBe('application/ld+json')
  })

  it.each(['https://example.test/api', '//example.test/api', '/api/../../private', '/other', '/api\\private'])('rejects an unsafe boundary: %s', async (path) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(requestJson(path)).rejects.toBeInstanceOf(ApiError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not allow options to change the credential policy', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    await requestJson('/api', { credentials: 'include', headers: { 'X-Test': 'value' } })
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin')
    expect(new Headers(fetch.mock.calls[0][1].headers).get('X-Test')).toBe('value')
  })

  it('returns a Spanish HTTP error without leaking the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"secret":"private"}', { status: 403 })))
    await expect(requestJson('/api')).rejects.toMatchObject({ status: 403, message: 'No se pudo completar la solicitud.' })
  })

  it.each([
    new Response('<html>private</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('invalid', { headers: { 'Content-Type': 'application/json' } }),
  ])('rejects non-JSON or malformed JSON responses', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(requestJson('/api')).rejects.toBeInstanceOf(ApiError)
  })

  it('converts network failures to a Spanish error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('internal connection detail')))
    await expect(requestJson('/api')).rejects.toMatchObject({ message: 'No se pudo conectar con el servidor.' })
  })
})
