export const maxAuthBodyBytes = 16 * 1024;

export class AuthBodyError extends Error {
  readonly status: number;
  constructor(status: number) { super('Invalid authentication request.'); this.status = status; }
}

export async function readAuthBody(request: Request): Promise<unknown> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AuthBodyError(415);
  }
  if (Number(request.headers.get('Content-Length')) > maxAuthBodyBytes) throw new AuthBodyError(413);
  if (!request.body) throw new AuthBodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxAuthBodyBytes) { await reader.cancel(); throw new AuthBodyError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) throw new AuthBodyError(400);
    throw error;
  }
}
