import type { MemberService } from '../application/member-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { MemberInputError, memberPageInput } from '../domain/members.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { applicationOrigin } from './application-origin.ts';
import { readSessionCookie } from './session-cookie.ts';

interface MemberDependencies {
  members: MemberService;
  sessions: SessionService;
  applicationOrigin: string;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function decodedId(value: string): string {
  try {
    const id = decodeURIComponent(value);
    if (!id.trim()) throw new MemberInputError();
    return id;
  } catch (error) {
    if (error instanceof URIError) throw new MemberInputError();
    throw error;
  }
}

export async function handleMemberRequest(request: Request, dependencies: MemberDependencies): Promise<Response> {
  const url = new URL(request.url);
  const route = /^\/api\/groups\/([^/]+)\/members(?:\/([^/]+))?$/.exec(url.pathname);
  if (!route) return json({ error: 'Not found' }, 404);
  const method = route[2] === undefined ? 'GET' : 'DELETE';
  if (request.method !== method) return json({ error: 'Method not allowed' }, 405, { Allow: method });
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  try {
    const groupId = decodedId(route[1]);
    if (method === 'GET') {
      if (url.searchParams.getAll('limit').length > 1 || url.searchParams.getAll('cursor').length > 1) throw new MemberInputError();
      const page = memberPageInput(url.searchParams.get('limit'), url.searchParams.get('cursor'));
      const result = await dependencies.members.list(session.accountId, groupId, page);
      return result === null ? json({ error: 'Not found' }, 404) : json(result, 200);
    }
    const origin = applicationOrigin(dependencies.applicationOrigin);
    if (!origin) return json({ error: 'Member removal unavailable' }, 503);
    if (request.headers.get('Origin') !== origin
      || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
      return json({ error: 'Forbidden' }, 403);
    }
    const result = await dependencies.members.remove(session.accountId, groupId, decodedId(route[2]));
    if (result === 'not-found') return json({ error: 'Not found' }, 404);
    if (result === 'owner-protected') return json({ error: 'The group owner cannot be removed' }, 409);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MemberInputError) return json({ error: 'Invalid member input' }, 400);
    throw error;
  }
}
