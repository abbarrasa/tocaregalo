import { describe, expect, it, vi } from 'vitest'
import { createSession } from '../../src/composables/useSession.js'

const actor = { id: 1, firstName: 'Ana', roles: ['ROLE_USER'] }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

describe('session authority and response races', () => {
  it('distinguishes anonymous from unavailable sessions', async () => {
    const api = { me: vi.fn().mockRejectedValue({ status: 401 }) }
    const current = createSession(api)
    await current.restore()
    expect(current.state.status).toBe('anonymous')
    api.me.mockRejectedValue({ status: 503 })
    await current.restore()
    expect(current.state.status).toBe('error')
    expect(current.state.actor).toBeNull()
  })
  it('does not let an earlier restoration erase a new login', async () => {
    const waiting = deferred()
    const current = createSession({ me: () => waiting.promise, login: async () => actor })
    const pending = current.restore()
    await current.login('ana@example.test', ' exact ')
    waiting.reject({ status: 401 })
    await pending
    expect(current.state.actor.id).toBe(1)
    expect(current.state.status).toBe('authenticated')
  })
  it('does not resurrect an actor after logout', async () => {
    const waiting = deferred()
    const current = createSession({ me: () => waiting.promise, logout: async () => null })
    const pending = current.restore()
    await current.logout()
    waiting.resolve(actor)
    await pending
    expect(current.state.actor).toBeNull()
    expect(current.state.status).toBe('anonymous')
  })
  it('keeps the active actor when server logout fails', async () => {
    const current = createSession({ login: async () => actor, logout: async () => { throw new Error('offline') } })
    await current.login('ana', ' exact ')
    await expect(current.logout()).rejects.toThrow('offline')
    expect(current.state.status).toBe('authenticated')
  })
})
