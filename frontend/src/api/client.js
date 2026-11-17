export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function requestJson(path, options = {}) {
  // Accept only relative paths that remain inside the API after normalization.
  const base = 'http://same-origin.invalid'
  const url = new URL(path, base)
  if (!path.startsWith('/api') || path.includes('\\') || url.origin !== base
      || !(url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
    throw new ApiError('La solicitud no es válida.')
  }
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/ld+json')
  let response
  try {
    response = await fetch(path, { ...options, headers, credentials: 'same-origin', redirect: 'error' })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.')
  }
  if (!response.ok) {
    throw new ApiError('No se pudo completar la solicitud.', response.status)
  }
  const type = response.headers.get('Content-Type')?.split(';')[0].trim()
  if (type !== 'application/json' && !type?.endsWith('+json')) {
    throw new ApiError('La respuesta del servidor no es válida.', response.status)
  }
  try {
    return await response.json()
  } catch {
    throw new ApiError('La respuesta del servidor no es válida.', response.status)
  }
}
