import { AuthInputError, loginInput, registrationInput } from '../domain/authentication.ts';
import { RegistrationConflictError, type AuthenticationService } from '../application/authentication-service.ts';
import type { AuthRateLimiter } from '../application/auth-rate-limiter.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { sessionCookie } from './session-cookie.ts';

interface AuthRouteDependencies {
  authentication: AuthenticationService;
  limiter: AuthRateLimiter;
  applicationOrigin: string;
  sessionTtlSeconds: string;
  localCountryPhonePrefix?: string;
  now?: () => number;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleAuthRequest(request: Request, dependencies: AuthRouteDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/register' && path !== '/api/login') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Authentication unavailable' }, 503);
  if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden' }, 403);
  try {
    const body = await readAuthBody(request);
    const operation = path === '/api/register' ? 'register' : 'login';
    const input = operation === 'register'
      ? registrationInput(body)
      : loginInput(body, dependencies.localCountryPhonePrefix);
    // Cloudflare sets/overwrites this header on inbound requests. Missing IPs share a fail-closed bucket.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const identifier = 'identifier' in input ? input.identifier : undefined;
    if (!await dependencies.limiter.allow(operation, ip, identifier)) {
      return json({ error: 'Too many attempts' }, 429, { 'Retry-After': '900' });
    }
    if (!('identifier' in input)) {
      const account = await dependencies.authentication.register(input);
      return json({ account }, 201);
    }
    const seconds = Number(dependencies.sessionTtlSeconds);
    if (!Number.isSafeInteger(seconds) || seconds < 1 || !Number.isSafeInteger(seconds * 1000)) {
      return json({ error: 'Authentication unavailable' }, 503);
    }
    const issued = await dependencies.authentication.login(input.identifier, input.password, seconds * 1000);
    if (!issued) return json({ error: 'Invalid credentials' }, 401);
    const remainingMs = issued.expiresAtMs - (dependencies.now ?? Date.now)();
    // The server enforces exact expiry; the cookie uses whole seconds.
    if (remainingMs <= 0) return json({ error: 'Authentication unavailable' }, 503);
    return json({ csrfToken: issued.csrfToken }, 200, {
      'Set-Cookie': sessionCookie(issued.token, Math.max(1, Math.floor(remainingMs / 1000))),
    });
  } catch (error) {
    if (error instanceof AuthInputError) return json({
      error: 'Invalid authentication input', code: 'validation_error', fields: error.fields,
    }, 400);
    if (error instanceof AuthBodyError) return json({ error: error.message }, error.status);
    if (error instanceof RegistrationConflictError) return json({
      error: 'Registration unavailable', code: 'profile_conflict', fields: error.fields,
    }, 409);
    throw error;
  }
}
