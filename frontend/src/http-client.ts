export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly fields: Readonly<Record<string, string>>;
  readonly messageText: string | null;
  constructor(status: number, code: string | null = null, fields: Readonly<Record<string, string>> = {}, messageText: string | null = null) {
    super(messageText ?? 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.messageText = messageText;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new ApiError(502); }
}
export interface HttpClient {
  request(path: string, body?: unknown, csrf?: boolean, method?: 'DELETE' | 'PATCH' | 'POST'): Promise<Response>;
  setCsrf(token: string | null): void;
}

// One transport per application session; all focused clients share its CSRF proof.
export function createHttpClient(send: typeof fetch = fetch.bind(globalThis)): HttpClient {
  let csrfToken: string | null = null;
  let generation = 0;
  return {
    setCsrf(token) { csrfToken = token; generation++; },
    async request(path, body, csrf = false, method) {
      if (csrf && !csrfToken) throw new ApiError(401);
      const requestGeneration = generation;
      const headers = new Headers();
      if (body !== undefined) headers.set('Content-Type', 'application/json');
      if (csrf && csrfToken) headers.set('X-CSRF-Token', csrfToken);
      let response: Response;
      try {
        response = await send(path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers,
          body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin',
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
      } catch { throw new ApiError(0); }
      if (!response.ok) {
        // An old read must not clear the proof established by a newer session read.
        if (response.status === 401 && requestGeneration === generation) { csrfToken = null; generation++; }
        let body: unknown = null;
        try { body = await response.json(); } catch { body = null; }
        const value = isRecord(body) ? body : {};
        const fieldsValue = isRecord(value.fields) ? value.fields : {};
        const fields: Record<string, string> = {};
        for (const [key, text] of Object.entries(fieldsValue)) if (typeof text === 'string') fields[key] = text;
        throw new ApiError(
          response.status,
          typeof value.code === 'string' ? value.code : null,
          fields,
          typeof value.error === 'string' ? value.error : null,
        );
      }
      return response;
    },
  };
}
