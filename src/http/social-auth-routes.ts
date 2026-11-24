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

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });
}

function randomUrlPart(bytes: number): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export const oauthStateCookieName = '__Host-tocaregalo_oauth_state';
const oauthStateCookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';

export function oauthStateCookie(stateHash: string): string {
  if (!/^[A-Za-z0-9_-]{43,44}$/.test(stateHash)) throw new RangeError('Invalid OAuth state binding.');
  return `${oauthStateCookieName}=${stateHash}; ${oauthStateCookieAttributes}; Max-Age=600`;
}

export function expiredOAuthStateCookie(): string {
  return `${oauthStateCookieName}=; ${oauthStateCookieAttributes}; Max-Age=0`;
}

function readOAuthStateCookie(cookie: string | null): string | null {
  const matches = (cookie ?? '').split(';').map(part => part.trim())
    .filter(part => part.split('=', 1)[0] === oauthStateCookieName);
  if (matches.length !== 1) return null;
  const value = matches[0].slice(oauthStateCookieName.length + 1);
  return /^[A-Za-z0-9_-]{43,44}$/.test(value) ? value : null;
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
    const redirect = await dependencies.google.authorizationUrl(state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect,
        'Set-Cookie': oauthStateCookie(stateHash),
        'Cache-Control': 'no-store',
      },
    });
  }
  if (url.pathname === '/api/auth/google/callback') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (url.searchParams.has('error')) return new Response(null, {
      status: 302,
      headers: { Location: origin + '/#login', 'Set-Cookie': expiredOAuthStateCookie(), 'Cache-Control': 'no-store' },
    });
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || !code) return json({ error: 'Invalid social authentication request' }, 400,
      { 'Set-Cookie': expiredOAuthStateCookie() });
    const stateHash = await sha256Base64Url(state);
    const browserBinding = readOAuthStateCookie(request.headers.get('Cookie'));
    if (!browserBinding || browserBinding !== stateHash) return json(
      { error: 'Invalid social authentication request' }, 400,
      { 'Set-Cookie': expiredOAuthStateCookie() },
    );
    const stateExists = await dependencies.oauthStates.find(stateHash, 'google', (dependencies.now ?? Date.now)());
    if (!stateExists) return json({ error: 'Invalid social authentication request' }, 400,
      { 'Set-Cookie': expiredOAuthStateCookie() });
    let identity;
    try {
      identity = await dependencies.google.exchange(code);
    } catch (error) {
      if (error instanceof SocialAuthError) {
        console.error('Google social token exchange failed', JSON.stringify({ status: error.status, stage: error.stage }));
        return json({ error: 'Social authentication unavailable' }, error.status,
          { 'Set-Cookie': expiredOAuthStateCookie() });
      }
      console.error('Google social token exchange failed', JSON.stringify({ error: 'unexpected' }));
      throw error;
    }
    const consumed = await dependencies.oauthStates.consume(stateHash, 'google', (dependencies.now ?? Date.now)());
    if (!consumed) return json({ error: 'Invalid social authentication request' }, 400,
      { 'Set-Cookie': expiredOAuthStateCookie() });
    const seconds = Number(dependencies.sessionTtlSeconds);
    if (!Number.isSafeInteger(seconds) || seconds < 1 || !Number.isSafeInteger(seconds * 1000)) {
      return json({ error: 'Authentication unavailable' }, 503,
        { 'Set-Cookie': expiredOAuthStateCookie() });
    }
    let issued;
    try {
      issued = await dependencies.socialAuth.login(
        identity.provider, identity.subject, identity.email, identity.displayName, seconds * 1000,
      );
    } catch (error) {
      if (error instanceof UnverifiedAccountAdoptionError) return new Response(null, {
        status: 302,
        headers: {
          Location: origin + '/#recover-social',
          'Set-Cookie': expiredOAuthStateCookie(),
          'Cache-Control': 'no-store',
        },
      });
      throw error;
    }
    if (!issued) return json({ error: 'Authentication unavailable' }, 503,
      { 'Set-Cookie': expiredOAuthStateCookie() });
    const remainingMs = issued.expiresAtMs - (dependencies.now ?? Date.now)();
    if (remainingMs <= 0) return json({ error: 'Authentication unavailable' }, 503,
      { 'Set-Cookie': expiredOAuthStateCookie() });
    const headers = new Headers({ Location: origin + '/#groups', 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', expiredOAuthStateCookie());
    headers.append('Set-Cookie', sessionCookie(issued.token, Math.max(1, Math.floor(remainingMs / 1000))));
    return new Response(null, { status: 302, headers });
  }
  return json({ error: 'Not found' }, 404);
}
