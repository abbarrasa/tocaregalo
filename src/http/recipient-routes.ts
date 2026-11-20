import type { RecipientService } from '../application/recipient-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { RecipientKeyUnavailable } from '../infrastructure/recipient-key.ts';
import { readSessionCookie } from './session-cookie.ts';

interface Dependencies { recipients: RecipientService; sessions: SessionService }

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleRecipientRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  const route = /^\/api\/events\/([^/]+)\/recipient$/.exec(new URL(request.url).pathname);
  if (!route) return json({ error: 'Not found' }, 404);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
  const session = await dependencies.sessions.authenticate(readSessionCookie(request.headers.get('Cookie')));
  if (!session) return json({ error: 'Unauthorized' }, 401);
  let eventId: string;
  try { eventId = decodeURIComponent(route[1]); }
  catch (error) { if (error instanceof URIError) return json({ error: 'Invalid event ID' }, 400); throw error; }
  if (!eventId.trim()) return json({ error: 'Invalid event ID' }, 400);
  try {
    const result = await dependencies.recipients.find(session.accountId, eventId);
    if (result.kind === 'ok') return json({ drawId: result.drawId, recipient: result.recipient }, 200);
    if (result.kind === 'not-found') return json({ error: 'Not found' }, 404);
    return json({ error: 'Recipient assignment pending' }, 409);
  } catch (error) {
    if (error instanceof RecipientKeyUnavailable) return json({ error: 'Recipient unavailable' }, 503);
    throw error;
  }
}
