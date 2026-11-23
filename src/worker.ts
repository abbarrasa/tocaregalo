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
import { PasswordRecoveryService } from './application/password-recovery-service.ts';
import { PasswordRecoveriesRepository } from './persistence/password-recoveries-repository.ts';
import { SendgridRecoverySender } from './infrastructure/sendgrid-recovery-sender.ts';
import { handlePasswordRecoveryRequest } from './http/password-recovery-routes.ts';
import { GroupsRepository } from './persistence/groups-repository.ts';
import { GroupService } from './application/group-service.ts';
import { handleGroupRequest } from './http/group-routes.ts';
import { EventService } from './application/event-service.ts';
import { handleEventRequest } from './http/event-routes.ts';
import { InvitationService } from './application/invitation-service.ts';
import { InvitationsRepository } from './persistence/invitations-repository.ts';
import { SendgridInvitationSender } from './infrastructure/sendgrid-invitation-sender.ts';
import { handleInvitationRequest } from './http/invitation-routes.ts';
import { InvitationManagementService } from './application/invitation-management-service.ts';
import { MemberService } from './application/member-service.ts';
import { MembersRepository } from './persistence/members-repository.ts';
import { handleMemberRequest } from './http/member-routes.ts';
import { EventLifecycleService } from './application/event-lifecycle-service.ts';
import { EventLifecycleRepository } from './persistence/event-lifecycle-repository.ts';
import { loadRecipientDecryptionKey, loadRecipientKey, type RecipientKeySettings } from './infrastructure/recipient-key.ts';
import { handleEventLifecycleRequest } from './http/event-lifecycle-routes.ts';
import { RecipientService } from './application/recipient-service.ts';
import { RecipientsRepository } from './persistence/recipients-repository.ts';
import { handleRecipientRequest } from './http/recipient-routes.ts';
import { ScheduledEventService } from './application/scheduled-event-service.ts';
import { EventProcessingRepository } from './persistence/event-processing-repository.ts';
import { DrawNotificationService } from './application/draw-notification-service.ts';
import { DrawNotificationsRepository } from './persistence/draw-notifications-repository.ts';
import { SendgridDrawNotificationSender } from './infrastructure/sendgrid-draw-notification-sender.ts';
import { GoogleSocialAuth } from './infrastructure/google-social-auth.ts';
import { SocialAuthService } from './application/social-auth-service.ts';
import { SocialAccountsRepository } from './persistence/social-accounts-repository.ts';
import { OAuthStatesRepository } from './persistence/oauth-states-repository.ts';
import { handleSocialAuthRequest } from './http/social-auth-routes.ts';

export interface Env extends RecipientKeySettings {
  DB: D1Database;
  APP_ORIGIN: string;
  SESSION_TTL_SECONDS: string;
  EMAIL_VERIFICATION_TTL_SECONDS: string;
  PASSWORD_RECOVERY_TTL_SECONDS: string;
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

export default {
  async scheduled(_controller, env) {
    const lifecycle = new EventLifecycleService(new EventLifecycleRepository(env.DB), () => loadRecipientKey(env));
    const report = await new ScheduledEventService(new EventProcessingRepository(env.DB), lifecycle).run();
    // Aggregate counts only: never log recipients, tokens, keys or raw database errors.
    console.info('Scheduled event processing', JSON.stringify(report));
    const notifications = await new DrawNotificationService(new DrawNotificationsRepository(env.DB),
      new SendgridDrawNotificationSender({ apiKey: env.SENDGRID_API_KEY, fromEmail: env.SENDGRID_FROM_EMAIL })).run();
    console.info('Draw notification processing', JSON.stringify(notifications));
  },
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }
    try {
      const sessions = new SessionService(new SessionsRepository(env.DB));
      if (/^\/api\/events\/[^/]+\/recipient$/.test(url.pathname)) {
        return await handleRecipientRequest(request, { sessions,
          recipients: new RecipientService(new RecipientsRepository(env.DB), id => loadRecipientDecryptionKey(env, id)),
        });
      }
      const lifecycle = new EventLifecycleService(new EventLifecycleRepository(env.DB), () => loadRecipientKey(env));
      if (/^\/api\/events\/[^/]+\/(draw|close)$/.test(url.pathname)) {
        return await handleEventLifecycleRequest(request, { lifecycle, sessions, applicationOrigin: env.APP_ORIGIN });
      }
      if (/^\/api\/groups\/[^/]+\/members(?:\/[^/]+)?$/.test(url.pathname)) {
        return await handleMemberRequest(request, {
          members: new MemberService(new MembersRepository(env.DB), lifecycle), sessions, applicationOrigin: env.APP_ORIGIN,
        });
      }
      if (/^\/api\/groups\/[^/]+\/invitations$/.test(url.pathname) || url.pathname === '/api/invitations/accept') {
        return await handleInvitationRequest(request, {
          sessions, applicationOrigin: env.APP_ORIGIN,
          management: new InvitationManagementService(new InvitationsRepository(env.DB)),
          invitations: new InvitationService(new InvitationsRepository(env.DB),
            new SendgridInvitationSender({ apiKey: env.SENDGRID_API_KEY, fromEmail: env.SENDGRID_FROM_EMAIL }),
            new AuthRateLimiter(new AuthCountersRepository(env.DB))),
        });
      }
      if (url.pathname === '/api/auth/google/start' || url.pathname === '/api/auth/google/callback') {
        return await handleSocialAuthRequest(request, {
          google: new GoogleSocialAuth({
            GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
          }),
          oauthStates: new OAuthStatesRepository(env.DB),
          socialAuth: new SocialAuthService(
            new SocialAccountsRepository(env.DB), sessions,
          ),
          applicationOrigin: env.APP_ORIGIN,
          sessionTtlSeconds: env.SESSION_TTL_SECONDS,
        });
      }
      if (/^\/api\/groups\/[^/]+\/events$/.test(url.pathname) || url.pathname.startsWith('/api/events/')) {
        return await handleEventRequest(request, {
          events: new EventService(new GroupsRepository(env.DB)), sessions, applicationOrigin: env.APP_ORIGIN,
        });
      }
      if (url.pathname === '/api/groups' || url.pathname.startsWith('/api/groups/')) {
        return await handleGroupRequest(request, {
          groups: new GroupService(new GroupsRepository(env.DB)), sessions, applicationOrigin: env.APP_ORIGIN,
        });
      }
      if (url.pathname === '/api/password-recovery/request' || url.pathname === '/api/password-recovery/confirm') {
        return await handlePasswordRecoveryRequest(request, {
          recovery: new PasswordRecoveryService(new PasswordRecoveriesRepository(env.DB), new Argon2PasswordHasher(),
            new SendgridRecoverySender({ apiKey: env.SENDGRID_API_KEY, fromEmail: env.SENDGRID_FROM_EMAIL })),
          limiter: new AuthRateLimiter(new AuthCountersRepository(env.DB)),
          applicationOrigin: env.APP_ORIGIN, tokenTtlSeconds: env.PASSWORD_RECOVERY_TTL_SECONDS,
          schedule: work => context.waitUntil(work),
        });
      }
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
    } catch (error) {
      // Fail closed without including database details or credentials in the response.
      console.error('Unhandled Worker request failure', JSON.stringify({
        name: error instanceof Error ? error.name : 'unknown',
      }));
      return Response.json({ error: 'Internal server error' }, {
        status: 500, headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
