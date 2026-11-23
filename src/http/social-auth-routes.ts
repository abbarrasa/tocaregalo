import { GoogleSocialAuth } from '../infrastructure/google-social-auth.ts';
import { sha256Base64Url, SocialAuthError } from '../domain/social-auth.ts';
import { SocialAuthService } from '../application/social-auth-service.ts';
import { OAuthStatesRepository } from '../persistence/oauth-states-repository.ts';
import { applicationOrigin } from './application-origin.ts';
import { sessionCookie } from './session-cookie.ts';

interface SocialAuthDependencies {
  google: GoogleSocialAuth;
  oauthStates: OAuthStatesRepository;
  socialAuth: SocialAuthService;
  applicationOrigin: string;
  sessionTtlSeconds: string;
  now?: () => number;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function randomUrlPart(bytes: number): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function handleSocialAuthRequest(request: Request, dependencies: SocialAuthDependencies): Promise<Response> {
  const url = new URL(request.url);
  const origin = applicationOrigin(dependencies.applicationOrigin);
  if (!origin) return json({ error: 'Authentication unavailable' }, 503);
  if (url.pathname === '/api/auth/google/start') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (!dependencies.google.configured()) return json({ error: 'Authentication unavailable' }, 503);
    const state = randomUrlPart(32);
    const stateHash = await sha256Base64Url(state);
    const now = (dependencies.now ?? Date.now)();
    await dependencies.oauthStates.insert(stateHash, 'google', now, 10 * 60 * 1000);
    return Response.redirect(await dependencies.google.authorizationUrl(state), 302);
  }
  if (url.pathname === '/api/auth/google/callback') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (url.searchParams.has('error')) return Response.redirect(origin + '/#login', 302);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || !code) return json({ error: 'Invalid social authentication request' }, 400);
    const stateHash = await sha256Base64Url(state);
    const consumed = await dependencies.oauthStates.consume(stateHash, 'google', (dependencies.now ?? Date.now)());
    if (!consumed) return json({ error: 'Invalid social authentication request' }, 400);
    let identity;
    try {
      identity = await dependencies.google.exchange(code);
    } catch (error) {
      if (error instanceof SocialAuthError) return json({ error: 'Social authentication unavailable' }, error.status);
      throw error;
    }
    const seconds = Number(dependencies.sessionTtlSeconds);
    if (!Number.isSafeInteger(seconds) || seconds < 1 || !Number.isSafeInteger(seconds * 1000)) {
      return json({ error: 'Authentication unavailable' }, 503);
    }
    const issued = await dependencies.socialAuth.login(
      identity.provider, identity.subject, identity.email, identity.displayName, seconds * 1000,
    );
    if (!issued) return json({ error: 'Authentication unavailable' }, 503);
    const remainingMs = issued.expiresAtMs - (dependencies.now ?? Date.now)();
    if (remainingMs <= 0) return json({ error: 'Authentication unavailable' }, 503);
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + '/#groups',
        'Set-Cookie': sessionCookie(issued.token, Math.max(1, Math.floor(remainingMs / 1000))),
        'Cache-Control': 'no-store',
      },
    });
  }
  return json({ error: 'Not found' }, 404);
}
