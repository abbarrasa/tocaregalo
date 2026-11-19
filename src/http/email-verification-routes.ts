import type { SessionService } from '../application/session-service.ts';
import type { AuthRateLimiter } from '../application/auth-rate-limiter.ts';
import { VerificationDeliveryError, type EmailVerificationService } from '../application/email-verification-service.ts';
import { authObject, AuthInputError } from '../domain/authentication.ts';
import { isEmailVerificationToken } from '../domain/email-verification.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { readSessionCookie } from './session-cookie.ts';

interface VerificationRouteDependencies {
  sessions: SessionService;
  verification: EmailVerificationService;
  limiter: AuthRateLimiter;
  applicationOrigin: string;
  tokenTtlSeconds: string;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleEmailVerificationRequest(request: Request, dependencies: VerificationRouteDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  const isRequest = path === '/api/email-verification/request';
  if (!isRequest && path !== '/api/email-verification/confirm') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = isRequest ? await dependencies.sessions.authenticate(token) : null;
  if (isRequest && (!session || !token)) return json({ error: 'Unauthorized' }, 401);
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Verification unavailable' }, 503);
  if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden' }, 403);
  if (isRequest && token && !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
    return json({ error: 'Forbidden' }, 403);
  }
  try {
    const body = authObject(await readAuthBody(request));
    const operation = isRequest ? 'verification-request' : 'verification-confirm';
    if (!await dependencies.limiter.allow(operation, request.headers.get('CF-Connecting-IP') ?? 'unknown', session?.accountId)) {
      return json({ error: 'Too many attempts' }, 429, { 'Retry-After': '900' });
    }
    if (isRequest && session) {
      const seconds = Number(dependencies.tokenTtlSeconds);
      if (!Number.isSafeInteger(seconds) || seconds < 1 || !Number.isSafeInteger(seconds * 1000)
        || !Number.isSafeInteger(Date.now() + seconds * 1000)) {
        return json({ error: 'Verification unavailable' }, 503);
      }
      const sent = await dependencies.verification.request(session.accountId, seconds * 1000);
      return sent ? json({ status: 'verification_requested' }, 202)
        : new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!isEmailVerificationToken(body.token) || !await dependencies.verification.confirm(body.token)) {
      return json({ error: 'Invalid or expired verification token' }, 400);
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthInputError) return json({ error: 'Invalid verification input' }, 400);
    if (error instanceof AuthBodyError) return json({ error: error.message }, error.status);
    if (error instanceof VerificationDeliveryError) return json({ error: 'Verification delivery unavailable' }, 503);
    throw error;
  }
}
