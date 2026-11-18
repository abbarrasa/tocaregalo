import { ApiError, requestJson } from './client.js'

export function passwordError(value) {
  if (Array.from(value).length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (new TextEncoder().encode(value).length > 4096) return 'La contraseña no puede superar los 4096 bytes UTF-8.'
  return ''
}

async function mutate(path, values, errorFields = [], method = 'POST') {
  const result = await requestJson('/api/csrf')
  if (typeof result?.csrfToken !== 'string') throw new ApiError('La sesión no es válida. Vuelve a intentarlo.')
  return requestJson(path, {
    method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': result.csrfToken },
    body: JSON.stringify(values), errorFields,
  })
}

export const identity = {
  me: () => requestJson('/api/me'),
  update: values => mutate('/api/me', values, ['firstName', 'lastName', 'email', 'phone', 'password', '_form'], 'PATCH'),
  login: (identifier, password) => mutate('/api/login', { identifier, password }),
  logout: () => mutate('/api/logout', {}),
  recover: (identifier) => mutate('/api/password-recovery', { identifier }, ['identifier', '_form']),
  reset: (token, password) => mutate('/api/password-reset', { token, password }, ['token', 'password', '_form']),
}
