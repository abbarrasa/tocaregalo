import { reactive, readonly } from 'vue'
import { identity } from '../api/identity.js'

export function createSession(api = identity) {
  const state = reactive({ actor: null, status: 'unknown', error: '', notice: '' })
  let generation = 0
  function actor(value) {
    if (!value || !Number.isInteger(value.id) || typeof value.firstName !== 'string' || !Array.isArray(value.roles)) throw new Error('La respuesta del servidor no es válida.')
    return { id: value.id, firstName: value.firstName, lastName: value.lastName, email: value.email, phone: value.phone, roles: [...value.roles] }
  }
  async function restore() {
    const current = ++generation
    state.status = 'loading'; state.error = ''
    try {
      const result = actor(await api.me())
      if (current === generation) { state.actor = result; state.status = 'authenticated' }
    } catch (error) {
      if (current !== generation) return
      state.actor = null
      state.status = error.status === 401 ? 'anonymous' : 'error'
      state.error = state.status === 'error' ? 'No se pudo comprobar la sesión. Inténtalo de nuevo.' : ''
    }
  }
  async function login(identifier, password) {
    const current = ++generation
    const result = actor(await api.login(identifier, password))
    if (current === generation) { state.actor = result; state.status = 'authenticated'; state.error = '' }
  }
  async function logout() {
    ++generation
    await api.logout()
    ++generation
    state.actor = null; state.status = 'anonymous'; state.error = ''; state.notice = ''
  }
  function clear() { ++generation; state.actor = null; state.status = 'anonymous'; state.error = '' }
  function notice(value) { state.notice = value }
  return { state: readonly(state), restore, login, logout, clear, notice }
}
export const session = createSession()
