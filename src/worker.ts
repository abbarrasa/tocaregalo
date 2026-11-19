import type { D1Database, ExportedHandler } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
