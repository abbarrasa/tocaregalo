export type Account = Readonly<{
  id: string; email: string; displayName: string; lastName: string | null;
  phone: string | null; emailVerifiedAtMs: number | null;
}>;
export type RegistrationInput = Readonly<{
  name: string; email: string; password: string; lastName?: string; phone?: string;
}>;
export interface AuthClient {
  me(): Promise<Account>;
  login(identifier: string, password: string): Promise<void>;
  register(input: RegistrationInput): Promise<void>;
  recover(identifier: string): Promise<void>;
  reset(token: string, newPassword: string): Promise<void>;
  requestVerification(): Promise<void>;
  confirmVerification(token: string): Promise<void>;
  logout(): Promise<void>;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('Request failed'); this.name = 'ApiError'; this.status = status;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nullableString(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
function account(value: unknown): value is Account {
  return object(value) && typeof value.id === 'string' && typeof value.email === 'string'
    && typeof value.displayName === 'string' && nullableString(value.lastName) && nullableString(value.phone)
    && (value.emailVerifiedAtMs === null || (typeof value.emailVerifiedAtMs === 'number' && Number.isSafeInteger(value.emailVerifiedAtMs)));
}

// Paths are fixed and relative. Neither browser-supplied identities nor remote API URLs are accepted.
// Session cookie is HttpOnly; the CSRF proof stays in this instance's memory only.
export function createAuthClient(send: typeof fetch = fetch.bind(globalThis)): AuthClient {
  let csrfToken: string | null = null;
  async function request(path: string, body?: unknown, csrf = false): Promise<Response> {
    if (csrf && !csrfToken) throw new ApiError(401);
    const headers = new Headers();
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (csrf && csrfToken) headers.set('X-CSRF-Token', csrfToken);
    let response: Response;
    try {
      response = await send(path, { method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin',
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
    } catch { throw new ApiError(0); }
    if (!response.ok) {
      if (response.status === 401) csrfToken = null;
      await response.body?.cancel();
      throw new ApiError(response.status);
    }
    return response;
  }
  async function post(path: string, body: unknown, csrf = false): Promise<void> {
    const response = await request(path, body, csrf); await response.body?.cancel();
  }
  return {
    async me() {
      const response = await request('/api/me');
      let value: unknown;
      try { value = await response.json(); } catch { throw new ApiError(502); }
      if (!object(value) || !account(value.account) || typeof value.csrfToken !== 'string' || !value.csrfToken) {
        csrfToken = null; throw new ApiError(502);
      }
      csrfToken = value.csrfToken; return value.account;
    },
    async login(identifier, password) { await post('/api/login', { identifier, password }); },
    async register(input) { await post('/api/register', input); },
    async recover(identifier) { await post('/api/password-recovery/request', { identifier }); },
    async reset(token, newPassword) { await post('/api/password-recovery/confirm', { token, newPassword }); },
    async requestVerification() { await post('/api/email-verification/request', {}, true); },
    async confirmVerification(token) { await post('/api/email-verification/confirm', { token }); },
    async logout() { await post('/api/logout', {}, true); csrfToken = null; },
  };
}

export function errorMessage(error: unknown, invalid = 'Revisa los datos e inténtalo de nuevo.'): string {
  if (!(error instanceof ApiError)) return 'No se ha podido completar la operación. Inténtalo de nuevo.';
  if (error.status === 0) return 'No se pudo contactar con el servidor. Comprueba tu conexión. Si enviaste una solicitud, puede haberse procesado.';
  if (error.status === 400) return invalid;
  if (error.status === 401) return 'El correo, teléfono o contraseña no es válido, o la sesión ha caducado.';
  if (error.status === 403) return 'No se pudo autorizar la operación. Recarga la página e inténtalo de nuevo.';
  if (error.status === 409) return 'No se pudo registrar la cuenta con esos datos.';
  if (error.status === 429) return 'Has realizado demasiados intentos. Espera quince minutos antes de volver a intentarlo.';
  if (error.status === 413) return 'La solicitud es demasiado grande. Revisa el contenido de los campos.';
  return 'El servicio no está disponible en este momento. Inténtalo más tarde.';
}
