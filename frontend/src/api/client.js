export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export async function requestJson(path, options = {}) {
  const base = 'http://same-origin.invalid'
  const url = new URL(path, base)
  if (!path.startsWith('/api') || path.includes('\\') || url.origin !== base
      || !(url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
    throw new ApiError('La solicitud no es válida.')
  }
  const { errorFields = [], ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)
  headers.set('Accept', 'application/ld+json')
  let response
  try {
    response = await fetch(path, { ...fetchOptions, headers, credentials: 'same-origin', redirect: 'error' })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.')
  }
  const type = response.headers.get('Content-Type')?.split(';')[0].trim()
  const json = type === 'application/json' || type?.endsWith('+json')
  if (!response.ok) {
    const fields = {}
    if (response.status === 422 && json && errorFields.length) {
      try {
        const data = await response.json()
        for (const key of errorFields) {
          if (typeof data?.fields?.[key] === 'string' && data.fields[key].length <= 500) fields[key] = data.fields[key]
        }
      } catch { /* Keep a generic error when the response is not a valid contract. */ }
    }
    throw new ApiError('No se pudo completar la solicitud.', response.status, fields)
  }
  if (response.status === 204) return null
  if (!json) throw new ApiError('La respuesta del servidor no es válida.', response.status)
  try {
    return await response.json()
  } catch {
    throw new ApiError('La respuesta del servidor no es válida.', response.status)
  }
}
