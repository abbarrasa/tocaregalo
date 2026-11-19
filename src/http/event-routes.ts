import type { EventService } from '../application/event-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { EventInputError, eventCreationInput } from '../domain/events.ts';
import { GroupAccessError } from '../domain/groups.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { readSessionCookie } from './session-cookie.ts';

interface EventDependencies {
  events: EventService;
  sessions: SessionService;
  applicationOrigin: string;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function decodedId(value: string): string {
  try { return decodeURIComponent(value); }
  catch (error) {
    if (error instanceof URIError) throw new EventInputError();
    throw error;
  }
}

export async function handleEventRequest(request: Request, dependencies: EventDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  const creation = /^\/api\/groups\/([^/]+)\/events$/.exec(path);
  const detail = /^\/api\/events\/([^/]+)$/.exec(path);
  if (!creation && !detail) return json({ error: 'Not found' }, 404);
  const method = creation ? 'POST' : 'GET';
  if (request.method !== method) return json({ error: 'Method not allowed' }, 405, { Allow: method });
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  try {
    if (creation) {
      const origin = applicationOrigin(dependencies.applicationOrigin);
      if (!origin) return json({ error: 'Event creation unavailable' }, 503);
      if (request.headers.get('Origin') !== origin
        || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
        return json({ error: 'Forbidden' }, 403);
      }
      const groupId = decodedId(creation[1]);
      const input = eventCreationInput(await readAuthBody(request));
      const event = await dependencies.events.create(session.accountId, groupId, input);
      return json({ event }, 201, { Location: '/api/events/' + encodeURIComponent(event.id) });
    }
    if (!detail) return json({ error: 'Not found' }, 404);
    const event = await dependencies.events.find(session.accountId, decodedId(detail[1]));
    return event ? json({ event }) : json({ error: 'Not found' }, 404);
  } catch (error) {
    // Hide both missing groups and insufficient ownership behind the same response.
    if (error instanceof GroupAccessError) return json({ error: 'Not found' }, 404);
    if (error instanceof EventInputError) return json({ error: 'Invalid event input' }, 400);
    if (error instanceof AuthBodyError) return json({ error: 'Invalid event request' }, error.status);
    throw error;
  }
}
