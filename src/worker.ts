import type { D1Database, ExportedHandler } from '@cloudflare/workers-types';
import { SessionService } from './application/session-service.ts';
import { AccountsRepository } from './persistence/accounts-repository.ts';
import { SessionsRepository } from './persistence/sessions-repository.ts';
import { handleSessionRequest } from './http/session-routes.ts';

export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }
    try {
      return await handleSessionRequest(request, {
        sessions: new SessionService(new SessionsRepository(env.DB)),
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
