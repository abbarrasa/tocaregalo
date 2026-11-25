import { AuthInputError, profileUpdateInput } from '../domain/authentication.ts';
import { equalCsrfTokens, sessionCsrfToken } from '../domain/session.ts';
import { ProfilePasswordError, ProfileConflictError, type ProfileService } from '../application/profile-service.ts';
import type { SessionService } from '../application/session-service.ts';
import { AuthBodyError, readAuthBody } from './auth-body.ts';
import { applicationOrigin } from './application-origin.ts';
import { readSessionCookie, expiredSessionCookie } from './session-cookie.ts';

export interface ProfileRouteDependencies {
  sessions: SessionService;
  profiles: ProfileService;
  applicationOrigin: string;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function handleProfileRequest(request: Request, dependencies: ProfileRouteDependencies): Promise<Response> {
  if (new URL(request.url).pathname !== '/api/me/profile') return json({ error: 'Not found' }, 404);
  if (request.method !== 'PATCH') return new Response(null, { status: 405, headers: { Allow: 'PATCH', 'Cache-Control': 'no-store' } });
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Profile unavailable' }, 503);
  const token = readSessionCookie(request.headers.get('Cookie'));
  const session = await dependencies.sessions.authenticate(token);
  if (!session || !token) return json({ error: 'Unauthorized' }, 401);
  if (request.headers.get('Origin') !== origin
    || !equalCsrfTokens(request.headers.get('X-CSRF-Token') ?? '', await sessionCsrfToken(token))) {
    return json({ error: 'Forbidden' }, 403);
  }
  try {
    const input = profileUpdateInput(await readAuthBody(request));
    const result = await dependencies.profiles.update(session.accountId, input);
    const headers: Record<string, string> = {};
    if (result.passwordChanged) headers['Set-Cookie'] = expiredSessionCookie();
    return json({ account: result.account, passwordChanged: result.passwordChanged }, 200, headers);
  } catch (error) {
    if (error instanceof AuthInputError) return json({
      error: 'Invalid profile input', code: 'validation_error', fields: error.fields,
    }, 400);
    if (error instanceof AuthBodyError) return json({ error: error.message }, error.status);
    if (error instanceof ProfilePasswordError) return json({
      error: 'Current password is invalid', code: 'current_password_invalid',
      fields: { currentPassword: 'La contraseña actual no es correcta.' },
    }, 400);
    if (error instanceof ProfileConflictError) return json({
      error: 'Profile data conflict', code: 'profile_conflict', fields: error.fields,
    }, 409);
    throw error;
  }
}
