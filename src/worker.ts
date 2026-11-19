import type { D1Database, ExportedHandler } from '@cloudflare/workers-types';
import { SessionService } from './application/session-service.ts';
import { AccountsRepository } from './persistence/accounts-repository.ts';
import { SessionsRepository } from './persistence/sessions-repository.ts';
import { handleSessionRequest } from './http/session-routes.ts';
import { AuthenticationService } from './application/authentication-service.ts';
import { AuthRateLimiter } from './application/auth-rate-limiter.ts';
import { CredentialsRepository } from './persistence/credentials-repository.ts';
import { AuthCountersRepository } from './persistence/auth-counters-repository.ts';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.ts';
import { handleAuthRequest } from './http/auth-routes.ts';
import { EmailVerificationService } from './application/email-verification-service.ts';
import { EmailVerificationsRepository } from './persistence/email-verifications-repository.ts';
import { SendgridVerificationSender } from './infrastructure/sendgrid-verification-sender.ts';
import { handleEmailVerificationRequest } from './http/email-verification-routes.ts';

export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS: string;
  EMAIL_VERIFICATION_TTL_SECONDS: string;
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }
    try {
      const sessions = new SessionService(new SessionsRepository(env.DB));
      if (url.pathname === '/api/email-verification/request' || url.pathname === '/api/email-verification/confirm') {
        return await handleEmailVerificationRequest(request, {
          sessions,
          verification: new EmailVerificationService(new EmailVerificationsRepository(env.DB),
            new SendgridVerificationSender({ apiKey: env.SENDGRID_API_KEY, fromEmail: env.SENDGRID_FROM_EMAIL })),
          limiter: new AuthRateLimiter(new AuthCountersRepository(env.DB)),
          applicationOrigin: env.APP_ORIGIN,
          tokenTtlSeconds: env.EMAIL_VERIFICATION_TTL_SECONDS,
        });
      }
      if (url.pathname === '/api/register' || url.pathname === '/api/login') {
        return await handleAuthRequest(request, {
          authentication: new AuthenticationService(new CredentialsRepository(env.DB), new Argon2PasswordHasher(), sessions),
          limiter: new AuthRateLimiter(new AuthCountersRepository(env.DB)),
          applicationOrigin: env.APP_ORIGIN,
          sessionTtlSeconds: env.SESSION_TTL_SECONDS,
        });
      }
      return await handleSessionRequest(request, {
        sessions,
        accounts: new AccountsRepository(env.DB),
        applicationOrigin: env.APP_ORIGIN,
      });
    } catch {
      // Fail closed without including database details or credentials in the response.
      return Response.json({ error: 'Internal server error' }, {
        status: 500, headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
