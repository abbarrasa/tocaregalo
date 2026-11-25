import { InvitationDeliveryError, type InvitationService } from '../application/invitation-service.ts';
import type { InvitationManagementService } from '../application/invitation-management-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { AuthInputError, authObject } from '../domain/authentication.ts';
import { invitationEmailInput, invitationPageInput, isInvitationToken } from '../domain/invitations.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { readSessionCookie } from './session-cookie.ts';

interface InvitationDependencies {
  invitations: InvitationService;
  management: InvitationManagementService;
  sessions: SessionService;
  applicationOrigin: string;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleInvitationRequest(request: Request, dependencies: InvitationDependencies): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const collection = /^\/api\/groups\/([^/]+)\/invitations$/.exec(path);
  if (!collection && path !== '/api/invitations/accept') return json({ error: 'Not found' }, 404);
  const allowed = collection ? 'GET, POST, DELETE' : 'POST';
  if (request.method !== 'POST' && !(collection && (request.method === 'GET' || request.method === 'DELETE'))) {
    return json({ error: 'Method not allowed' }, 405, { Allow: allowed });
  }
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  if (request.method !== 'GET') {
    const origin = applicationOrigin(dependencies.applicationOrigin);
    if (!origin) return json({ error: 'Invitations unavailable' }, 503);
    if (request.headers.get('Origin') !== origin
      || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
      return json({ error: 'Forbidden' }, 403);
    }
  }
  try {
    if (collection) {
      let groupId: string;
      try { groupId = decodeURIComponent(collection[1]); }
      catch (error) { if (error instanceof URIError) throw new AuthInputError(); throw error; }
      if (request.method === 'GET') {
        if (url.searchParams.getAll('limit').length > 1 || url.searchParams.getAll('cursor').length > 1) throw new AuthInputError();
        const page = invitationPageInput(url.searchParams.get('limit'), url.searchParams.get('cursor'));
        const result = await dependencies.management.list(session.accountId, groupId, page);
        return result === null ? json({ error: 'Not found' }, 404) : json(result, 200);
      }
      const email = invitationEmailInput(await readAuthBody(request));
      if (request.method === 'DELETE') {
        const owner = await dependencies.management.revoke(session.accountId, groupId, email);
        return owner ? new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
          : json({ error: 'Not found' }, 404);
      }
      const result = await dependencies.invitations.request(session.accountId, groupId, email);
      if (result === 'not-found') return json({ error: 'Not found' }, 404);
      if (result === 'limited') return json({ error: 'Too many attempts' }, 429, { 'Retry-After': '900' });
      return json({ status: 'invitation_sent' }, 202);
    }
    const input = authObject(await readAuthBody(request));
    if (!isInvitationToken(input.token) || !await dependencies.invitations.accept(session.accountId, input.token)) {
      return json({ error: 'Invalid or expired invitation' }, 400);
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthInputError) return json({ error: 'Invalid invitation input' }, 400);
    if (error instanceof AuthBodyError) return json({ error: 'Invalid invitation request' }, error.status);
    if (error instanceof InvitationDeliveryError) return json({ error: 'Invitation delivery unavailable' }, 503);
    throw error;
  }
}
