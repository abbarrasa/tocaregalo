export type SocialProvider = 'google';

export type SocialIdentity = Readonly<{
  provider: SocialProvider;
  subject: string;
  email: string;
  displayName: string;
  emailVerified: true;
}>;

export class SocialAuthError extends Error {
  readonly status: number;
  constructor(status = 401) {
    super(status === 503 ? 'Social authentication unavailable.' : 'Social authentication failed.');
    this.status = status;
  }
}

export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}
