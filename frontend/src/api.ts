import { ApiError, createHttpClient, isRecord as object, readJson, type HttpClient } from './http-client.ts';
export { ApiError } from './http-client.ts';

export type Account = Readonly<{
  id: string; email: string; displayName: string; lastName: string | null;
  phone: string | null; emailVerifiedAtMs: number | null;
}>;
export type RegistrationInput = Readonly<{
  name: string; email: string; password: string; lastName?: string; phone?: string;
}>;
export interface AuthClient {
  me(): Promise<Account>;
  startSocialLogin(provider: 'google'): void;
  login(identifier: string, password: string): Promise<void>;
  register(input: RegistrationInput): Promise<void>;
  recover(identifier: string): Promise<void>;
  reset(token: string, newPassword: string): Promise<void>;
  requestVerification(): Promise<void>;
  confirmVerification(token: string): Promise<void>;
  logout(): Promise<void>;
}

export function socialLoginPath(provider: 'google'): string {
  if (provider !== 'google') throw new ApiError(400);
  return `/api/auth/${provider}/start`;
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
  return authClientFor(createHttpClient(send));
}

export function authClientFor(http: HttpClient): AuthClient {
  async function post(path: string, body: unknown, csrf = false): Promise<void> {
    const response = await http.request(path, body, csrf); await response.body?.cancel();
  }
  return {
    startSocialLogin(provider) {
      globalThis.location.assign(socialLoginPath(provider));
    },
    async me() {
      const value = await readJson(await http.request('/api/me'));
      if (!object(value) || !account(value.account) || typeof value.csrfToken !== 'string' || !value.csrfToken) {
        http.setCsrf(null); throw new ApiError(502);
      }
      http.setCsrf(value.csrfToken); return value.account;
    },
    async login(identifier, password) { await post('/api/login', { identifier, password }); },
    async register(input) { await post('/api/register', input); },
    async recover(identifier) { await post('/api/password-recovery/request', { identifier }); },
    async reset(token, newPassword) { await post('/api/password-recovery/confirm', { token, newPassword }); },
    async requestVerification() { await post('/api/email-verification/request', {}, true); },
    async confirmVerification(token) { await post('/api/email-verification/confirm', { token }); },
    async logout() { await post('/api/logout', {}, true); http.setCsrf(null); },
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
