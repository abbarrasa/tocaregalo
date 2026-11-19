import type { SessionService } from '../application/session-service.ts';
import type { Account } from '../persistence/accounts-repository.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { expiredSessionCookie, readSessionCookie } from './session-cookie.ts';

interface SessionRouteDependencies {
  sessions: SessionService;
  accounts: { findSelf(accountId: string): Promise<Account | null> };
  applicationOrigin: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleSessionRequest(request: Request, dependencies: SessionRouteDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/me' && path !== '/api/logout') return new Response('Not found', { status: 404 });
  const expectedMethod = path === '/api/me' ? 'GET' : 'POST';
  if (request.method !== expectedMethod) {
    return new Response(null, { status: 405, headers: { Allow: expectedMethod, 'Cache-Control': 'no-store' } });
  }
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);

  if (path === '/api/me') {
    const account = await dependencies.accounts.findSelf(session.accountId);
    if (!account) return json({ error: 'Unauthorized' }, 401);
    return json({ account, csrfToken: await sessionCsrfToken(token) });
  }

  // Explicit trusted origin plus a session-bound token: SameSite alone is insufficient.
  let allowedOrigin: string;
  try {
    const configured = new URL(dependencies.applicationOrigin);
    if (configured.protocol !== 'https:' || configured.origin !== dependencies.applicationOrigin) {
      return json({ error: 'Session origin unavailable' }, 503);
    }
    allowedOrigin = configured.origin;
  } catch {
    return json({ error: 'Session origin unavailable' }, 503);
  }
  if (request.headers.get('Origin') !== allowedOrigin
    || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
    return json({ error: 'Forbidden' }, 403);
  }
  await dependencies.sessions.revoke(token);
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': expiredSessionCookie(), 'Cache-Control': 'no-store' },
  });
}
