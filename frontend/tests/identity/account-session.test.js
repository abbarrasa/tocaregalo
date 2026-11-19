import { expect, it, vi } from 'vitest'
import { createSession } from '../../src/composables/useSession.js'
const actor = { id: 1, firstName: 'Ana', roles: ['ROLE_USER'] }
it('updates own actor and ignores a delayed update after logout', async () => {
  let finish
  const api = { login: async () => actor, update: vi.fn().mockResolvedValueOnce({ ...actor, firstName: 'Eva' }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })), logout: async () => null }
  const session = createSession(api)
  await session.login('ana', ' exact ')
  await session.update({ firstName: 'Eva' })
  expect(session.state.actor.firstName).toBe('Eva')
  const pending = session.update({ firstName: 'Late' })
  await session.logout()
  finish({ ...actor, firstName: 'Late' })
  await expect(pending).resolves.toBeNull()
  expect(session.state.actor).toBeNull()
})
it('clears actor on an unauthorized update without replay', async () => {
  const update = vi.fn().mockRejectedValue({ status: 401 })
  const session = createSession({ login: async () => actor, update })
  await session.login('ana', ' exact ')
  await expect(session.update({ firstName: 'Eva' })).rejects.toEqual({ status: 401 })
  expect(session.state.status).toBe('anonymous')
  expect(update).toHaveBeenCalledTimes(1)
})
it('does not let a late unauthorized update erase a newer login', async () => {
  let reject
  const login = vi.fn().mockResolvedValueOnce(actor).mockResolvedValueOnce({ ...actor, id: 2, firstName: 'Super' })
  const session = createSession({ login, update: () => new Promise((resolve, no) => { reject = no }) })
  await session.login('ana', ' exact ')
  const pending = session.update({ firstName: 'Eva' })
  await session.login('super', ' exact ')
  reject({ status: 401 })
  await expect(pending).resolves.toBeNull()
  expect(session.state.actor.id).toBe(2)
})
