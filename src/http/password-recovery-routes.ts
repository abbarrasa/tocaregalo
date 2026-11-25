import type { PasswordRecoveryService } from '../application/password-recovery-service.ts';
import type { AuthRateLimiter } from '../application/auth-rate-limiter.ts';
import { AuthInputError, authObject, normalizeLoginIdentifier, passwordInput } from '../domain/authentication.ts';
import { isPasswordRecoveryToken } from '../domain/password-recovery.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';

interface RecoveryDependencies {
  recovery: PasswordRecoveryService;
  limiter: AuthRateLimiter;
  applicationOrigin: string;
  tokenTtlSeconds: string;
  localCountryPhonePrefix?: string;
  schedule: (work: Promise<void>) => void;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handlePasswordRecoveryRequest(request: Request, dependencies: RecoveryDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  const isRequest = path === '/api/password-recovery/request';
  if (!isRequest && path !== '/api/password-recovery/confirm') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Recovery unavailable' }, 503);
  if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden' }, 403);
  try {
    const body = authObject(await readAuthBody(request));
    let identifier: string | undefined;
    if (isRequest) {
      if (typeof body.identifier !== 'string') throw new AuthInputError();
      identifier = normalizeLoginIdentifier(body.identifier, dependencies.localCountryPhonePrefix);
    }
    if (!await dependencies.limiter.allow(isRequest ? 'recovery-request' : 'recovery-confirm',
      request.headers.get('CF-Connecting-IP') ?? 'unknown', identifier)) {
      return json({ error: 'Too many attempts' }, 429, { 'Retry-After': '900' });
    }
    if (identifier !== undefined) {
      const seconds = Number(dependencies.tokenTtlSeconds);
      if (!Number.isSafeInteger(seconds) || seconds < 1 || !Number.isSafeInteger(Date.now() + seconds * 1000)) {
        return json({ error: 'Recovery unavailable' }, 503);
      }
      // No account lookup or provider response is awaited by the public response path.
      // waitUntil is bounded background work, not a durable delivery queue.
      dependencies.schedule(dependencies.recovery.request(identifier, seconds * 1000).catch(() => {
        // Keep failures observable without exposing identifiers, tokens or provider/database details.
        console.error('Password recovery background request failed.');
      }));
      return json({ status: 'recovery_requested' }, 202);
    }
    const password = passwordInput(body.newPassword);
    if (!isPasswordRecoveryToken(body.token) || !await dependencies.recovery.confirm(body.token, password)) {
      return json({ error: 'Invalid or expired recovery token' }, 400);
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthInputError) return json({ error: 'Invalid recovery input' }, 400);
    if (error instanceof AuthBodyError) return json({ error: error.message }, error.status);
    throw error;
  }
}
