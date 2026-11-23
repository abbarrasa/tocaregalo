import { base64Url, sha256Base64Url, SocialAuthError, type SocialIdentity } from '../domain/social-auth.ts';

export interface GoogleSettings {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

type Jwk = { kid: string; kty: 'RSA'; alg: 'RS256'; use: 'sig'; n: string; e: string };

function jwkImport(jwk: Jwk): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function decodeJsonPart(part: string): Record<string, unknown> {
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new SocialAuthError();
  }
}

export class GoogleSocialAuth {
  private readonly issuer = 'https://accounts.google.com';
  private readonly authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';
  private readonly jwksEndpoint = 'https://www.googleapis.com/oauth2/v3/certs';
  private readonly settings: GoogleSettings;
  private readonly fetchImpl: typeof fetch;

  constructor(settings: GoogleSettings, fetchImpl: typeof fetch = fetch) {
    this.settings = settings;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  configured(): boolean {
    return !!this.settings.GOOGLE_CLIENT_ID
      && !!this.settings.GOOGLE_CLIENT_SECRET
      && !!this.settings.GOOGLE_REDIRECT_URI;
  }

  async authorizationUrl(state: string): Promise<string> {
    if (!this.configured()) throw new SocialAuthError(503);
    const url = new URL(this.authorizationEndpoint);
    url.searchParams.set('client_id', this.settings.GOOGLE_CLIENT_ID!);
    url.searchParams.set('redirect_uri', this.settings.GOOGLE_REDIRECT_URI!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async exchange(code: string): Promise<SocialIdentity> {
    if (!this.configured()) throw new SocialAuthError(503, 'configuration');
    try {
      const body = [
        ['code', code],
        ['client_id', this.settings.GOOGLE_CLIENT_ID!],
        ['client_secret', this.settings.GOOGLE_CLIENT_SECRET!],
        ['redirect_uri', this.settings.GOOGLE_REDIRECT_URI!],
        ['grant_type', 'authorization_code'],
      ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
      const tokenResponse = await this.fetchImpl(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      if (!tokenResponse.ok) {
        console.error('Google token exchange rejected', JSON.stringify({ status: tokenResponse.status }));
        throw new SocialAuthError(401, 'provider');
      }
      const tokens = await tokenResponse.json() as Record<string, unknown>;
      if (typeof tokens.id_token !== 'string') throw new SocialAuthError();
      return await this.verifyIdToken(tokens.id_token);
    } catch (error) {
      if (error instanceof SocialAuthError) throw error;
      if (error instanceof Error) {
        console.error('Google token endpoint fetch failed', JSON.stringify({
          name: error.name,
          message: error.message.slice(0, 200),
        }));
      } else {
        console.error('Google token endpoint fetch failed', JSON.stringify({ name: 'unknown' }));
      }
      throw new SocialAuthError(503, 'provider');
    }
  }

  private async verifyIdToken(idToken: string): Promise<SocialIdentity> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new SocialAuthError();
    const header = decodeJsonPart(parts[0]);
    const claims = decodeJsonPart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new SocialAuthError();
    if (claims.iss !== this.issuer && claims.iss !== 'accounts.google.com') throw new SocialAuthError();
    if (claims.aud !== this.settings.GOOGLE_CLIENT_ID) throw new SocialAuthError();
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new SocialAuthError();
    if (typeof claims.sub !== 'string' || !claims.sub) throw new SocialAuthError();
    if (typeof claims.email !== 'string' || claims.email_verified !== true) throw new SocialAuthError();
    if (typeof claims.name !== 'string' || !claims.name) throw new SocialAuthError();

    const jwksResponse = await this.fetchImpl(this.jwksEndpoint, { headers: { Accept: 'application/json' } });
    if (!jwksResponse.ok) {
      console.error('Google JWKS request rejected', JSON.stringify({ status: jwksResponse.status }));
      throw new SocialAuthError(503, 'jwks');
    }
    const jwks = await jwksResponse.json() as { keys?: Jwk[] };
    const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256');
    if (!jwk) throw new SocialAuthError();
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/').padEnd(
      parts[2].replace(/-/g, '+').replace(/_/g, '/').length + ((4 - parts[2].replace(/-/g, '+').replace(/_/g, '/').length % 4) % 4), '=')),
      char => char.charCodeAt(0));
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' }, await jwkImport(jwk), signature, signed,
    );
    if (!valid) throw new SocialAuthError();
    return { provider: 'google', subject: claims.sub, email: claims.email, displayName: claims.name, emailVerified: true };
  }
}
