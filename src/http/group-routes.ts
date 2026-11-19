import type { GroupService } from '../application/group-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { GroupInputError, groupNameInput, groupPageInput } from '../domain/groups.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { applicationOrigin } from './application-origin.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { readSessionCookie } from './session-cookie.ts';

interface GroupDependencies {
  groups: GroupService;
  sessions: SessionService;
  applicationOrigin: string;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleGroupRequest(request: Request, dependencies: GroupDependencies): Promise<Response> {
  const url = new URL(request.url);
  const collection = url.pathname === '/api/groups';
  const match = /^\/api\/groups\/([^/]+)$/.exec(url.pathname);
  if (!collection && !match) return json({ error: 'Not found' }, 404);
  const allowed = collection ? 'GET, POST' : 'GET';
  if (request.method !== 'GET' && !(collection && request.method === 'POST')) {
    return json({ error: 'Method not allowed' }, 405, { Allow: allowed });
  }
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  try {
    if (request.method === 'POST') {
      const origin = applicationOrigin(dependencies.applicationOrigin);
      if (!origin) return json({ error: 'Group creation unavailable' }, 503);
      if (request.headers.get('Origin') !== origin
        || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
        return json({ error: 'Forbidden' }, 403);
      }
      const name = groupNameInput(await readAuthBody(request));
      const group = await dependencies.groups.create(session.accountId, name);
      return json({ group }, 201, { Location: '/api/groups/' + encodeURIComponent(group.id) });
    }
    if (collection) {
      if (url.searchParams.getAll('limit').length > 1 || url.searchParams.getAll('cursor').length > 1) throw new GroupInputError();
      const page = groupPageInput(url.searchParams.get('limit'), url.searchParams.get('cursor'));
      return json(await dependencies.groups.list(session.accountId, page));
    }
    if (!match) return json({ error: 'Not found' }, 404);
    let groupId: string;
    try { groupId = decodeURIComponent(match[1]); }
    catch (error) {
      if (error instanceof URIError) throw new GroupInputError();
      throw error;
    }
    const group = await dependencies.groups.find(session.accountId, groupId);
    return group ? json({ group }) : json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof GroupInputError) return json({ error: 'Invalid group input' }, 400);
    if (error instanceof AuthBodyError) return json({ error: 'Invalid group request' }, error.status);
    throw error;
  }
}
