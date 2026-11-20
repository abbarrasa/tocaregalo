import type { EventLifecycleService } from '../application/event-lifecycle-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { RecipientKeyUnavailable } from '../infrastructure/recipient-key.ts';
import { applicationOrigin } from './application-origin.ts';
import { readSessionCookie } from './session-cookie.ts';

interface Dependencies {
  lifecycle: EventLifecycleService;
  sessions: SessionService;
  applicationOrigin: string;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleEventLifecycleRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  const route = /^\/api\/events\/([^/]+)\/(draw|close)$/.exec(new URL(request.url).pathname);
  if (!route) return json({ error: 'Not found' }, 404);
  const allowed = route[2] === 'draw' ? 'GET, POST' : 'POST';
  if (request.method !== 'POST' && !(route[2] === 'draw' && request.method === 'GET')) {
    return json({ error: 'Method not allowed' }, 405, { Allow: allowed });
  }
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  let eventId: string;
  try { eventId = decodeURIComponent(route[1]); }
  catch (error) { if (error instanceof URIError) return json({ error: 'Invalid event ID' }, 400); throw error; }
  if (!eventId.trim()) return json({ error: 'Invalid event ID' }, 400);
  if (request.method === 'GET') {
    const state = await dependencies.lifecycle.state(session.accountId, eventId);
    return state ? json({ event: state }, 200) : json({ error: 'Not found' }, 404);
  }
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Event operation unavailable' }, 503);
  if (request.headers.get('Origin') !== origin
    || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
    return json({ error: 'Forbidden' }, 403);
  }
  try {
    const result = await dependencies.lifecycle.execute(session.accountId, eventId, route[2] === 'close');
    if (result.kind === 'ok') return json({ event: result.state }, 200);
    if (result.kind === 'not-found') return json({ error: 'Not found' }, 404);
    return json({ error: result.kind }, 409);
  } catch (error) {
    if (error instanceof RecipientKeyUnavailable) return json({ error: 'Event operation unavailable' }, 503);
    throw error;
  }
}
